-- Camps: a set of training days for a group in one place. A real product here, not just a form:
-- apply → coach accepts (or waitlists) → €250 deposit → balance → the camp space (day plan, crew, payment status).
-- Payment stays offline: the coach moves the status. The public /camp form (api/apply.ts) keeps working as is.

create table public.camps (
  id             uuid primary key default gen_random_uuid(),
  slug           text not null unique check (slug ~ '^[a-z0-9-]+$'),
  title          text not null,
  place          text not null,
  starts_on      date not null,
  ends_on        date not null check (ends_on >= starts_on),
  spots          integer not null check (spots between 1 and 200),
  price_eur      numeric(8, 2) not null,
  deposit_eur    numeric(8, 2),
  balance_due_on date,
  description    text,
  plan           jsonb not null default '[]',      -- [{ "day": "23 Dec", "title": "...", "body": "..." }]
  status         text not null default 'open' check (status in ('draft', 'open', 'closed')),
  created_at     timestamptz not null default now()
);

insert into public.camps (slug, title, place, starts_on, ends_on, spots, price_eur, deposit_eur, balance_due_on, description, plan)
values ('italy-2026', 'BAS CAMP Italy 2026', 'Livigno, Italy', '2026-12-23', '2026-12-27', 15, 999, 250, '2026-12-09',
  'Snowboard + freeski camp with Ilia Baskakov and Aleksey Bogatyrev: three coached days, filming and video analysis, a personal programme after camp. 3-day ski pass, 4 nights with breakfast, transfers and ice karting included.',
  '[{"day":"23 Dec","title":"Arrive. Christmas market.","body":"Arrival and check-in. An evening at the Livigno Christmas market, then the intro meeting: the crew, the coaches, the plan."},
    {"day":"24 Dec","title":"Slope. Then ice karting.","body":"Coached day on the mountain. Ice karting after riding."},
    {"day":"25 Dec","title":"Slope. Then free time.","body":"Coached day on the mountain. The rest of the day is yours."},
    {"day":"26 Dec","title":"Slope. Then spa.","body":"Coached day on the mountain: lock in what you worked on. Spa in the evening (entry not included)."},
    {"day":"27 Dec","title":"One more? Then home.","body":"Optional riding on your own, without a coach. Then the road back home."}]');

create table public.camp_entries (
  id         uuid primary key default gen_random_uuid(),
  camp_id    uuid not null references public.camps (id) on delete cascade,
  rider_id   uuid not null references public.riders (id) on delete cascade,
  status     text not null default 'applied'
             check (status in ('applied', 'waitlist', 'accepted', 'deposit_paid', 'paid', 'attended', 'cancelled', 'declined')),
  note       text check (char_length(note) <= 500),
  promo_code text check (char_length(promo_code) <= 40),
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by uuid,
  unique (camp_id, rider_id)
);

alter table public.camps enable row level security;
alter table public.camp_entries enable row level security;
create policy camps_read on public.camps for select to anon, authenticated using (status <> 'draft' or public.is_staff());
create policy camps_staff on public.camps for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy entries_read on public.camp_entries for select to authenticated using (rider_id = public.my_rider_id() or public.is_staff());
revoke insert, update, delete on public.camp_entries from anon, authenticated;

-- statuses that hold a spot
create or replace function public.camp_holds(p_status text) returns boolean language sql immutable as $$
  select p_status in ('accepted', 'deposit_paid', 'paid', 'attended');
$$;

-- camps with spots left and the caller's own entry
create or replace function public.camp_list() returns table (
  id uuid, slug text, title text, place text, starts_on date, ends_on date, spots integer, spots_left integer,
  price_eur numeric, deposit_eur numeric, balance_due_on date, description text, plan jsonb, status text,
  my_entry uuid, my_status text)
language sql stable security definer set search_path = public as $$
  select c.id, c.slug, c.title, c.place, c.starts_on, c.ends_on, c.spots,
         c.spots - (select count(*) from camp_entries e where e.camp_id = c.id and public.camp_holds(e.status))::int,
         c.price_eur, c.deposit_eur, c.balance_due_on, c.description, c.plan, c.status, me.id, me.status
  from camps c
  left join lateral (select e.id, e.status from camp_entries e where e.camp_id = c.id and e.rider_id = public.my_rider_id()) me on true
  where c.status <> 'draft' and c.ends_on >= current_date - 365
  order by c.starts_on;
$$;
grant execute on function public.camp_list() to anon, authenticated;

-- 'ok' | 'closed' | 'already' | 'signed_out'. Applying twice after cancelling re-opens the same entry.
create or replace function public.apply_camp(p_camp uuid, p_note text default null, p_promo text default null) returns text
language plpgsql security definer set search_path = public as $$
declare c camps; rid uuid; e camp_entries;
begin
  if auth.uid() is null then return 'signed_out'; end if;
  rid := public.ensure_my_rider();
  select * into c from camps where id = p_camp;
  if c.id is null or c.status <> 'open' or c.starts_on <= current_date then return 'closed'; end if;
  select * into e from camp_entries where camp_id = p_camp and rider_id = rid;
  if e.id is not null and e.status not in ('cancelled', 'declined') then return 'already'; end if;
  insert into camp_entries (camp_id, rider_id, note, promo_code) values (p_camp, rid, nullif(trim(p_note), ''), nullif(trim(p_promo), ''))
  on conflict (camp_id, rider_id) do update set status = 'applied', note = excluded.note, promo_code = excluded.promo_code,
    created_at = now(), decided_at = null, decided_by = null;
  return 'ok';
end $$;
grant execute on function public.apply_camp(uuid, text, text) to authenticated;

-- a rider can withdraw while nothing is paid; after a deposit it goes through the coach (cancellation terms)
create or replace function public.withdraw_camp(p_entry uuid) returns text
language plpgsql security definer set search_path = public as $$
declare e camp_entries;
begin
  select * into e from camp_entries where id = p_entry and rider_id = public.my_rider_id();
  if e.id is null then return 'not_found'; end if;
  if e.status in ('deposit_paid', 'paid', 'attended') then return 'paid'; end if;
  update camp_entries set status = 'cancelled' where id = e.id;
  return 'ok';
end $$;
grant execute on function public.withdraw_camp(uuid) to authenticated;

-- coach moves an entry along. Refuses to over-fill: accepting when full puts them on the waitlist instead.
create or replace function public.set_camp_entry(p_entry uuid, p_status text) returns text
language plpgsql security definer set search_path = public as $$
declare e camp_entries; c camps; held integer;
begin
  perform public.require_staff();
  select * into e from camp_entries where id = p_entry for update;
  if e.id is null then return 'not_found'; end if;
  select * into c from camps where id = e.camp_id for update;
  if public.camp_holds(p_status) and not public.camp_holds(e.status) then
    select count(*) into held from camp_entries where camp_id = c.id and public.camp_holds(status);
    if held >= c.spots then
      update camp_entries set status = 'waitlist', decided_at = now(), decided_by = auth.uid() where id = e.id;
      return 'full_waitlisted';
    end if;
  end if;
  update camp_entries set status = p_status, decided_at = now(), decided_by = auth.uid() where id = e.id;
  perform public.audit('camp.entry', e.rider_id, jsonb_build_object('camp', c.slug, 'status', p_status));
  return 'ok';
end $$;

-- Who is going, for people in the same camp (and coaches). Riders who are not listed in the community show as
-- a count only. Name = first name + last initial.
create or replace function public.camp_crew(p_camp uuid) returns table (rider_id uuid, name text, photo_url text, band smallint, disciplines text[], hidden_count integer)
language plpgsql stable security definer set search_path = public as $$
declare me uuid := public.my_rider_id();
begin
  if not public.is_staff() and not exists (select 1 from camp_entries where camp_id = p_camp and rider_id = me and public.camp_holds(status)) then
    return;
  end if;
  return query
    select r.id, trim(coalesce(p.first_name, r.first_name) || ' ' || coalesce(left(coalesce(p.last_name, r.last_name), 1) || '.', '')),
           p.photo_url, coalesce(l.band, l.self_band), p.disciplines, null::int
    from camp_entries e join riders r on r.id = e.rider_id left join profiles p on p.id = r.profile_id
    left join rider_levels l on l.rider_id = r.id
    where e.camp_id = p_camp and public.camp_holds(e.status) and (coalesce(p.listed, false) or r.id = me or public.is_staff())
    union all
    select null, null, null, null, null, count(*)::int
    from camp_entries e join riders r on r.id = e.rider_id left join profiles p on p.id = r.profile_id
    where e.camp_id = p_camp and public.camp_holds(e.status) and not (coalesce(p.listed, false) or r.id = me or public.is_staff());
end $$;
grant execute on function public.camp_crew(uuid) to authenticated;
