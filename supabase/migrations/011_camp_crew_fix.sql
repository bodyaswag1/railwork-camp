-- camp_crew: inside a RETURNS TABLE function the output column "rider_id" clashed with camp_entries.rider_id
-- ("column reference is ambiguous"). Same logic, qualified names.
create or replace function public.camp_crew(p_camp uuid) returns table (rider_id uuid, name text, photo_url text, band smallint, disciplines text[], hidden_count integer)
language plpgsql stable security definer set search_path = public as $$
declare me uuid := public.my_rider_id();
begin
  if not public.is_staff() and not exists (
    select 1 from camp_entries ce where ce.camp_id = p_camp and ce.rider_id = me and public.camp_holds(ce.status)) then
    return;
  end if;
  return query
    select r.id, public.short_name(coalesce(p.first_name, r.first_name), coalesce(p.last_name, r.last_name)),
           p.photo_url, coalesce(l.band, l.self_band), p.disciplines, null::int
    from camp_entries e join riders r on r.id = e.rider_id left join profiles p on p.id = r.profile_id
    left join rider_levels l on l.rider_id = r.id
    where e.camp_id = p_camp and public.camp_holds(e.status) and (coalesce(p.listed, false) or r.id = me or public.is_staff())
    union all
    select null::uuid, null::text, null::text, null::smallint, null::text[], count(*)::int
    from camp_entries e join riders r on r.id = e.rider_id left join profiles p on p.id = r.profile_id
    where e.camp_id = p_camp and public.camp_holds(e.status) and not (coalesce(p.listed, false) or r.id = me or public.is_staff())
    having count(*) > 0;
end $$;
