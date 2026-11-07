-- The rider questionnaire after sign-up (/welcome): what they ride, since when, how, and what they love.
-- Two answers are required (disciplines, riding_since); the rest is optional and editable on the profile.
-- Coaches see every answer on the rider's card.

alter table public.profiles
  add column disciplines    text[] not null default '{}' check (disciplines <@ array['snowboard', 'ski']::text[]),
  add column riding_since   smallint check (riding_since between 1950 and 2100),
  add column stance         text check (stance in ('regular', 'goofy')),
  add column terrain        text[] not null default '{}' check (terrain <@ array['piste', 'park', 'freeride', 'backcountry']::text[]),
  add column favorite_trick text check (char_length(favorite_trick) <= 80),
  add column home_resort    text check (char_length(home_resort) <= 80),
  add column favorite_brand text check (char_length(favorite_brand) <= 60),
  add column gear           text check (char_length(gear) <= 120),
  add column goals          text check (char_length(goals) <= 280),
  add column onboarded_at   timestamptz;

grant update (disciplines, riding_since, stance, terrain, favorite_trick, home_resort, favorite_brand, gear, goals)
  on public.profiles to authenticated;

-- Marks the questionnaire done once the two required answers are in. Returns 'ok' or the first missing field.
create or replace function public.finish_onboarding() returns text
language plpgsql security definer set search_path = public as $$
declare p profiles;
begin
  select * into p from profiles where id = auth.uid();
  if p.id is null then return 'signed_out'; end if;
  if cardinality(p.disciplines) = 0 then return 'disciplines'; end if;
  if p.riding_since is null then return 'riding_since'; end if;
  update profiles set onboarded_at = coalesce(onboarded_at, now()) where id = p.id;
  perform public.ensure_my_rider();
  return 'ok';
end $$;
grant execute on function public.finish_onboarding() to authenticated;

-- the coach roster carries the answers too (added at the end: CREATE OR REPLACE VIEW may only append columns)
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
  inv.expires_at as invite_expires_at,
  p.disciplines, p.riding_since, p.stance, p.terrain, p.favorite_trick, p.home_resort, p.favorite_brand, p.gear,
  p.goals, p.bio, p.onboarded_at
from riders r
left join profiles p on p.id = r.profile_id
left join rider_levels l on l.rider_id = r.id
left join lateral (
  select * from invites i where i.rider_id = r.id and i.used_at is null and i.revoked_at is null
  order by i.created_at desc limit 1
) inv on true
where coalesce(p.role, 'rider') = 'rider';
