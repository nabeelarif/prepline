-- Favorites: a signed-in user stars a shared plan and finds it again later; plan cards and
-- the shared page show the favorite count next to the copy (fork) count.
-- Run once on a database created from the earlier schema.sql. Safe to run again.

begin;

create table if not exists public.plan_favorites (
  user_id uuid not null references auth.users (id) on delete cascade,
  owner_id uuid not null,
  goal_id text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, owner_id, goal_id),
  foreign key (owner_id, goal_id) references public.plan_shares (user_id, goal_id) on delete cascade
);
create index if not exists plan_favorites_plan_idx on public.plan_favorites (owner_id, goal_id);
alter table public.plan_favorites enable row level security;
revoke all on public.plan_favorites from anon, authenticated;

-- A plan for anyone with its link. Null when the link is wrong, private or taken down.
create or replace function public.get_shared_plan(p_slug text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'slug', s.slug, 'visibility', s.visibility, 'tags', to_jsonb(s.tags),
    'published_at', s.published_at, 'copy_count', s.copy_count,
    'favorite_count', (select count(*) from public.plan_favorites f
      where f.owner_id = s.user_id and f.goal_id = s.goal_id),
    'favorited', exists (select 1 from public.plan_favorites f
      where f.owner_id = s.user_id and f.goal_id = s.goal_id and f.user_id = auth.uid()),
    'author', p.display_name,
    'source', public.plan_origin(g.source_slug, g.source_name),
    'name', g.name, 'description', g.description,
    'phases', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', ph.id, 'name', ph.name, 'description', ph.description, 'color', ph.color)
        order by ph.position, ph.id)
      from public.phases ph where ph.user_id = g.user_id and ph.goal_id = g.id), '[]'),
    'resources', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', r.id, 'title', r.title, 'url', r.url, 'type', r.type, 'minutes', r.minutes,
        'notes', r.notes, 'phase_id', r.phase_id)
        order by r.position, r.id)
      from public.resources r where r.user_id = g.user_id and r.goal_id = g.id), '[]')
  )
  from public.plan_shares s
  join public.goals g on g.user_id = s.user_id and g.id = s.goal_id
  left join public.profiles p on p.user_id = s.user_id
  where s.slug = p_slug and not s.hidden
$$;
-- Summaries of public plans: newest first, (p_sort = 'popular') most copied first, or
-- (p_sort = 'favorites') most favorited first.
-- A query matches the name, the description or a tag. Unlisted plans never appear.
create or replace function public.list_public_plans(
  p_query text, p_tag text, p_limit integer, p_offset integer, p_sort text default 'new')
returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(t.item order by
    case when p_sort = 'popular' then t.copy_count
         when p_sort = 'favorites' then t.favorite_count end desc nulls last,
    t.published_at desc, t.slug), '[]')
  from (
    select s.copy_count, fv.n as favorite_count, s.published_at, s.slug, jsonb_build_object(
      'slug', s.slug, 'name', g.name, 'description', g.description, 'author', p.display_name,
      'source', public.plan_origin(g.source_slug, g.source_name),
      'tags', to_jsonb(s.tags), 'published_at', s.published_at, 'copy_count', s.copy_count,
      'favorite_count', fv.n, 'favorited', fv.mine,
      'phase_count', ph.n, 'resource_count', rs.n, 'total_minutes', rs.minutes
    ) as item
    from public.plan_shares s
    join public.goals g on g.user_id = s.user_id and g.id = s.goal_id
    left join public.profiles p on p.user_id = s.user_id
    cross join lateral (
      select count(*) as n, coalesce(sum(r.minutes), 0) as minutes
      from public.resources r where r.user_id = g.user_id and r.goal_id = g.id
    ) rs
    cross join lateral (
      select count(*) as n from public.phases x where x.user_id = g.user_id and x.goal_id = g.id
    ) ph
    cross join lateral (
      select count(*) as n, coalesce(bool_or(f.user_id = auth.uid()), false) as mine
      from public.plan_favorites f where f.owner_id = s.user_id and f.goal_id = s.goal_id
    ) fv
    where s.visibility = 'public' and not s.hidden
      -- A plan that is still empty is shared but not listed until it has a resource.
      and rs.n > 0
      and (p_tag is null or p_tag = '' or lower(p_tag) = any (s.tags))
      and (
        p_query is null or btrim(p_query) = ''
        or g.name ilike '%' || replace(replace(replace(btrim(p_query), '\', '\\'), '%', '\%'), '_', '\_') || '%'
        or g.description ilike '%' || replace(replace(replace(btrim(p_query), '\', '\\'), '%', '\%'), '_', '\_') || '%'
        or exists (
          select 1 from unnest(s.tags) tg
          where tg ilike '%' || replace(replace(replace(btrim(p_query), '\', '\\'), '%', '\%'), '_', '\_') || '%')
      )
    order by
      case when p_sort = 'popular' then s.copy_count
           when p_sort = 'favorites' then fv.n end desc nulls last,
      s.published_at desc, s.slug
    limit least(greatest(coalesce(p_limit, 24), 1), 50) offset greatest(coalesce(p_offset, 0), 0)
  ) t
$$;

-- The plans the signed-in user has starred, newest star first. Same item shape as
-- list_public_plans. Unlisted plans appear (the user found them by link); taken-down plans
-- do not, and a plan the owner makes private is gone (the favorite cascades with the share).
create or replace function public.list_my_favorites(p_limit integer default 24, p_offset integer default 0)
returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(t.item order by t.starred_at desc, t.slug), '[]')
  from (
    select mine.created_at as starred_at, s.slug, jsonb_build_object(
      'slug', s.slug, 'name', g.name, 'description', g.description, 'author', p.display_name,
      'source', public.plan_origin(g.source_slug, g.source_name),
      'tags', to_jsonb(s.tags), 'published_at', s.published_at, 'copy_count', s.copy_count,
      'favorite_count', fv.n, 'favorited', true,
      'phase_count', ph.n, 'resource_count', rs.n, 'total_minutes', rs.minutes
    ) as item
    from public.plan_favorites mine
    join public.plan_shares s on s.user_id = mine.owner_id and s.goal_id = mine.goal_id
    join public.goals g on g.user_id = s.user_id and g.id = s.goal_id
    left join public.profiles p on p.user_id = s.user_id
    cross join lateral (
      select count(*) as n, coalesce(sum(r.minutes), 0) as minutes
      from public.resources r where r.user_id = g.user_id and r.goal_id = g.id
    ) rs
    cross join lateral (
      select count(*) as n from public.phases x where x.user_id = g.user_id and x.goal_id = g.id
    ) ph
    cross join lateral (
      select count(*) as n from public.plan_favorites f
      where f.owner_id = s.user_id and f.goal_id = s.goal_id
    ) fv
    where mine.user_id = auth.uid() and not s.hidden
    order by mine.created_at desc, s.slug
    limit least(greatest(coalesce(p_limit, 24), 1), 50) offset greatest(coalesce(p_offset, 0), 0)
  ) t
$$;
-- Public plans that share at least one tag with the plan behind p_slug, most shared tags
-- first, then most copied. Same item shape as list_public_plans. Empty when the slug is
-- wrong or hidden. The plan itself is never included.
create or replace function public.similar_plans(p_slug text, p_limit integer default 6) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(t.item order by t.overlap desc, t.copy_count desc, t.slug), '[]')
  from (
    select cardinality(array(select unnest(s.tags) intersect select unnest(me.tags))) as overlap,
      s.copy_count, s.slug, jsonb_build_object(
      'slug', s.slug, 'name', g.name, 'description', g.description, 'author', p.display_name,
      'source', public.plan_origin(g.source_slug, g.source_name),
      'tags', to_jsonb(s.tags), 'published_at', s.published_at, 'copy_count', s.copy_count,
      'favorite_count', fv.n, 'favorited', fv.mine,
      'phase_count', ph.n, 'resource_count', rs.n, 'total_minutes', rs.minutes
    ) as item
    from public.plan_shares me
    join public.plan_shares s on s.slug <> me.slug and s.tags && me.tags
    join public.goals g on g.user_id = s.user_id and g.id = s.goal_id
    left join public.profiles p on p.user_id = s.user_id
    cross join lateral (
      select count(*) as n, coalesce(sum(r.minutes), 0) as minutes
      from public.resources r where r.user_id = g.user_id and r.goal_id = g.id
    ) rs
    cross join lateral (
      select count(*) as n from public.phases x where x.user_id = g.user_id and x.goal_id = g.id
    ) ph
    cross join lateral (
      select count(*) as n, coalesce(bool_or(f.user_id = auth.uid()), false) as mine
      from public.plan_favorites f where f.owner_id = s.user_id and f.goal_id = s.goal_id
    ) fv
    where me.slug = p_slug and not me.hidden
      and s.visibility = 'public' and not s.hidden and rs.n > 0
    order by 1 desc, s.copy_count desc, s.slug
    limit least(greatest(coalesce(p_limit, 6), 1), 24)
  ) t
$$;

-- Stars (p_on true) or un-stars a plan for the signed-in user. Idempotent. Your own plan,
-- a taken-down plan and an unknown link are ignored. Returns nothing; the app re-reads counts.
create or replace function public.set_plan_favorite(p_slug text, p_on boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  share public.plan_shares;
begin
  if uid is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  select * into share from public.plan_shares where slug = p_slug and not hidden;
  if not found or share.user_id = uid then
    return;
  end if;
  if p_on then
    insert into public.plan_favorites (user_id, owner_id, goal_id)
    values (uid, share.user_id, share.goal_id) on conflict do nothing;
  else
    delete from public.plan_favorites
    where user_id = uid and owner_id = share.user_id and goal_id = share.goal_id;
  end if;
end $$;


revoke all on function public.set_plan_favorite(text, boolean), public.list_my_favorites(integer, integer)
  from public, anon, authenticated;
grant execute on function public.set_plan_favorite(text, boolean), public.list_my_favorites(integer, integer)
  to authenticated;

commit;
