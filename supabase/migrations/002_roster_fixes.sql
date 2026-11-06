-- Two roster fixes found in the first end-to-end run:
-- 1. Coaches and admins do not appear in the coach roster (opening /me gave them a rider row).
-- 2. Deleting an account removes the rider row it made for itself. A row a coach created stays, unclaimed,
--    so the coach keeps their record and can send a fresh link.

create or replace function public.drop_own_rider() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  delete from riders where profile_id = old.id and created_by is null;
  return old;
end $$;

drop trigger if exists profiles_drop_own_rider on public.profiles;
create trigger profiles_drop_own_rider before delete on public.profiles
  for each row execute function public.drop_own_rider();

-- leftovers from accounts deleted before this trigger existed
delete from public.riders where profile_id is null and created_by is null;

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
) inv on true
where coalesce(p.role, 'rider') = 'rider';
