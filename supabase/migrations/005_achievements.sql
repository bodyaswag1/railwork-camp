-- Achievements: the trick book, coach focus areas, badges.
-- Rules (from the spec): only a coach marks a trick "landed" or moves a level; a rider can only say "working on
-- it". Badges are about showing up and are never taken away. No rankings anywhere.

-- the signed-in person's rider id (null if they have none yet)
create or replace function public.my_rider_id() returns uuid
language sql stable security definer set search_path = public as $$
  select id from riders where profile_id = auth.uid();
$$;
grant execute on function public.my_rider_id() to authenticated;

-- ---------------------------------------------------------------- trick book
create table public.tricks (
  id         serial primary key,
  slug       text not null unique,
  name       text not null,
  category   text not null check (category in ('basics', 'jumps', 'spins', 'rails', 'butters', 'trampoline')),
  discipline text not null default 'both' check (discipline in ('snowboard', 'ski', 'both')),
  sort       integer not null default 0,
  active     boolean not null default true
);

-- Starter catalogue for Ilia to edit. Grouped as on the spec; sort = rough order of difficulty.
insert into public.tricks (slug, name, category, discipline, sort) values
  ('linked-turns', 'Linked turns', 'basics', 'both', 10),
  ('carve', 'Clean carve on red', 'basics', 'both', 20),
  ('switch-riding', 'Riding switch', 'basics', 'both', 30),
  ('ollie', 'Ollie', 'basics', 'snowboard', 40),
  ('nollie', 'Nollie', 'basics', 'snowboard', 50),
  ('straight-air', 'Straight air', 'jumps', 'both', 10),
  ('grab-indy', 'Indy grab', 'jumps', 'snowboard', 20),
  ('grab-mute', 'Mute grab', 'jumps', 'both', 30),
  ('grab-method', 'Method', 'jumps', 'snowboard', 40),
  ('grab-safety', 'Safety grab', 'jumps', 'ski', 25),
  ('fs-180', 'Frontside 180', 'spins', 'snowboard', 10),
  ('bs-180', 'Backside 180', 'spins', 'snowboard', 20),
  ('fs-360', 'Frontside 360', 'spins', 'both', 30),
  ('bs-360', 'Backside 360', 'spins', 'snowboard', 40),
  ('540', '540', 'spins', 'both', 50),
  ('720', '720', 'spins', 'both', 60),
  ('bs-rodeo', 'Backside rodeo', 'spins', 'snowboard', 70),
  ('box-5050', '50-50 on a box', 'rails', 'both', 10),
  ('boardslide', 'Boardslide', 'rails', 'snowboard', 20),
  ('lipslide', 'Lipslide', 'rails', 'snowboard', 30),
  ('rail-5050', '50-50 on a rail', 'rails', 'both', 40),
  ('270-on', '270 on', 'rails', 'both', 50),
  ('nose-press', 'Nose press', 'butters', 'both', 10),
  ('tail-press', 'Tail press', 'butters', 'both', 20),
  ('butter-180', 'Butter 180', 'butters', 'both', 30),
  ('butter-360', 'Butter 360', 'butters', 'both', 40),
  ('tramp-straight', 'Straight jump with stable landing', 'trampoline', 'both', 10),
  ('tramp-360', '360 on the trampoline', 'trampoline', 'both', 20),
  ('tramp-backflip', 'Backflip', 'trampoline', 'both', 30),
  ('tramp-frontflip', 'Frontflip', 'trampoline', 'both', 40),
  ('tramp-rodeo', 'Rodeo on the trampoline', 'trampoline', 'both', 50);

create table public.trick_progress (
  rider_id     uuid not null references public.riders (id) on delete cascade,
  trick_id     integer not null references public.tricks (id) on delete cascade,
  status       text not null check (status in ('working', 'landed')),
  landed_at    timestamptz,
  confirmed_by uuid references public.profiles (id) on delete set null,
  clip_url     text check (clip_url ~ '^https://'),
  updated_at   timestamptz not null default now(),
  primary key (rider_id, trick_id)
);

-- ---------------------------------------------------------------- focus areas
create table public.focus_areas (
  id         uuid primary key default gen_random_uuid(),
  rider_id   uuid not null references public.riders (id) on delete cascade,
  coach_id   uuid references public.profiles (id) on delete set null,
  text       text not null check (char_length(text) between 3 and 240),
  status     text not null default 'open' check (status in ('open', 'nailed')),
  created_at timestamptz not null default now(),
  closed_at  timestamptz
);
create index focus_rider_idx on public.focus_areas (rider_id);

-- ---------------------------------------------------------------- badges (catalogue is data, not code)
create table public.badges (
  key         text primary key,
  title       text not null,
  description text not null,
  sort        integer not null default 0
);
insert into public.badges (key, title, description, sort) values
  ('founding_rider', 'Founding rider', 'Riding with BAS before the app existed.', 0),
  ('first_session', 'First session', 'Showed up once. The hardest one.', 10),
  ('first_trampoline', 'First trampoline', 'First trampoline session: air awareness starts here.', 20),
  ('ten_sessions', 'Ten sessions', 'Ten sessions in. The habit is real.', 30),
  ('streak_4w', 'Four weeks running', 'A session every week for four weeks. Trips pause it, they do not break it.', 40),
  ('streak_12w', 'Twelve weeks running', 'A session every week for twelve weeks.', 50),
  ('first_trick', 'First trick landed', 'Your coach signed off your first trick.', 60),
  ('five_tricks', 'Five tricks landed', 'Five tricks in the book, signed off by a coach.', 70),
  ('first_camp', 'First camp', 'Went to a BAS CAMP.', 80);

create table public.badge_awards (
  rider_id   uuid not null references public.riders (id) on delete cascade,
  badge_key  text not null references public.badges (key) on delete cascade,
  awarded_at timestamptz not null default now(),
  primary key (rider_id, badge_key)
);

-- ---------------------------------------------------------------- RLS
alter table public.tricks enable row level security;
alter table public.trick_progress enable row level security;
alter table public.focus_areas enable row level security;
alter table public.badges enable row level security;
alter table public.badge_awards enable row level security;

create policy tricks_read on public.tricks for select to anon, authenticated using (true);
create policy tricks_staff on public.tricks for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy badges_read on public.badges for select to anon, authenticated using (true);

create policy tp_read on public.trick_progress for select to authenticated
  using (rider_id = public.my_rider_id() or public.is_staff());
create policy focus_read on public.focus_areas for select to authenticated
  using (rider_id = public.my_rider_id() or public.is_staff());
create policy awards_read on public.badge_awards for select to authenticated
  using (rider_id = public.my_rider_id() or public.is_staff());
revoke insert, update, delete on public.trick_progress, public.focus_areas, public.badge_awards from anon, authenticated;
revoke insert, update, delete on public.badges from anon, authenticated;

-- ---------------------------------------------------------------- rider: "working on it"
create or replace function public.set_trick_working(p_trick integer, p_on boolean) returns text
language plpgsql security definer set search_path = public as $$
declare rid uuid := public.ensure_my_rider(); cur text;
begin
  select status into cur from trick_progress where rider_id = rid and trick_id = p_trick;
  if cur = 'landed' then return 'landed'; end if;          -- a landed trick stays landed
  if p_on then
    insert into trick_progress (rider_id, trick_id, status) values (rid, p_trick, 'working')
    on conflict (rider_id, trick_id) do nothing;
  else
    delete from trick_progress where rider_id = rid and trick_id = p_trick and status = 'working';
  end if;
  return 'ok';
end $$;

-- ---------------------------------------------------------------- coach: tricks + focus areas
create or replace function public.confirm_trick(p_rider uuid, p_trick integer, p_clip text default null) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.require_staff();
  insert into trick_progress (rider_id, trick_id, status, landed_at, confirmed_by, clip_url, updated_at)
  values (p_rider, p_trick, 'landed', now(), auth.uid(), nullif(trim(p_clip), ''), now())
  on conflict (rider_id, trick_id) do update set status = 'landed', landed_at = coalesce(trick_progress.landed_at, now()),
    confirmed_by = auth.uid(), clip_url = coalesce(excluded.clip_url, trick_progress.clip_url), updated_at = now();
  perform public.audit('trick.landed', p_rider, jsonb_build_object('trick', p_trick));
end $$;

-- for a mis-tap: a coach can take a "landed" back to "working"
create or replace function public.unconfirm_trick(p_rider uuid, p_trick integer) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.require_staff();
  update trick_progress set status = 'working', landed_at = null, confirmed_by = null, updated_at = now()
  where rider_id = p_rider and trick_id = p_trick;
  perform public.audit('trick.unconfirmed', p_rider, jsonb_build_object('trick', p_trick));
end $$;

create or replace function public.add_focus(p_rider uuid, p_text text) returns uuid
language plpgsql security definer set search_path = public as $$
declare fid uuid;
begin
  perform public.require_staff();
  insert into focus_areas (rider_id, coach_id, text) values (p_rider, auth.uid(), trim(p_text)) returning id into fid;
  return fid;
end $$;

create or replace function public.set_focus_status(p_focus uuid, p_status text) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.require_staff();
  if p_status not in ('open', 'nailed') then raise exception 'bad status' using errcode = '22023'; end if;
  update focus_areas set status = p_status, closed_at = case when p_status = 'nailed' then now() end where id = p_focus;
end $$;

create or replace function public.remove_focus(p_focus uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.require_staff();
  delete from focus_areas where id = p_focus;
end $$;

-- the coach's name on a focus area / landed trick: riders may read coach profiles already (001)
