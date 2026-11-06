-- Phase 1 of the rider area: accounts, coach-created riders, personal invite links, levels.
-- Apply with `node scripts/members/migrate.mjs` (needs POSTGRES_URL_NON_POOLING in .env.local).
--
-- Model
--   profiles  one row per login (auth.users). Identity + role. Created by a trigger on sign-up.
--   riders    the coach's roster. A rider can exist before they have a login (the coach adds them);
--             `profile_id` links it to an account once the rider claims their invite. Anyone who signs up
--             on their own gets a rider row on first visit (ensure_my_rider).
--   invites   personal claim links. Only a SHA-256 of the token is stored; the token itself is shown once.
--   rider_levels  self-rated band (rider) + verified band (coach only). Only a coach moves a verified level.
--   audit_log every staff action on riders and invites.
--
-- Security: RLS on every table. Riders read their own rows; coaches and admins read everything. Anything that
-- changes a role, a verified level, an invite or a claim goes through a SECURITY DEFINER function that checks
-- the caller first.

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------- profiles
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  first_name  text check (char_length(first_name) <= 60),
  last_name   text check (char_length(last_name) <= 60),
  phone       text check (char_length(phone) <= 32),
  instagram   text check (char_length(instagram) <= 60),
  bio         text check (char_length(bio) <= 280),
  photo_url   text,
  role        text not null default 'rider' check (role in ('rider', 'coach', 'admin')),
  consent_at  timestamptz,
  adult       boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------- riders
create table public.riders (
  id              uuid primary key default gen_random_uuid(),
  profile_id      uuid unique references public.profiles (id) on delete set null,
  first_name      text not null check (char_length(first_name) between 1 and 60),
  last_name       text check (char_length(last_name) <= 60),
  phone           text check (char_length(phone) <= 32),
  instagram       text check (char_length(instagram) <= 60),
  email           text check (char_length(email) <= 254),
  coach_id        uuid references public.profiles (id) on delete set null,
  sessions_before integer not null default 0 check (sessions_before between 0 and 5000),
  member_since    date,
  created_by      uuid references public.profiles (id) on delete set null,  -- null = signed up on their own
  founding_at     timestamptz,
  claimed_at      timestamptz,
  created_at      timestamptz not null default now()
);
create index riders_coach_idx on public.riders (coach_id);

-- ---------------------------------------------------------------- levels
-- 1 First day · 2 Sliding · 3 Turning · 4 Cruising · 5 Carving & park start · 6 Park · 7 Advanced
create table public.rider_levels (
  rider_id     uuid primary key references public.riders (id) on delete cascade,
  self_band    smallint check (self_band between 1 and 7),
  self_at      timestamptz,
  band         smallint check (band between 1 and 7),
  verified_by  uuid references public.profiles (id) on delete set null,
  verified_at  timestamptz
);

-- ---------------------------------------------------------------- invites
create table public.invites (
  id          uuid primary key default gen_random_uuid(),
  rider_id    uuid not null references public.riders (id) on delete cascade,
  token_hash  bytea not null unique,
  created_by  uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null default now() + interval '90 days',
  revoked_at  timestamptz,
  used_at     timestamptz,
  used_by     uuid references public.profiles (id) on delete set null
);
create index invites_rider_idx on public.invites (rider_id);

-- ---------------------------------------------------------------- audit + rate limits
create table public.audit_log (
  id         bigint generated always as identity primary key,
  actor_id   uuid,
  action     text not null,
  rider_id   uuid,
  payload    jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create table public.rate_hits (
  key        text not null,
  at         timestamptz not null default now()
);
create index rate_hits_key_idx on public.rate_hits (key, at);

-- ---------------------------------------------------------------- helpers
create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role in ('coach', 'admin'));
$$;

create or replace function public.audit(p_action text, p_rider uuid, p_payload jsonb default '{}')
returns void language sql security definer set search_path = public as $$
  insert into audit_log (actor_id, action, rider_id, payload) values (auth.uid(), p_action, p_rider, p_payload);
$$;
revoke execute on function public.audit(text, uuid, jsonb) from public, anon, authenticated;

-- true while `key` has had fewer than `max_hits` hits in `win`; records the hit. Used by the /api routes.
create or replace function public.rate_ok(p_key text, p_max integer, p_window interval)
returns boolean language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  delete from rate_hits where at < now() - interval '1 day';
  select count(*) into n from rate_hits where key = p_key and at > now() - p_window;
  if n >= p_max then return false; end if;
  insert into rate_hits (key) values (p_key);
  return true;
end $$;
revoke execute on function public.rate_ok(text, integer, interval) from public, anon, authenticated;

-- For the /api/auth/link route (service role only): does this email have a login, and is it confirmed?
create or replace function public.auth_user_state(p_email text)
returns table (state text, first_name text)
language sql stable security definer set search_path = public, auth as $$
  select coalesce((select case when u.email_confirmed_at is null then 'unconfirmed' else 'confirmed' end
                   from auth.users u where lower(u.email) = lower(trim(p_email)) limit 1), 'none'),
         (select p.first_name from auth.users u join profiles p on p.id = u.id where lower(u.email) = lower(trim(p_email)) limit 1);
$$;
revoke execute on function public.auth_user_state(text) from public, anon, authenticated;

create or replace function public.token_hash(p_token text) returns bytea
language sql immutable set search_path = public, extensions as $$
  select extensions.digest(convert_to(p_token, 'UTF8'), 'sha256');
$$;

-- ---------------------------------------------------------------- new login → profile
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare m jsonb := coalesce(new.raw_user_meta_data, '{}');
begin
  insert into profiles (id, first_name, last_name, phone, consent_at, adult)
  values (
    new.id,
    nullif(left(trim(coalesce(m->>'first_name', split_part(m->>'full_name', ' ', 1))), 60), ''),
    nullif(left(trim(coalesce(m->>'last_name', nullif(substr(m->>'full_name', strpos(m->>'full_name', ' ') + 1), m->>'full_name'))), 60), ''),
    nullif(left(trim(m->>'phone'), 32), ''),
    case when (m->>'consent')::boolean then now() end,
    coalesce((m->>'adult')::boolean, false)
  )
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;
create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------- RLS
alter table public.profiles     enable row level security;
alter table public.riders       enable row level security;
alter table public.rider_levels enable row level security;
alter table public.invites      enable row level security;
alter table public.audit_log    enable row level security;
alter table public.rate_hits    enable row level security;

-- coaches are public people: any signed-in rider may read a coach's profile (their name on a level chip)
create policy profiles_read on public.profiles for select to authenticated
  using (id = auth.uid() or role in ('coach', 'admin') or public.is_staff());
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
-- a rider may only change their own identity fields, never role / consent / adult
revoke update on public.profiles from anon, authenticated;
grant update (first_name, last_name, phone, instagram, bio, photo_url) on public.profiles to authenticated;
revoke insert, delete on public.profiles from anon, authenticated;

create policy riders_read on public.riders for select to authenticated
  using (profile_id = auth.uid() or public.is_staff());
revoke insert, update, delete on public.riders from anon, authenticated;

create policy levels_read on public.rider_levels for select to authenticated
  using (public.is_staff() or exists (select 1 from public.riders r where r.id = rider_id and r.profile_id = auth.uid()));
revoke insert, update, delete on public.rider_levels from anon, authenticated;

create policy invites_staff on public.invites for select to authenticated using (public.is_staff());
revoke insert, update, delete on public.invites from anon, authenticated;

create policy audit_staff on public.audit_log for select to authenticated using (public.is_staff());
revoke insert, update, delete on public.audit_log from anon, authenticated;
revoke all on public.rate_hits from anon, authenticated;

-- ---------------------------------------------------------------- rider-side functions
-- The signed-in person's rider row, created on first call for someone who signed up on their own.
create or replace function public.ensure_my_rider() returns uuid
language plpgsql security definer set search_path = public as $$
declare rid uuid; p profiles;
begin
  if auth.uid() is null then raise exception 'not signed in' using errcode = '42501'; end if;
  select id into rid from riders where profile_id = auth.uid();
  if rid is not null then return rid; end if;
  select * into p from profiles where id = auth.uid();
  insert into riders (profile_id, first_name, last_name, phone, claimed_at)
  values (auth.uid(), coalesce(p.first_name, 'Rider'), p.last_name, p.phone, now())
  returning id into rid;
  return rid;
end $$;

-- A rider rates themselves. Refused once a coach has verified a band: from then on it is the coach's to move.
create or replace function public.set_self_level(p_band smallint) returns text
language plpgsql security definer set search_path = public as $$
declare rid uuid := public.ensure_my_rider(); lv rider_levels;
begin
  if p_band not between 1 and 7 then return 'off_scale'; end if;
  select * into lv from rider_levels where rider_id = rid;
  if lv.band is not null then return 'coach_verified'; end if;
  insert into rider_levels (rider_id, self_band, self_at) values (rid, p_band, now())
  on conflict (rider_id) do update set self_band = excluded.self_band, self_at = now();
  return 'ok';
end $$;

-- ---------------------------------------------------------------- invites: preview + claim
-- What the claim page may show for a token, and nothing else. Callable signed out: the link was sent to that
-- person directly, which is the disclosure boundary.
create or replace function public.invite_preview(p_token text)
returns table (status text, first_name text, sessions_before integer, member_since date, band smallint, coach_name text)
language plpgsql stable security definer set search_path = public as $$
declare i invites; r riders;
begin
  if p_token is null or length(p_token) < 20 then return query select 'invalid', null::text, null::int, null::date, null::smallint, null::text; return; end if;
  select * into i from invites where token_hash = public.token_hash(p_token);
  if i.id is null then return query select 'invalid', null::text, null::int, null::date, null::smallint, null::text; return; end if;
  select * into r from riders where id = i.rider_id;
  return query select
    case
      when r.profile_id is not null and i.used_at is null then 'claimed'
      when i.used_at is not null then 'used'
      when i.revoked_at is not null then 'revoked'
      when i.expires_at < now() then 'expired'
      else 'ok' end,
    r.first_name, r.sessions_before, r.member_since,
    (select coalesce(l.band, l.self_band) from rider_levels l where l.rider_id = r.id),
    (select c.first_name from profiles c where c.id = r.coach_id);
end $$;
grant execute on function public.invite_preview(text) to anon, authenticated;

-- Attach the invited rider row to a login. Used by claim_invite (signed in) and by the /api/auth/join route
-- (service role) right after it creates the account. Returns a status word the page turns into copy.
create or replace function public.claim_invite_for(p_token text, p_user uuid) returns text
language plpgsql security definer set search_path = public as $$
declare i invites; r riders; own riders; own_has_history boolean;
begin
  select * into i from invites where token_hash = public.token_hash(p_token) for update;
  if i.id is null then return 'invalid'; end if;
  select * into r from riders where id = i.rider_id for update;
  if r.profile_id = p_user then return 'ok'; end if;          -- already theirs: opening the link twice is fine
  if r.profile_id is not null then return 'claimed'; end if;
  if i.used_at is not null then return 'used'; end if;
  if i.revoked_at is not null then return 'revoked'; end if;
  if i.expires_at < now() then return 'expired'; end if;

  -- someone who signed up on their own already has a rider row. If a coach has put nothing on it yet, it gives
  -- way to the invited one; otherwise the two histories would collide, so refuse and let the club sort it out.
  select * into own from riders where profile_id = p_user;
  if own.id is not null then
    own_has_history := own.created_by is not null or own.sessions_before > 0
      or exists (select 1 from rider_levels l where l.rider_id = own.id and l.band is not null);
    if own_has_history then return 'has_history'; end if;
    -- keep a self-rating they gave, if the coach's record has none
    insert into rider_levels (rider_id, self_band, self_at)
      select r.id, l.self_band, l.self_at from rider_levels l where l.rider_id = own.id and l.self_band is not null
      on conflict (rider_id) do update set self_band = coalesce(rider_levels.self_band, excluded.self_band),
        self_at = coalesce(rider_levels.self_at, excluded.self_at);
    delete from riders where id = own.id;
  end if;

  update riders set profile_id = p_user, claimed_at = now(), founding_at = coalesce(founding_at, now()) where id = r.id;
  update invites set used_at = now(), used_by = p_user where id = i.id;
  update invites set revoked_at = now() where rider_id = r.id and id <> i.id and used_at is null and revoked_at is null;
  -- fill blanks on the profile from what the coach had on file; never overwrite what the rider typed
  update profiles p set
    first_name = coalesce(p.first_name, r.first_name),
    last_name  = coalesce(p.last_name, r.last_name),
    phone      = coalesce(p.phone, r.phone),
    instagram  = coalesce(p.instagram, r.instagram)
  where p.id = p_user;
  insert into audit_log (actor_id, action, rider_id, payload) values (p_user, 'invite.claimed', r.id, jsonb_build_object('invite', i.id));
  return 'ok';
end $$;
revoke execute on function public.claim_invite_for(text, uuid) from public, anon, authenticated;

create or replace function public.claim_invite(p_token text) returns text
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return 'signed_out'; end if;
  return public.claim_invite_for(p_token, auth.uid());
end $$;
grant execute on function public.claim_invite(text) to authenticated;

-- ---------------------------------------------------------------- coach functions
create or replace function public.require_staff() returns void
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_staff() then raise exception 'coaches only' using errcode = '42501'; end if;
end $$;

create or replace function public.create_rider(
  p_first_name text, p_last_name text default null, p_phone text default null, p_instagram text default null,
  p_email text default null, p_band smallint default null, p_sessions_before integer default 0,
  p_member_since date default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare rid uuid;
begin
  perform public.require_staff();
  if coalesce(trim(p_first_name), '') = '' then raise exception 'first name required' using errcode = '22023'; end if;
  insert into riders (first_name, last_name, phone, instagram, email, coach_id, sessions_before, member_since, created_by)
  values (trim(p_first_name), nullif(trim(p_last_name), ''), nullif(trim(p_phone), ''),
          nullif(trim(both '@ ' from coalesce(p_instagram, '')), ''), nullif(lower(trim(p_email)), ''),
          auth.uid(), coalesce(p_sessions_before, 0), p_member_since, auth.uid())
  returning id into rid;
  if p_band is not null then
    insert into rider_levels (rider_id, band, verified_by, verified_at) values (rid, p_band, auth.uid(), now());
  end if;
  perform public.audit('rider.created', rid, jsonb_build_object('band', p_band));
  return rid;
end $$;

create or replace function public.update_rider(
  p_rider uuid, p_first_name text, p_last_name text, p_phone text, p_instagram text, p_email text,
  p_sessions_before integer, p_member_since date
) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.require_staff();
  update riders set
    first_name = coalesce(nullif(trim(p_first_name), ''), first_name),
    last_name = nullif(trim(p_last_name), ''),
    phone = nullif(trim(p_phone), ''),
    instagram = nullif(trim(both '@ ' from coalesce(p_instagram, '')), ''),
    email = nullif(lower(trim(p_email)), ''),
    sessions_before = coalesce(p_sessions_before, sessions_before),
    member_since = p_member_since
  where id = p_rider;
  perform public.audit('rider.updated', p_rider);
end $$;

-- Only a coach moves a verified level. There is no un-verify: a coach can pick another band, not remove it.
create or replace function public.verify_level(p_rider uuid, p_band smallint) returns void
language plpgsql security definer set search_path = public as $$
declare before smallint;
begin
  perform public.require_staff();
  if p_band not between 1 and 7 then raise exception 'off scale' using errcode = '22023'; end if;
  select band into before from rider_levels where rider_id = p_rider;
  insert into rider_levels (rider_id, band, verified_by, verified_at) values (p_rider, p_band, auth.uid(), now())
  on conflict (rider_id) do update set band = excluded.band, verified_by = excluded.verified_by, verified_at = now();
  perform public.audit('level.verified', p_rider, jsonb_build_object('from', before, 'to', p_band));
end $$;

-- A fresh personal link for one rider. Any older open link for them stops working at once.
create or replace function public.mint_invite(p_rider uuid) returns text
language plpgsql security definer set search_path = public, extensions as $$
declare tok text; r riders;
begin
  perform public.require_staff();
  select * into r from riders where id = p_rider;
  if r.id is null then raise exception 'no such rider' using errcode = '22023'; end if;
  if r.profile_id is not null then raise exception 'already claimed' using errcode = '22023'; end if;
  update invites set revoked_at = now() where rider_id = p_rider and used_at is null and revoked_at is null;
  tok := translate(encode(extensions.gen_random_bytes(24), 'base64'), '+/=', '-_');
  insert into invites (rider_id, token_hash, created_by) values (p_rider, public.token_hash(tok), auth.uid());
  perform public.audit('invite.minted', p_rider);
  return tok;
end $$;

create or replace function public.revoke_invite(p_rider uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.require_staff();
  update invites set revoked_at = now() where rider_id = p_rider and used_at is null and revoked_at is null;
  perform public.audit('invite.revoked', p_rider);
end $$;

-- ---------------------------------------------------------------- coach roster view
-- security_invoker: the view runs with the caller's rights, so RLS above decides what it returns.
create or replace view public.coach_riders with (security_invoker = true) as
select
  r.id, r.profile_id, r.coach_id, r.created_at, r.claimed_at, r.founding_at, r.sessions_before, r.member_since,
  coalesce(p.first_name, r.first_name) as first_name,
  coalesce(p.last_name, r.last_name)   as last_name,
  coalesce(p.phone, r.phone)           as phone,
  coalesce(p.instagram, r.instagram)   as instagram,
  r.email,
  p.photo_url,
  l.band, l.self_band, l.verified_at,
  (select c.first_name from profiles c where c.id = r.coach_id) as coach_name,
  case
    when r.profile_id is not null then 'claimed'
    when inv.id is null then 'needs_link'
    when inv.expires_at < now() then 'expired'
    else 'ready' end as invite_status,
  inv.created_at as invite_created_at,
  inv.expires_at as invite_expires_at
from riders r
left join profiles p on p.id = r.profile_id
left join rider_levels l on l.rider_id = r.id
left join lateral (
  select * from invites i where i.rider_id = r.id and i.used_at is null and i.revoked_at is null
  order by i.created_at desc limit 1
) inv on true;
grant select on public.coach_riders to authenticated;

-- The signed-in rider's own card: identity, level, founding, coach.
create or replace view public.my_rider with (security_invoker = true) as
select r.id, r.founding_at, r.sessions_before, r.member_since, r.claimed_at, r.created_by is not null as coach_added,
       l.band, l.self_band, l.verified_at,
       (select c.first_name from profiles c where c.id = l.verified_by) as verified_by_name,
       (select c.first_name from profiles c where c.id = r.coach_id) as coach_name
from riders r
left join rider_levels l on l.rider_id = r.id
where r.profile_id = auth.uid();
grant select on public.my_rider to authenticated;

-- ---------------------------------------------------------------- profile photos
-- Public bucket (photos show on cards); each person writes only inside their own folder: avatars/{uid}/...
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 3145728, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy avatars_insert_own on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy avatars_update_own on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy avatars_delete_own on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
