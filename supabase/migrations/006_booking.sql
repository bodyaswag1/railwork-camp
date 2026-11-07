-- Booking. Two kinds of bookable session: personal (1:1 on the slope, capacity 1-2) and trampoline (group).
-- Camps are their own thing (007). Rules taken from the spec:
--   * browsing is open, booking needs an account; payment is offline (coach marks paid)
--   * free cancellation until 48 h before; inside 48 h the rider is sent to the coach
--   * "move" books the new time first and only then releases the old one
--   * trampoline sessions can carry a level range: no level → book a personal first; 2+ bands below → no
--   * weekly loop: the rider asks, the coach approves, a nightly job books 4 weeks ahead; a trip pauses it
--   * packs: prepaid credits the coach sells; a booking uses one, a cancellation gives it back

create or replace function public.bas_tz() returns text language sql immutable as $$ select 'Europe/Vienna' $$;

-- ---------------------------------------------------------------- catalogue
create table public.venues (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (char_length(name) between 2 and 80),
  kind       text not null check (kind in ('resort', 'trampoline')),
  town       text,
  country    text,
  notes      text,
  created_at timestamptz not null default now()
);
insert into public.venues (name, kind, town, country) values ('Livigno', 'resort', 'Livigno', 'Italy');

create table public.sessions (
  id         uuid primary key default gen_random_uuid(),
  kind       text not null check (kind in ('personal', 'trampoline')),
  title      text not null check (char_length(title) between 2 and 80),
  coach_id   uuid references public.profiles (id) on delete set null,
  venue_id   uuid references public.venues (id) on delete set null,
  starts_at  timestamptz not null,
  ends_at    timestamptz not null check (ends_at > starts_at and ends_at <= starts_at + interval '12 hours'),
  capacity   integer not null check (capacity between 1 and 40),
  price_eur  numeric(8, 2) check (price_eur >= 0),
  level_min  smallint check (level_min between 1 and 7),
  level_max  smallint check (level_max between 1 and 7),
  notes      text check (char_length(notes) <= 500),
  status     text not null default 'open' check (status in ('open', 'cancelled')),
  loop_id    uuid,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index sessions_time_idx on public.sessions (starts_at);

create table public.packs (
  id             uuid primary key default gen_random_uuid(),
  rider_id       uuid not null references public.riders (id) on delete cascade,
  kind           text not null check (kind in ('personal', 'trampoline')),
  sessions_total integer not null check (sessions_total between 1 and 100),
  sessions_used  integer not null default 0 check (sessions_used >= 0),
  valid_until    date,
  price_eur      numeric(8, 2),
  paid_at        timestamptz,
  created_by     uuid references public.profiles (id) on delete set null,
  created_at     timestamptz not null default now(),
  check (sessions_used <= sessions_total)
);

create table public.bookings (
  id           uuid primary key default gen_random_uuid(),
  session_id   uuid not null references public.sessions (id) on delete cascade,
  rider_id     uuid not null references public.riders (id) on delete cascade,
  status       text not null default 'reserved' check (status in ('reserved', 'paid', 'cancelled', 'attended', 'no_show')),
  source       text not null default 'self' check (source in ('self', 'coach', 'loop')),
  pack_id      uuid references public.packs (id) on delete set null,
  paid_at      timestamptz,
  cancelled_at timestamptz,
  cancelled_by uuid,
  marked_by    uuid,
  created_at   timestamptz not null default now()
);
create unique index bookings_one_live on public.bookings (session_id, rider_id) where status <> 'cancelled';
create index bookings_rider_idx on public.bookings (rider_id);

create table public.loops (
  id             uuid primary key default gen_random_uuid(),
  rider_id       uuid not null references public.riders (id) on delete cascade,
  coach_id       uuid references public.profiles (id) on delete set null,
  kind           text not null check (kind in ('personal', 'trampoline')),
  weekday        smallint not null check (weekday between 1 and 7),   -- ISO: 1 = Monday
  start_time     time not null,
  minutes        integer not null check (minutes between 15 and 720),
  venue_id       uuid references public.venues (id) on delete set null,
  title          text not null,
  price_eur      numeric(8, 2),
  status         text not null default 'requested' check (status in ('requested', 'active', 'ended', 'declined')),
  change_request text check (char_length(change_request) between 3 and 500),
  decided_by     uuid,
  decided_at     timestamptz,
  created_at     timestamptz not null default now()
);
alter table public.sessions add constraint sessions_loop_fk foreign key (loop_id) references public.loops (id) on delete set null;

create table public.absences (
  id         uuid primary key default gen_random_uuid(),
  rider_id   uuid not null references public.riders (id) on delete cascade,
  from_date  date not null,
  to_date    date not null check (to_date >= from_date),
  note       text check (char_length(note) <= 280),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- RLS
alter table public.venues enable row level security;
alter table public.sessions enable row level security;
alter table public.packs enable row level security;
alter table public.bookings enable row level security;
alter table public.loops enable row level security;
alter table public.absences enable row level security;

create policy venues_read on public.venues for select to anon, authenticated using (true);
create policy venues_staff on public.venues for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy sessions_read on public.sessions for select to anon, authenticated using (true);
create policy sessions_staff on public.sessions for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy packs_read on public.packs for select to authenticated using (rider_id = public.my_rider_id() or public.is_staff());
create policy bookings_read on public.bookings for select to authenticated using (rider_id = public.my_rider_id() or public.is_staff());
create policy loops_read on public.loops for select to authenticated using (rider_id = public.my_rider_id() or public.is_staff());
create policy absences_read on public.absences for select to authenticated using (rider_id = public.my_rider_id() or public.is_staff());
create policy absences_own_insert on public.absences for insert to authenticated with check (rider_id = public.my_rider_id());
create policy absences_own_delete on public.absences for delete to authenticated using (rider_id = public.my_rider_id());
revoke insert, update, delete on public.packs, public.bookings, public.loops from anon, authenticated;
revoke update on public.absences from anon, authenticated;

-- ---------------------------------------------------------------- browse
-- Upcoming sessions with seats left (riders cannot read each other's bookings, so the count comes from here).
create or replace function public.open_sessions(p_from timestamptz default now(), p_to timestamptz default now() + interval '56 days', p_kind text default null)
returns table (id uuid, kind text, title text, starts_at timestamptz, ends_at timestamptz, venue text, coach text,
               capacity integer, seats_left integer, price_eur numeric, level_min smallint, level_max smallint, notes text,
               my_booking uuid, my_status text)
language sql stable security definer set search_path = public as $$
  select s.id, s.kind, s.title, s.starts_at, s.ends_at, v.name, c.first_name, s.capacity,
         s.capacity - (select count(*) from bookings b where b.session_id = s.id and b.status <> 'cancelled')::int,
         s.price_eur, s.level_min, s.level_max, s.notes,
         mb.id, mb.status
  from sessions s
  left join venues v on v.id = s.venue_id
  left join profiles c on c.id = s.coach_id
  left join lateral (select b.id, b.status from bookings b where b.session_id = s.id and b.rider_id = public.my_rider_id()
                     and b.status <> 'cancelled' limit 1) mb on true
  where s.status = 'open' and s.starts_at >= p_from and s.starts_at < p_to and (p_kind is null or s.kind = p_kind)
  order by s.starts_at;
$$;
grant execute on function public.open_sessions(timestamptz, timestamptz, text) to anon, authenticated;

-- ---------------------------------------------------------------- the one place a booking is made
-- Internal: rider, session, whether to use a pack credit, source, whether the level gate applies.
-- Returns {status, booking}. status: ok | not_found | closed | started | full | already | need_level | level_too_low
create or replace function public._book(p_rider uuid, p_session uuid, p_use_pack boolean, p_source text, p_gate boolean, p_pack uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare s sessions; band smallint; taken integer; pk uuid := p_pack; bid uuid;
begin
  select * into s from sessions where id = p_session for update;      -- serialises seat counting per session
  if s.id is null then return jsonb_build_object('status', 'not_found'); end if;
  if s.status <> 'open' then return jsonb_build_object('status', 'closed'); end if;
  if s.starts_at <= now() then return jsonb_build_object('status', 'started'); end if;
  if exists (select 1 from bookings where session_id = s.id and rider_id = p_rider and status <> 'cancelled') then
    return jsonb_build_object('status', 'already');
  end if;
  select count(*) into taken from bookings where session_id = s.id and status <> 'cancelled';
  if taken >= s.capacity then return jsonb_build_object('status', 'full'); end if;
  if p_gate and s.level_min is not null then
    select coalesce(l.band, l.self_band) into band from rider_levels l where l.rider_id = p_rider;
    if band is null then return jsonb_build_object('status', 'need_level'); end if;
    if band < s.level_min - 1 then return jsonb_build_object('status', 'level_too_low'); end if;
  end if;
  if pk is null and p_use_pack then
    select id into pk from packs
    where rider_id = p_rider and kind = s.kind and sessions_used < sessions_total
      and (valid_until is null or valid_until >= (s.starts_at at time zone public.bas_tz())::date)
    order by valid_until nulls last, created_at limit 1 for update;
    if pk is not null then update packs set sessions_used = sessions_used + 1 where id = pk; end if;
  end if;
  insert into bookings (session_id, rider_id, source, pack_id) values (s.id, p_rider, p_source, pk) returning id into bid;
  return jsonb_build_object('status', 'ok', 'booking', bid, 'pack', pk);
end $$;
revoke execute on function public._book(uuid, uuid, boolean, text, boolean, uuid) from public, anon, authenticated;

-- internal: cancel and give a pack credit back
create or replace function public._cancel(p_booking uuid, p_by uuid, p_refund boolean default true) returns void
language plpgsql security definer set search_path = public as $$
declare b bookings;
begin
  update bookings set status = 'cancelled', cancelled_at = now(), cancelled_by = p_by
  where id = p_booking and status in ('reserved', 'paid') returning * into b;
  if b.id is not null and b.pack_id is not null and p_refund then
    update packs set sessions_used = greatest(sessions_used - 1, 0) where id = b.pack_id;
  end if;
end $$;
revoke execute on function public._cancel(uuid, uuid, boolean) from public, anon, authenticated;

create or replace function public.book_session(p_session uuid, p_use_pack boolean default true) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return jsonb_build_object('status', 'signed_out'); end if;
  return public._book(public.ensure_my_rider(), p_session, p_use_pack, 'self', true);
end $$;
grant execute on function public.book_session(uuid, boolean) to authenticated;

-- 'ok' | 'not_found' | 'started' | 'too_late' | 'not_cancellable'
create or replace function public.cancel_booking(p_booking uuid) returns text
language plpgsql security definer set search_path = public as $$
declare b bookings; s sessions;
begin
  select * into b from bookings where id = p_booking and rider_id = public.my_rider_id();
  if b.id is null then return 'not_found'; end if;
  if b.status not in ('reserved', 'paid') then return 'not_cancellable'; end if;
  select * into s from sessions where id = b.session_id;
  if s.starts_at <= now() then return 'started'; end if;
  if s.starts_at - now() < interval '48 hours' then return 'too_late'; end if;
  perform public._cancel(b.id, auth.uid());
  return 'ok';
end $$;
grant execute on function public.cancel_booking(uuid) to authenticated;

-- Move = take the new time first, then release the old one. Same 48 h line as cancelling.
create or replace function public.move_booking(p_booking uuid, p_session uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare b bookings; s_old sessions; s_new sessions; r jsonb;
begin
  select * into b from bookings where id = p_booking and rider_id = public.my_rider_id();
  if b.id is null then return jsonb_build_object('status', 'not_found'); end if;
  if b.status not in ('reserved', 'paid') then return jsonb_build_object('status', 'not_cancellable'); end if;
  select * into s_old from sessions where id = b.session_id;
  select * into s_new from sessions where id = p_session;
  if s_new.id is null or s_new.kind <> s_old.kind then return jsonb_build_object('status', 'not_found'); end if;
  if s_old.starts_at - now() < interval '48 hours' then return jsonb_build_object('status', 'too_late'); end if;
  r := public._book(b.rider_id, p_session, false, b.source, true, b.pack_id);   -- carries the same pack credit over
  if r->>'status' <> 'ok' then return r; end if;
  perform public._cancel(b.id, auth.uid(), false);
  if b.status = 'paid' then update bookings set status = 'paid', paid_at = b.paid_at where id = (r->>'booking')::uuid; end if;
  return r;
end $$;
grant execute on function public.move_booking(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------- coach side
-- Publishes one session, or the same slot every week for p_weeks weeks. Times are local (Europe/Vienna).
create or replace function public.publish_sessions(
  p_kind text, p_title text, p_venue uuid, p_start timestamp, p_minutes integer, p_capacity integer,
  p_price numeric default null, p_level_min smallint default null, p_level_max smallint default null,
  p_weeks integer default 1, p_notes text default null
) returns integer
language plpgsql security definer set search_path = public as $$
declare i integer; st timestamptz;
begin
  perform public.require_staff();
  if p_weeks not between 1 and 26 then raise exception 'weeks 1-26' using errcode = '22023'; end if;
  for i in 0 .. p_weeks - 1 loop
    st := (p_start + make_interval(weeks => i)) at time zone public.bas_tz();
    insert into sessions (kind, title, coach_id, venue_id, starts_at, ends_at, capacity, price_eur, level_min, level_max, notes, created_by)
    values (p_kind, trim(p_title), auth.uid(), p_venue, st, st + make_interval(mins => p_minutes), p_capacity, p_price,
            p_level_min, p_level_max, nullif(trim(p_notes), ''), auth.uid());
  end loop;
  perform public.audit('sessions.published', null, jsonb_build_object('kind', p_kind, 'weeks', p_weeks, 'start', p_start));
  return p_weeks;
end $$;

create or replace function public.cancel_session(p_session uuid) returns integer
language plpgsql security definer set search_path = public as $$
declare b record; n integer := 0;
begin
  perform public.require_staff();
  update sessions set status = 'cancelled' where id = p_session;
  for b in select id from bookings where session_id = p_session and status in ('reserved', 'paid') loop
    perform public._cancel(b.id, auth.uid()); n := n + 1;
  end loop;
  perform public.audit('session.cancelled', null, jsonb_build_object('session', p_session, 'bookings', n));
  return n;
end $$;

create or replace function public.coach_book(p_session uuid, p_rider uuid, p_use_pack boolean default true) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  perform public.require_staff();
  return public._book(p_rider, p_session, p_use_pack, 'coach', false);
end $$;

create or replace function public.coach_cancel_booking(p_booking uuid, p_refund boolean default true) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.require_staff();
  perform public._cancel(p_booking, auth.uid(), p_refund);
end $$;

create or replace function public.mark_attendance(p_booking uuid, p_status text) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.require_staff();
  if p_status not in ('attended', 'no_show', 'reserved') then raise exception 'bad status' using errcode = '22023'; end if;
  update bookings set status = case when p_status = 'reserved' and paid_at is not null then 'paid' else p_status end,
                      marked_by = auth.uid()
  where id = p_booking and status <> 'cancelled';
end $$;

create or replace function public.mark_paid(p_booking uuid, p_paid boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.require_staff();
  update bookings set paid_at = case when p_paid then coalesce(paid_at, now()) end,
                      status = case when status in ('reserved', 'paid') then (case when p_paid then 'paid' else 'reserved' end) else status end
  where id = p_booking;
end $$;

create or replace function public.grant_pack(p_rider uuid, p_kind text, p_total integer, p_valid_until date default null,
                                             p_price numeric default null, p_paid boolean default false) returns uuid
language plpgsql security definer set search_path = public as $$
declare pid uuid;
begin
  perform public.require_staff();
  insert into packs (rider_id, kind, sessions_total, valid_until, price_eur, paid_at, created_by)
  values (p_rider, p_kind, p_total, p_valid_until, p_price, case when p_paid then now() end, auth.uid()) returning id into pid;
  perform public.audit('pack.granted', p_rider, jsonb_build_object('kind', p_kind, 'total', p_total));
  return pid;
end $$;

create or replace function public.mark_pack_paid(p_pack uuid, p_paid boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.require_staff();
  update packs set paid_at = case when p_paid then coalesce(paid_at, now()) end where id = p_pack;
end $$;

-- ---------------------------------------------------------------- weekly loops
-- From one of their bookings: "keep this time every week". Lands as a request for the coach.
create or replace function public.request_loop(p_booking uuid) returns text
language plpgsql security definer set search_path = public as $$
declare b bookings; s sessions; local timestamp;
begin
  select * into b from bookings where id = p_booking and rider_id = public.my_rider_id() and status <> 'cancelled';
  if b.id is null then return 'not_found'; end if;
  select * into s from sessions where id = b.session_id;
  local := s.starts_at at time zone public.bas_tz();
  if exists (select 1 from loops where rider_id = b.rider_id and status in ('requested', 'active')
             and weekday = extract(isodow from local) and start_time = local::time and kind = s.kind) then
    return 'already';
  end if;
  insert into loops (rider_id, coach_id, kind, weekday, start_time, minutes, venue_id, title, price_eur)
  values (b.rider_id, s.coach_id, s.kind, extract(isodow from local), local::time,
          (extract(epoch from s.ends_at - s.starts_at) / 60)::int, s.venue_id, s.title, s.price_eur);
  return 'ok';
end $$;
grant execute on function public.request_loop(uuid) to authenticated;

create or replace function public.request_loop_change(p_loop uuid, p_text text) returns text
language plpgsql security definer set search_path = public as $$
begin
  update loops set change_request = trim(p_text) where id = p_loop and rider_id = public.my_rider_id() and status = 'active';
  return case when found then 'ok' else 'not_found' end;
end $$;
grant execute on function public.request_loop_change(uuid, text) to authenticated;

create or replace function public.end_loop(p_loop uuid) returns text
language plpgsql security definer set search_path = public as $$
begin
  update loops set status = 'ended' where id = p_loop and rider_id = public.my_rider_id() and status in ('requested', 'active');
  return case when found then 'ok' else 'not_found' end;
end $$;
grant execute on function public.end_loop(uuid) to authenticated;

create or replace function public.decide_loop(p_loop uuid, p_approve boolean, p_clear_change boolean default false) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.require_staff();
  if p_clear_change then
    update loops set change_request = null where id = p_loop;
  else
    update loops set status = case when p_approve then 'active' else 'declined' end, decided_by = auth.uid(), decided_at = now()
    where id = p_loop and status = 'requested';
  end if;
end $$;

-- Nightly: book every active loop 4 weeks ahead, skipping trips; cancel loop bookings that fall inside a trip.
-- Loops with a pending change request book nothing new (what is booked stays). Returns bookings made.
create or replace function public.nightly_loops() returns integer
language plpgsql security definer set search_path = public as $$
declare lp loops; d date; today date := (now() at time zone public.bas_tz())::date; st timestamptz; sid uuid; r jsonb; made integer := 0; bk record;
begin
  -- trips free the spot
  for bk in
    select b.id from bookings b join sessions s on s.id = b.session_id
    where b.source = 'loop' and b.status in ('reserved', 'paid') and s.starts_at > now()
      and exists (select 1 from absences a where a.rider_id = b.rider_id
                  and (s.starts_at at time zone public.bas_tz())::date between a.from_date and a.to_date)
  loop
    perform public._cancel(bk.id, null);
  end loop;

  for lp in select * from loops where status = 'active' and change_request is null loop
    for d in select g::date from generate_series(today + 1, today + 28, interval '1 day') g
             where extract(isodow from g) = lp.weekday loop
      continue when exists (select 1 from absences a where a.rider_id = lp.rider_id and d between a.from_date and a.to_date);
      st := (d + lp.start_time) at time zone public.bas_tz();
      if lp.kind = 'trampoline' then
        select id into sid from sessions where kind = 'trampoline' and status = 'open' and starts_at = st
          and (lp.venue_id is null or venue_id = lp.venue_id) limit 1;
        continue when sid is null;          -- no group session that week: nothing to book
      else
        select id into sid from sessions where loop_id = lp.id and starts_at = st;
        if sid is null then
          insert into sessions (kind, title, coach_id, venue_id, starts_at, ends_at, capacity, price_eur, loop_id)
          values ('personal', lp.title, lp.coach_id, lp.venue_id, st, st + make_interval(mins => lp.minutes), 1, lp.price_eur, lp.id)
          returning id into sid;
        end if;
      end if;
      continue when exists (select 1 from bookings where session_id = sid and rider_id = lp.rider_id and status <> 'cancelled');
      r := public._book(lp.rider_id, sid, true, 'loop', false);
      if r->>'status' = 'ok' then made := made + 1; end if;
    end loop;
  end loop;
  return made;
end $$;
revoke execute on function public.nightly_loops() from public, anon, authenticated;

-- ---------------------------------------------------------------- stats (sessions, hours, streak, months, milestones)
-- Counts attended sessions (+ the coach's "sessions before the app" in the total). A week (Mon-Sun) with a session
-- extends the streak; a week inside a trip pauses it; the current week never breaks it.
create or replace function public.rider_stats(p_rider uuid default null) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  rid uuid := coalesce(p_rider, public.my_rider_id());
  tz text := public.bas_tz();
  w0 date := date_trunc('week', now() at time zone tz)::date;
  first_w date; w date; run integer := 0; best integer := 0; cur integer := 0; counting boolean := true;
  sessions_n integer; minutes_n integer; before_n integer; months jsonb; miles jsonb; last_at timestamptz;
begin
  if rid is null then return null; end if;
  if p_rider is not null and p_rider <> coalesce(public.my_rider_id(), '00000000-0000-0000-0000-000000000000') and not public.is_staff() then
    raise exception 'not yours' using errcode = '42501';
  end if;

  create temp table if not exists _att (at timestamptz, minutes integer, kind text) on commit drop;
  delete from _att;
  insert into _att select s.starts_at, (extract(epoch from s.ends_at - s.starts_at) / 60)::int, s.kind
  from bookings b join sessions s on s.id = b.session_id where b.rider_id = rid and b.status = 'attended';

  select count(*), coalesce(sum(minutes), 0), max(at) into sessions_n, minutes_n, last_at from _att;
  select sessions_before into before_n from riders where id = rid;

  -- streaks
  select min(date_trunc('week', at at time zone tz))::date into first_w from _att;
  if first_w is not null then
    for w in select g::date from generate_series(first_w, w0, interval '1 week') g loop
      if exists (select 1 from _att where date_trunc('week', at at time zone tz)::date = w) then run := run + 1;
      elsif w = w0 then null;                                                  -- this week is not over yet
      elsif exists (select 1 from absences a where a.rider_id = rid and a.from_date <= w + 6 and a.to_date >= w) then null;  -- trip: pause
      else run := 0;
      end if;
      best := greatest(best, run);
    end loop;
    cur := run;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object('month', m, 'sessions', n, 'minutes', mins) order by m), '[]') into months from (
    select to_char(g, 'YYYY-MM') m,
           (select count(*) from _att where to_char(at at time zone tz, 'YYYY-MM') = to_char(g, 'YYYY-MM')) n,
           (select coalesce(sum(minutes), 0) from _att where to_char(at at time zone tz, 'YYYY-MM') = to_char(g, 'YYYY-MM')) mins
    from generate_series(date_trunc('month', now() at time zone tz) - interval '11 months', date_trunc('month', now() at time zone tz), interval '1 month') g
  ) x;

  select coalesce(jsonb_agg(jsonb_build_object('label', label, 'at', at) order by at), '[]') into miles from (
    select format('%s sessions', n) label, (select at from _att order by at offset n - 1 limit 1) at
    from unnest(array[1, 10, 25, 50, 100]) n
    union all
    select format('%s hours', h), (select at from (select at, sum(minutes) over (order by at) cum from _att) c where cum >= h * 60 order by at limit 1)
    from unnest(array[10, 25, 50, 100]) h
    union all
    select 'First trampoline session', (select min(at) from _att where kind = 'trampoline')
  ) m where at is not null;

  return jsonb_build_object(
    'sessions', sessions_n, 'sessions_total', sessions_n + coalesce(before_n, 0), 'minutes', minutes_n,
    'streak_weeks', cur, 'longest_streak_weeks', best, 'last_session', last_at, 'months', months, 'milestones', miles);
end $$;
grant execute on function public.rider_stats(uuid) to authenticated;
