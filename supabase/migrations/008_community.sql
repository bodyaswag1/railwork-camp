-- Community (everything opt-in, off by default) + badge awarding + the nightly job.
--   listed       "Show me in the rider directory": directory, feed items about you, camp crew, ride board
--   ask_to_ride  "Let riders ask to ride with me": contact details are shared only after both say yes
-- The feed has three kinds of item only: joined, level confirmed by a coach, trick landed (+ camps and events
-- posted by BAS). No results, no rankings. Turning listing off hides every item about you, retroactively.

alter table public.profiles
  add column listed       boolean not null default false,
  add column ask_to_ride  boolean not null default false,
  add column announced_at timestamptz;
grant update (listed, ask_to_ride) on public.profiles to authenticated;

-- display name everywhere in the community: first name + last initial
create or replace function public.short_name(p_first text, p_last text) returns text language sql immutable as $$
  select trim(coalesce(p_first, 'Rider') || coalesce(' ' || left(p_last, 1) || '.', ''));
$$;

-- ---------------------------------------------------------------- feed
create table public.feed_items (
  id         bigint generated always as identity primary key,
  kind       text not null check (kind in ('joined', 'level', 'trick', 'camp', 'event')),
  rider_id   uuid references public.riders (id) on delete cascade,
  payload    jsonb not null default '{}',
  created_by uuid,
  created_at timestamptz not null default now()
);
create index feed_time_idx on public.feed_items (created_at desc);
alter table public.feed_items enable row level security;
-- reads go through community_feed(); staff may post events directly
create policy feed_staff on public.feed_items for all to authenticated using (public.is_staff()) with check (public.is_staff() and kind in ('event', 'camp'));
revoke all on public.feed_items from anon;

-- joined: the first time a rider turns listing on (never re-announced)
create or replace function public.feed_on_listed() returns trigger
language plpgsql security definer set search_path = public as $$
declare rid uuid;
begin
  if new.listed and not coalesce(old.listed, false) and new.announced_at is null and new.role = 'rider' then
    select id into rid from riders where profile_id = new.id;
    if rid is not null then
      insert into feed_items (kind, rider_id, payload) values ('joined', rid,
        jsonb_build_object('band', (select coalesce(band, self_band) from rider_levels where rider_id = rid), 'disciplines', new.disciplines));
      new.announced_at := now();
    end if;
  end if;
  return new;
end $$;
create trigger profiles_feed_listed before update of listed on public.profiles
  for each row execute function public.feed_on_listed();

-- level: only a coach-verified change of band
create or replace function public.feed_on_level() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.band is not null and new.band is distinct from old.band then
    insert into feed_items (kind, rider_id, payload, created_by) values ('level', new.rider_id, jsonb_build_object('band', new.band), new.verified_by);
  end if;
  return new;
end $$;
create trigger levels_feed_update after update on public.rider_levels for each row execute function public.feed_on_level();
create or replace function public.feed_on_level_insert() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.band is not null then
    insert into feed_items (kind, rider_id, payload, created_by) values ('level', new.rider_id, jsonb_build_object('band', new.band), new.verified_by);
  end if;
  return new;
end $$;
create trigger levels_feed_insert after insert on public.rider_levels for each row execute function public.feed_on_level_insert();

-- trick: when a coach marks it landed
create or replace function public.feed_on_trick() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'landed' and (tg_op = 'INSERT' or old.status is distinct from 'landed') then
    insert into feed_items (kind, rider_id, payload, created_by)
    values ('trick', new.rider_id, jsonb_build_object('trick', (select name from tricks where id = new.trick_id)), new.confirmed_by);
  end if;
  return new;
end $$;
create trigger tricks_feed after insert or update on public.trick_progress for each row execute function public.feed_on_trick();

-- camp: when a camp opens
create or replace function public.feed_on_camp() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'open' and (tg_op = 'INSERT' or old.status is distinct from 'open') then
    insert into feed_items (kind, payload) values ('camp', jsonb_build_object('camp', new.id, 'title', new.title, 'place', new.place, 'starts_on', new.starts_on));
  end if;
  return new;
end $$;
create trigger camps_feed after insert or update of status on public.camps for each row execute function public.feed_on_camp();

-- The feed for signed-in riders: items about riders who are listed right now (so unlisting hides history too),
-- plus BAS posts. Newest 40.
create or replace function public.community_feed(p_limit integer default 40) returns table (
  id bigint, kind text, created_at timestamptz, rider_id uuid, name text, photo_url text, payload jsonb)
language sql stable security definer set search_path = public as $$
  select f.id, f.kind, f.created_at, f.rider_id,
         case when f.rider_id is null then 'BAS CAMP' else public.short_name(p.first_name, p.last_name) end,
         p.photo_url, f.payload
  from feed_items f
  left join riders r on r.id = f.rider_id
  left join profiles p on p.id = r.profile_id
  where auth.uid() is not null and (f.rider_id is null or coalesce(p.listed, false))
  order by f.created_at desc
  limit least(greatest(p_limit, 1), 100);
$$;
grant execute on function public.community_feed(integer) to authenticated;

-- ---------------------------------------------------------------- directory
create or replace function public.community_directory(p_discipline text default null, p_band smallint default null, p_q text default null)
returns table (rider_id uuid, name text, photo_url text, disciplines text[], band smallint, verified boolean, home_resort text,
               terrain text[], favorite_trick text, riding_since smallint, bio text, ask_to_ride boolean, tricks_landed integer)
language sql stable security definer set search_path = public as $$
  select r.id, public.short_name(p.first_name, p.last_name), p.photo_url, p.disciplines, coalesce(l.band, l.self_band), l.band is not null,
         p.home_resort, p.terrain, p.favorite_trick, p.riding_since, p.bio, p.ask_to_ride,
         (select count(*) from trick_progress t where t.rider_id = r.id and t.status = 'landed')::int
  from riders r join profiles p on p.id = r.profile_id left join rider_levels l on l.rider_id = r.id
  where auth.uid() is not null and p.listed and p.role = 'rider'
    and (p_discipline is null or p_discipline = any (p.disciplines))
    and (p_band is null or abs(coalesce(l.band, l.self_band, -10) - p_band) <= 1)
    and (p_q is null or p.home_resort ilike '%' || p_q || '%' or p.first_name ilike p_q || '%')
  order by p.first_name;
$$;
grant execute on function public.community_directory(text, smallint, text) to authenticated;

-- a listed rider's card: what the directory shows, plus earned badges and landed tricks
create or replace function public.rider_card(p_rider uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select case when p.listed or r.profile_id = auth.uid() or public.is_staff() then jsonb_build_object(
    'name', public.short_name(p.first_name, p.last_name), 'photo_url', p.photo_url, 'disciplines', p.disciplines,
    'band', coalesce(l.band, l.self_band), 'verified', l.band is not null, 'home_resort', p.home_resort, 'terrain', p.terrain,
    'favorite_trick', p.favorite_trick, 'favorite_brand', p.favorite_brand, 'riding_since', p.riding_since, 'bio', p.bio,
    'ask_to_ride', p.ask_to_ride,
    'badges', (select coalesce(jsonb_agg(jsonb_build_object('title', b.title, 'at', a.awarded_at) order by b.sort), '[]')
               from badge_awards a join badges b on b.key = a.badge_key where a.rider_id = r.id),
    'tricks', (select coalesce(jsonb_agg(t.name order by tp.landed_at), '[]') from trick_progress tp join tricks t on t.id = tp.trick_id
               where tp.rider_id = r.id and tp.status = 'landed')) end
  from riders r join profiles p on p.id = r.profile_id left join rider_levels l on l.rider_id = r.id
  where r.id = p_rider and auth.uid() is not null;
$$;
grant execute on function public.rider_card(uuid) to authenticated;

-- ---------------------------------------------------------------- ride together
create table public.ride_posts (
  id         uuid primary key default gen_random_uuid(),
  rider_id   uuid not null references public.riders (id) on delete cascade,
  place      text not null check (char_length(place) between 2 and 80),
  ride_date  date not null,
  note       text check (char_length(note) <= 280),
  created_at timestamptz not null default now()
);
create table public.ride_requests (
  id           uuid primary key default gen_random_uuid(),
  post_id      uuid not null references public.ride_posts (id) on delete cascade,
  from_rider   uuid not null references public.riders (id) on delete cascade,
  message      text check (char_length(message) <= 280),
  status       text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  created_at   timestamptz not null default now(),
  responded_at timestamptz,
  unique (post_id, from_rider)
);
alter table public.ride_posts enable row level security;
alter table public.ride_requests enable row level security;
revoke all on public.ride_posts, public.ride_requests from anon, authenticated;
grant select on public.ride_posts, public.ride_requests to authenticated;
create policy posts_own on public.ride_posts for select to authenticated using (rider_id = public.my_rider_id() or public.is_staff());
create policy reqs_own on public.ride_requests for select to authenticated
  using (from_rider = public.my_rider_id() or public.is_staff() or exists (select 1 from ride_posts p where p.id = post_id and p.rider_id = public.my_rider_id()));

-- 'ok' | 'not_listed' | 'past'
create or replace function public.post_ride(p_place text, p_date date, p_note text default null) returns text
language plpgsql security definer set search_path = public as $$
begin
  if not coalesce((select listed from profiles where id = auth.uid()), false) then return 'not_listed'; end if;
  if p_date < (now() at time zone public.bas_tz())::date then return 'past'; end if;
  insert into ride_posts (rider_id, place, ride_date, note) values (public.ensure_my_rider(), trim(p_place), p_date, nullif(trim(p_note), ''));
  return 'ok';
end $$;
grant execute on function public.post_ride(text, date, text) to authenticated;

create or replace function public.delete_ride(p_post uuid) returns void
language sql security definer set search_path = public as $$
  delete from ride_posts where id = p_post and rider_id = public.my_rider_id();
$$;
grant execute on function public.delete_ride(uuid) to authenticated;

-- upcoming posts from listed riders, with the caller's own request status
create or replace function public.ride_board() returns table (
  id uuid, rider_id uuid, name text, photo_url text, band smallint, disciplines text[], place text, ride_date date, note text,
  can_ask boolean, mine boolean, my_request text, pending_for_me integer)
language sql stable security definer set search_path = public as $$
  select rp.id, rp.rider_id, public.short_name(p.first_name, p.last_name), p.photo_url, coalesce(l.band, l.self_band), p.disciplines,
         rp.place, rp.ride_date, rp.note, p.ask_to_ride and rp.rider_id <> coalesce(public.my_rider_id(), '00000000-0000-0000-0000-000000000000'),
         rp.rider_id = public.my_rider_id(),
         (select q.status from ride_requests q where q.post_id = rp.id and q.from_rider = public.my_rider_id()),
         case when rp.rider_id = public.my_rider_id() then (select count(*) from ride_requests q where q.post_id = rp.id and q.status = 'pending')::int end
  from ride_posts rp join riders r on r.id = rp.rider_id join profiles p on p.id = r.profile_id left join rider_levels l on l.rider_id = r.id
  where auth.uid() is not null and p.listed and rp.ride_date >= (now() at time zone public.bas_tz())::date
  order by rp.ride_date, rp.created_at;
$$;
grant execute on function public.ride_board() to authenticated;

-- 'ok' | 'closed' (they do not take requests / unlisted) | 'own' | 'already' | 'not_listed' (caller must be visible too)
create or replace function public.ask_to_ride(p_post uuid, p_message text default null) returns text
language plpgsql security definer set search_path = public as $$
declare rp ride_posts; me uuid := public.ensure_my_rider();
begin
  select * into rp from ride_posts where id = p_post;
  if rp.id is null or not exists (select 1 from riders r join profiles p on p.id = r.profile_id where r.id = rp.rider_id and p.listed and p.ask_to_ride) then return 'closed'; end if;
  if rp.rider_id = me then return 'own'; end if;
  if not coalesce((select listed from profiles where id = auth.uid()), false) then return 'not_listed'; end if;
  insert into ride_requests (post_id, from_rider, message) values (p_post, me, nullif(trim(p_message), '')) on conflict do nothing;
  return case when found then 'ok' else 'already' end;
end $$;
grant execute on function public.ask_to_ride(uuid, text) to authenticated;

-- requests on my posts, with the asker's public card bits
create or replace function public.my_ride_requests() returns table (id uuid, post_id uuid, place text, ride_date date, from_rider uuid, name text, band smallint, message text, status text)
language sql stable security definer set search_path = public as $$
  select q.id, rp.id, rp.place, rp.ride_date, q.from_rider, public.short_name(p.first_name, p.last_name), coalesce(l.band, l.self_band), q.message, q.status
  from ride_requests q join ride_posts rp on rp.id = q.post_id join riders r on r.id = q.from_rider join profiles p on p.id = r.profile_id
  left join rider_levels l on l.rider_id = r.id
  where rp.rider_id = public.my_rider_id() order by q.created_at desc;
$$;
grant execute on function public.my_ride_requests() to authenticated;

create or replace function public.respond_ride_request(p_request uuid, p_accept boolean) returns text
language plpgsql security definer set search_path = public as $$
begin
  update ride_requests q set status = case when p_accept then 'accepted' else 'declined' end, responded_at = now()
  from ride_posts rp where rp.id = q.post_id and q.id = p_request and rp.rider_id = public.my_rider_id() and q.status = 'pending';
  return case when found then 'ok' else 'not_found' end;
end $$;
grant execute on function public.respond_ride_request(uuid, boolean) to authenticated;

-- Contact details, only between two riders with an accepted request (either direction). The one place a full
-- name, phone, Instagram and email are shown to another rider.
create or replace function public.my_ride_contacts() returns table (place text, ride_date date, name text, phone text, instagram text, email text)
language sql stable security definer set search_path = public as $$
  with mine as (select public.my_rider_id() id),
  pairs as (
    select rp.place, rp.ride_date, case when rp.rider_id = (select id from mine) then q.from_rider else rp.rider_id end other
    from ride_requests q join ride_posts rp on rp.id = q.post_id
    where q.status = 'accepted' and ((select id from mine) in (rp.rider_id, q.from_rider))
  )
  select x.place, x.ride_date, trim(coalesce(p.first_name, '') || ' ' || coalesce(p.last_name, '')), p.phone, p.instagram, u.email
  from pairs x join riders r on r.id = x.other join profiles p on p.id = r.profile_id join auth.users u on u.id = p.id
  order by x.ride_date;
$$;
grant execute on function public.my_ride_contacts() to authenticated;

-- ---------------------------------------------------------------- highlights (consistency only, no ranking)
create or replace function public.community_highlights() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'levels', (select coalesce(jsonb_agg(x), '[]') from (
        select public.short_name(p.first_name, p.last_name) name, l.band, l.verified_at at
        from rider_levels l join riders r on r.id = l.rider_id join profiles p on p.id = r.profile_id
        where p.listed and l.band is not null and l.verified_at > now() - interval '30 days' order by l.verified_at desc limit 10) x),
    'tricks', (select coalesce(jsonb_agg(x), '[]') from (
        select public.short_name(p.first_name, p.last_name) name, t.name trick, tp.landed_at at
        from trick_progress tp join tricks t on t.id = tp.trick_id join riders r on r.id = tp.rider_id join profiles p on p.id = r.profile_id
        where p.listed and tp.status = 'landed' and tp.landed_at > date_trunc('month', now()) order by tp.landed_at desc limit 20) x),
    'active', (select coalesce(jsonb_agg(x), '[]') from (
        select public.short_name(p.first_name, p.last_name) name, count(*)::int sessions
        from bookings b join sessions s on s.id = b.session_id join riders r on r.id = b.rider_id join profiles p on p.id = r.profile_id
        where p.listed and b.status = 'attended' and s.starts_at > date_trunc('month', now())
        group by p.first_name, p.last_name having count(*) >= 2 order by p.first_name limit 20) x))
  where auth.uid() is not null;
$$;
grant execute on function public.community_highlights() to authenticated;

-- ---------------------------------------------------------------- badges
-- Awards every badge a rider has earned and does not hold yet. Never removes one. Safe to run any time.
create or replace function public.award_badges() returns integer
language plpgsql security definer set search_path = public as $$
declare r record; n integer := 0; k text; earned text[];
begin
  for r in select id, founding_at, sessions_before from riders loop
    earned := '{}';
    if r.founding_at is not null then earned := earned || 'founding_rider'::text; end if;
    declare att integer; tramp integer; best integer; landed integer; camps integer;
    begin
      select count(*), count(*) filter (where s.kind = 'trampoline') into att, tramp
      from bookings b join sessions s on s.id = b.session_id where b.rider_id = r.id and b.status = 'attended';
      best := public._longest_streak(r.id);
      select count(*) into landed from trick_progress where rider_id = r.id and status = 'landed';
      select count(*) into camps from camp_entries where rider_id = r.id and status = 'attended';
      if att >= 1 then earned := earned || 'first_session'::text; end if;
      if tramp >= 1 then earned := earned || 'first_trampoline'::text; end if;
      if att + coalesce(r.sessions_before, 0) >= 10 then earned := earned || 'ten_sessions'::text; end if;
      if best >= 4 then earned := earned || 'streak_4w'::text; end if;
      if best >= 12 then earned := earned || 'streak_12w'::text; end if;
      if landed >= 1 then earned := earned || 'first_trick'::text; end if;
      if landed >= 5 then earned := earned || 'five_tricks'::text; end if;
      if camps >= 1 then earned := earned || 'first_camp'::text; end if;
    end;
    foreach k in array earned loop
      insert into badge_awards (rider_id, badge_key) values (r.id, k) on conflict do nothing;
      if found then n := n + 1; end if;
    end loop;
  end loop;
  return n;
end $$;
revoke execute on function public.award_badges() from public, anon, authenticated;

-- longest weekly streak for one rider (same rules as rider_stats)
create or replace function public._longest_streak(p_rider uuid) returns integer
language plpgsql stable security definer set search_path = public as $$
declare tz text := public.bas_tz(); w0 date := date_trunc('week', now() at time zone tz)::date; first_w date; w date; run integer := 0; best integer := 0;
begin
  select min(date_trunc('week', s.starts_at at time zone tz))::date into first_w
  from bookings b join sessions s on s.id = b.session_id where b.rider_id = p_rider and b.status = 'attended';
  if first_w is null then return 0; end if;
  for w in select g::date from generate_series(first_w, w0, interval '1 week') g loop
    if exists (select 1 from bookings b join sessions s on s.id = b.session_id where b.rider_id = p_rider and b.status = 'attended'
               and date_trunc('week', s.starts_at at time zone tz)::date = w) then run := run + 1;
    elsif w = w0 then null;
    elsif exists (select 1 from absences a where a.rider_id = p_rider and a.from_date <= w + 6 and a.to_date >= w) then null;
    else run := 0;
    end if;
    best := greatest(best, run);
  end loop;
  return best;
end $$;
revoke execute on function public._longest_streak(uuid) from public, anon, authenticated;

-- coaches can run the badge pass by hand (button on the coach panel); it runs nightly anyway
create or replace function public.run_badges() returns integer
language plpgsql security definer set search_path = public as $$
begin
  perform public.require_staff();
  return public.award_badges();
end $$;

-- ---------------------------------------------------------------- nightly job
create or replace function public.nightly() returns jsonb
language plpgsql security definer set search_path = public as $$
declare booked integer; awarded integer;
begin
  booked := public.nightly_loops();
  awarded := public.award_badges();
  delete from rate_hits where at < now() - interval '1 day';
  insert into audit_log (action, payload) values ('nightly', jsonb_build_object('loop_bookings', booked, 'badges', awarded));
  return jsonb_build_object('loop_bookings', booked, 'badges', awarded);
end $$;
revoke execute on function public.nightly() from public, anon, authenticated;
