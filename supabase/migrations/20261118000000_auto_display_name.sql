-- Every account gets a display name (a random one like 'Curious Pathfinder 42' when none is
-- given); the sharing dialogs no longer ask for one; the plan's author is read from the
-- profile each time, so renaming the account renames the author everywhere.
-- Run once on a database created from the earlier schema.sql. Safe to run again.

begin;

-- 1. A friendly name for accounts that did not pick one.
create or replace function public.random_display_name() returns text
language sql volatile set search_path = '' as $$
  select (a.w)[1 + floor(random() * array_length(a.w, 1))::int] || ' '
      || (n.w)[1 + floor(random() * array_length(n.w, 1))::int] || ' '
      || lpad(floor(random() * 100)::int::text, 2, '0')
  from (select array[
    'Curious', 'Focused', 'Steady', 'Bright', 'Patient', 'Eager', 'Keen', 'Daring', 'Mindful',
    'Swift', 'Bold', 'Calm', 'Clever', 'Diligent', 'Nimble', 'Resolute', 'Determined',
    'Thoughtful', 'Radiant', 'Plucky', 'Gritty', 'Sharp', 'Humble', 'Lively', 'Fearless',
    'Earnest', 'Inventive', 'Tenacious', 'Quiet', 'Witty', 'Brave', 'Restless', 'Hopeful',
    'Agile', 'Wise', 'Spirited', 'Driven', 'Gentle', 'Ambitious', 'Cheerful'] as w) a,
  (select array[
    'Pathfinder', 'Navigator', 'Voyager', 'Scholar', 'Explorer', 'Wayfarer', 'Trailblazer',
    'Climber', 'Learner', 'Compass', 'Otter', 'Heron', 'Fox', 'Falcon', 'Pioneer',
    'Cartographer', 'Wanderer', 'Ranger', 'Sherpa', 'Lantern', 'Summit', 'Meadow', 'Comet',
    'Harbor', 'Owl', 'Lynx', 'Raven', 'Badger', 'Sparrow', 'Dolphin', 'Panda', 'Maple', 'Cedar',
    'Ember', 'Horizon', 'Beacon', 'Anchor', 'Quill', 'Atlas', 'Journeyer'] as w) n;
$$;
revoke all on function public.random_display_name() from public, anon, authenticated;

-- 2. New accounts get the sign-up name, or a random one.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (user_id, display_name)
  values (new.id, coalesce(
    nullif(left(btrim(coalesce(new.raw_user_meta_data ->> 'display_name', '')), 40), ''),
    public.random_display_name()))
  on conflict (user_id) do nothing;
  return new;
end $$;

-- 3. A blank name is rejected instead of clearing the name.
create or replace function public.set_display_name(p_name text) returns void
language plpgsql security invoker set search_path = public as $$
begin
  if btrim(coalesce(p_name, '')) = '' then
    raise exception 'a display name cannot be empty' using errcode = '23514';
  end if;
  insert into public.profiles (user_id, display_name) values (auth.uid(), btrim(p_name))
  on conflict (user_id) do update set display_name = excluded.display_name;
end $$;

-- 4. set_plan_sharing no longer takes a name. Drop the old 4-argument version first, or it
--    would stay callable next to the new one.
drop function if exists public.set_plan_sharing(text, text, text[], text);
create or replace function public.set_plan_sharing(
  p_goal_id text, p_visibility text, p_tags text[])
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  tags text[];
  share public.plan_shares;
begin
  if uid is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  if not exists (select 1 from public.goals where user_id = uid and id = p_goal_id) then
    raise exception 'plan not found' using errcode = 'P0002';
  end if;
  if p_visibility = 'private' then
    -- A taken-down plan keeps its row, so setting it private and sharing it again cannot
    -- clear `hidden`. It stays invisible whatever the owner picks.
    delete from public.plan_shares where user_id = uid and goal_id = p_goal_id and not hidden;
    return jsonb_build_object('visibility', 'private', 'slug', null, 'tags', '[]'::jsonb);
  end if;
  if p_visibility is null or p_visibility not in ('unlisted', 'public') then
    raise exception 'unknown visibility' using errcode = '23514';
  end if;
  if p_visibility = 'public' then
    if (select display_name from public.profiles where user_id = uid) is null then
      raise exception 'set a display name before making a plan public' using errcode = '23514';
    end if;
    if (select count(*) from public.plan_shares
        where user_id = uid and visibility = 'public' and goal_id <> p_goal_id) >= 20 then
      raise exception 'at most 20 public plans' using errcode = '23514';
    end if;
  end if;
  select coalesce(array_agg(t.tag order by t.tag), '{}') into tags
  from (
    select distinct lower(btrim(x)) as tag from unnest(coalesce(p_tags, '{}')) x
    where btrim(x) <> '' and char_length(btrim(x)) <= 24
    order by 1 limit 5
  ) t;
  insert into public.plan_shares as s (user_id, goal_id, visibility, slug, tags)
  values (uid, p_goal_id, p_visibility, substr(replace(gen_random_uuid()::text, '-', ''), 1, 12), tags)
  on conflict (user_id, goal_id) do update set visibility = excluded.visibility, tags = excluded.tags
  returning * into share;
  return jsonb_build_object(
    'visibility', share.visibility, 'slug', share.slug, 'tags', to_jsonb(share.tags));
end $$;
revoke all on function public.set_plan_sharing(text, text, text[]) from public, anon;
grant execute on function public.set_plan_sharing(text, text, text[]) to authenticated;

-- 5. Accounts that have no name yet (and profiles missing for existing users) get one.
insert into public.profiles (user_id, display_name)
select u.id, public.random_display_name() from auth.users u
on conflict (user_id) do nothing;
update public.profiles set display_name = public.random_display_name() where display_name is null;

commit;
