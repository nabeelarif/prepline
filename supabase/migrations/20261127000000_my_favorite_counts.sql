-- Owners see how many people starred each of their shared plans, shown on My Plans next to
-- the fork count, and saving sharing settings answers with the same counts. Run once on a
-- database created from the earlier schema.sql, before deploying the app that calls it.
-- Safe to run again.

begin;

-- How many people starred each of the signed-in user's shared plans, as {goal_id: count};
-- a plan nobody starred is left out. The owner learns the number, never who.
create or replace function public.my_favorite_counts() returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_object_agg(t.goal_id, t.n), '{}')
  from (
    select f.goal_id, count(*) as n from public.plan_favorites f
    where f.owner_id = auth.uid()
    group by f.goal_id
  ) t
$$;

-- Replaced in place, so who may run it does not change.
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
  -- The same fields the owner loads, so the app can show the answer as it is.
  return jsonb_build_object(
    'visibility', share.visibility, 'slug', share.slug, 'tags', to_jsonb(share.tags),
    'hidden', share.hidden, 'copy_count', share.copy_count,
    'favorite_count', (select count(*) from public.plan_favorites f
      where f.owner_id = uid and f.goal_id = p_goal_id));
end $$;

revoke all on function public.my_favorite_counts() from public, anon, authenticated;
grant execute on function public.my_favorite_counts() to authenticated;

commit;
