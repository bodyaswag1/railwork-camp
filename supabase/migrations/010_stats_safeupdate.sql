-- rider_stats cleared its scratch table with a bare DELETE, which Supabase refuses for API callers (pg_safeupdate).

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
  delete from _att where true;   -- Supabase refuses a DELETE without WHERE over the API (pg_safeupdate)
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
