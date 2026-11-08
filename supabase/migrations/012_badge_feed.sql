-- Badges show up in the crew feed ("Ivan P. earned First session"), and feed items carry the time the thing
-- happened (landed_at, verified_at, awarded_at) instead of the time the row was written, so a coach logging
-- yesterday's trick today puts it at yesterday.

alter table public.feed_items drop constraint feed_items_kind_check;
alter table public.feed_items add constraint feed_items_kind_check check (kind in ('joined', 'level', 'trick', 'camp', 'event', 'badge'));

create or replace function public.feed_on_badge() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into feed_items (kind, rider_id, payload, created_at)
  select 'badge', new.rider_id, jsonb_build_object('key', b.key, 'title', b.title, 'description', b.description), coalesce(new.awarded_at, now())
  from badges b where b.key = new.badge_key;
  return new;
end $$;
create trigger badges_feed after insert on public.badge_awards for each row execute function public.feed_on_badge();

create or replace function public.feed_on_trick() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'landed' and (tg_op = 'INSERT' or old.status is distinct from 'landed') then
    insert into feed_items (kind, rider_id, payload, created_by, created_at)
    values ('trick', new.rider_id, jsonb_build_object('trick', (select name from tricks where id = new.trick_id)), new.confirmed_by,
            least(coalesce(new.landed_at, now()), now()));
  end if;
  return new;
end $$;

create or replace function public.feed_on_level() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.band is not null and new.band is distinct from old.band then
    insert into feed_items (kind, rider_id, payload, created_by, created_at)
    values ('level', new.rider_id, jsonb_build_object('band', new.band), new.verified_by, least(coalesce(new.verified_at, now()), now()));
  end if;
  return new;
end $$;
create or replace function public.feed_on_level_insert() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.band is not null then
    insert into feed_items (kind, rider_id, payload, created_by, created_at)
    values ('level', new.rider_id, jsonb_build_object('band', new.band), new.verified_by, least(coalesce(new.verified_at, now()), now()));
  end if;
  return new;
end $$;
