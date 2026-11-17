-- Road to Goals: initial database schema. Run once in the Supabase SQL Editor (or psql).
-- Later changes go in supabase/migrations/ as new, ordered .sql files.
--
-- Every row belongs to one user (auth.users.id, which never changes when sign-in
-- methods are linked). Row Level Security restricts every table to its owner, so the
-- frontend's anon key can never read or write another user's data.
--
-- Ids are text because plans created before the move to Supabase and imported files
-- use short ids. Primary keys include user_id so two users can never collide.
-- Order is the `position` column (0-based); the app treats it as array order.
--
-- Plan content and a user's own state are kept in separate tables. `goals`, `phases` and
-- `resources` hold only what a plan is (titles, links, estimates, notes, order). The
-- user's dates and daily hours live in `plan_settings`, and progress lives in
-- `resource_progress`. Anything that is ever shown to other people reads the content
-- tables only, so progress and deadlines cannot leak by accident.

-- Supabase normally grants this already; without it every request fails with
-- "permission denied for schema public".
grant usage on schema public to anon, authenticated;

create table public.profiles (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  active_goal_id text,
  -- Shown as the author of a plan the user makes public. The email is never shown.
  display_name text check (display_name is null or char_length(display_name) between 1 and 40)
);

create table public.goals (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id text not null,
  name text not null check (char_length(name) <= 120),
  description text not null default '' check (char_length(description) <= 1000),
  created_at date not null,
  position integer not null default 0,
  primary key (user_id, id)
);

-- The owner's schedule for a plan: when they started it, an optional deadline, and
-- their daily capacity. Not plan content.
create table public.plan_settings (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  goal_id text not null,
  start_date date,
  target_date date,
  hours_per_day numeric check (hours_per_day is null or hours_per_day between 0.25 and 16),
  primary key (user_id, goal_id),
  check (start_date is null or target_date is null or start_date <= target_date),
  foreign key (user_id, goal_id) references public.goals (user_id, id) on delete cascade
);

create table public.phases (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  goal_id text not null,
  id text not null,
  name text not null check (char_length(name) <= 80),
  description text not null default '' check (char_length(description) <= 500),
  color text not null check (color in ('blue', 'purple', 'green', 'orange', 'red', 'pink', 'gray')),
  position integer not null default 0,
  primary key (user_id, id),
  unique (user_id, goal_id, id),
  foreign key (user_id, goal_id) references public.goals (user_id, id) on delete cascade
);

create table public.resources (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  goal_id text not null,
  id text not null,
  title text not null,
  url text not null default '',
  type text not null check (type in ('article', 'video', 'course', 'practice')),
  minutes integer not null check (minutes between 1 and 100000),
  notes text not null default '',
  phase_id text,
  created_at date not null,
  position integer not null default 0,
  primary key (user_id, id),
  foreign key (user_id, goal_id) references public.goals (user_id, id) on delete cascade,
  -- Deleting a phase keeps its resources in the plan, just without a phase.
  foreign key (user_id, goal_id, phase_id) references public.phases (user_id, goal_id, id)
    on delete set null (phase_id)
);

-- The owner's progress on a resource. A missing row means not started.
create table public.resource_progress (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  resource_id text not null,
  done_minutes integer not null default 0 check (done_minutes >= 0),
  done boolean not null default false,
  done_at date,
  started_at date,
  primary key (user_id, resource_id),
  foreign key (user_id, resource_id) references public.resources (user_id, id) on delete cascade
);

-- The active plan survives only while it exists.
alter table public.profiles
  add foreign key (user_id, active_goal_id) references public.goals (user_id, id)
    on delete set null (active_goal_id);

create index goals_order_idx on public.goals (user_id, position);
create index phases_order_idx on public.phases (user_id, goal_id, position);
create index resources_order_idx on public.resources (user_id, goal_id, position);

-- Row Level Security: owner only, signed-in users only.
alter table public.profiles enable row level security;
alter table public.goals enable row level security;
alter table public.plan_settings enable row level security;
alter table public.phases enable row level security;
alter table public.resources enable row level security;
alter table public.resource_progress enable row level security;

create policy profiles_owner on public.profiles for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy goals_owner on public.goals for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy plan_settings_owner on public.plan_settings for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy phases_owner on public.phases for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy resources_owner on public.resources for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy resource_progress_owner on public.resource_progress for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

revoke all on public.profiles, public.goals, public.plan_settings, public.phases,
  public.resources, public.resource_progress from anon;
grant select, insert, update, delete
  on public.profiles, public.goals, public.plan_settings, public.phases,
  public.resources, public.resource_progress to authenticated;

-- Atomic operations. All functions are SECURITY INVOKER, so Row Level Security applies
-- exactly as for direct table access. Each call runs in one transaction.
-- JSON payloads use the column names of the tables (snake_case).

-- Inserts at the end, or updates in place and keeps the position.
create function public.save_goal(p_goal jsonb) returns void
language plpgsql security invoker set search_path = public as $$
begin
  -- Two tabs adding at once would read the same max(position); take turns instead.
  perform pg_advisory_xact_lock(hashtext('goals:' || auth.uid()));
  insert into public.goals (id, name, description, created_at, position)
  values (
    p_goal ->> 'id', p_goal ->> 'name', coalesce(p_goal ->> 'description', ''),
    (p_goal ->> 'created_at')::date,
    coalesce((select max(position) + 1 from public.goals), 0)
  )
  on conflict (user_id, id) do update set
    name = excluded.name, description = excluded.description,
    created_at = excluded.created_at;
  insert into public.plan_settings (goal_id, start_date, target_date, hours_per_day)
  values (
    p_goal ->> 'id', (p_goal ->> 'start_date')::date, (p_goal ->> 'target_date')::date,
    (p_goal ->> 'hours_per_day')::numeric
  )
  on conflict (user_id, goal_id) do update set
    start_date = excluded.start_date, target_date = excluded.target_date,
    hours_per_day = excluded.hours_per_day;
end $$;

create function public.save_phase(p_goal_id text, p_phase jsonb) returns void
language plpgsql security invoker set search_path = public as $$
begin
  perform pg_advisory_xact_lock(hashtext('phases:' || auth.uid() || ':' || p_goal_id));
  insert into public.phases (goal_id, id, name, description, color, position)
  values (
    p_goal_id, p_phase ->> 'id', p_phase ->> 'name', coalesce(p_phase ->> 'description', ''),
    p_phase ->> 'color',
    coalesce((select max(position) + 1 from public.phases where goal_id = p_goal_id), 0)
  )
  on conflict (user_id, id) do update set
    name = excluded.name, description = excluded.description, color = excluded.color
    where public.phases.goal_id = excluded.goal_id;
  -- Ids are unique per user, so an id already used by another plan updates nothing.
  if not found then
    raise exception 'phase id % is already used in another plan', p_phase ->> 'id' using errcode = '23505';
  end if;
end $$;

create function public.save_resource(p_goal_id text, p_resource jsonb) returns void
language plpgsql security invoker set search_path = public as $$
begin
  perform pg_advisory_xact_lock(hashtext('resources:' || auth.uid() || ':' || p_goal_id));
  insert into public.resources (
    goal_id, id, title, url, type, minutes, notes, phase_id, created_at, position
  )
  values (
    p_goal_id, p_resource ->> 'id', p_resource ->> 'title', coalesce(p_resource ->> 'url', ''),
    p_resource ->> 'type', (p_resource ->> 'minutes')::integer,
    coalesce(p_resource ->> 'notes', ''),
    p_resource ->> 'phase_id', (p_resource ->> 'created_at')::date,
    coalesce((select max(position) + 1 from public.resources where goal_id = p_goal_id), 0)
  )
  on conflict (user_id, id) do update set
    title = excluded.title, url = excluded.url, type = excluded.type,
    minutes = excluded.minutes, notes = excluded.notes,
    phase_id = excluded.phase_id, created_at = excluded.created_at
    where public.resources.goal_id = excluded.goal_id;
  if not found then
    raise exception 'resource id % is already used in another plan', p_resource ->> 'id' using errcode = '23505';
  end if;
  -- Progress is the owner's own. No progress at all is stored as no row.
  if coalesce((p_resource ->> 'done')::boolean, false)
     or coalesce((p_resource ->> 'done_minutes')::integer, 0) > 0
     or p_resource ->> 'done_at' is not null
     or p_resource ->> 'started_at' is not null then
    insert into public.resource_progress (resource_id, done_minutes, done, done_at, started_at)
    values (
      p_resource ->> 'id', coalesce((p_resource ->> 'done_minutes')::integer, 0),
      coalesce((p_resource ->> 'done')::boolean, false),
      (p_resource ->> 'done_at')::date, (p_resource ->> 'started_at')::date
    )
    on conflict (user_id, resource_id) do update set
      done_minutes = excluded.done_minutes, done = excluded.done,
      done_at = excluded.done_at, started_at = excluded.started_at;
  else
    delete from public.resource_progress where resource_id = p_resource ->> 'id';
  end if;
end $$;

-- Numbers every row of the plan 0..n-1: the ids in p_ids first, in that order, then any
-- row not in the list (added by another device meanwhile) after them in its old order.
create function public.reorder_resources(p_goal_id text, p_ids text[]) returns void
language sql security invoker set search_path = public as $$
  update public.resources r set position = n.pos
  from (
    select x.id, row_number() over (order by o.pos nulls last, x.position, x.id) - 1 as pos
    from public.resources x
    left join unnest(p_ids) with ordinality as o(id, pos) on o.id = x.id
    where x.goal_id = p_goal_id
  ) n
  where r.goal_id = p_goal_id and r.id = n.id;
$$;

create function public.reorder_phases(p_goal_id text, p_ids text[]) returns void
language sql security invoker set search_path = public as $$
  update public.phases p set position = n.pos
  from (
    select x.id, row_number() over (order by o.pos nulls last, x.position, x.id) - 1 as pos
    from public.phases x
    left join unnest(p_ids) with ordinality as o(id, pos) on o.id = x.id
    where x.goal_id = p_goal_id
  ) n
  where p.goal_id = p_goal_id and p.id = n.id;
$$;

-- Writes one plan with its phases and resources. Phases and resources of the plan that
-- are not in the payload are removed, so the stored plan equals the payload.
create function public.save_goal_tree(p_goal jsonb) returns void
language plpgsql security invoker set search_path = public as $$
declare
  gid text := p_goal ->> 'id';
begin
  perform public.save_goal(p_goal);
  delete from public.resources
    where goal_id = gid and id <> all (coalesce(
      (select array_agg(e ->> 'id') from jsonb_array_elements(p_goal -> 'resources') e), '{}'));
  delete from public.phases
    where goal_id = gid and id <> all (coalesce(
      (select array_agg(e ->> 'id') from jsonb_array_elements(p_goal -> 'phases') e), '{}'));
  perform public.save_phase(gid, e.value) from jsonb_array_elements(p_goal -> 'phases') e;
  perform public.save_resource(gid, e.value) from jsonb_array_elements(p_goal -> 'resources') e;
  perform public.reorder_phases(gid,
    coalesce((select array_agg(t.e ->> 'id' order by t.o)
      from jsonb_array_elements(p_goal -> 'phases') with ordinality as t(e, o)), '{}'));
  perform public.reorder_resources(gid,
    coalesce((select array_agg(t.e ->> 'id' order by t.o)
      from jsonb_array_elements(p_goal -> 'resources') with ordinality as t(e, o)), '{}'));
end $$;

create function public.delete_all_data() returns void
language plpgsql security invoker set search_path = public as $$
begin
  delete from public.profiles where user_id = auth.uid();
  delete from public.goals where user_id = auth.uid();
end $$;

-- Replaces everything with { active_goal_id, goals: [ <goal tree>, ... ] }.
create function public.replace_all_data(p_data jsonb) returns void
language plpgsql security invoker set search_path = public as $$
declare
  g jsonb;
begin
  perform public.delete_all_data();
  for g in select value from jsonb_array_elements(coalesce(p_data -> 'goals', '[]')) loop
    perform public.save_goal_tree(g);
  end loop;
  insert into public.profiles (active_goal_id) values (p_data ->> 'active_goal_id')
  on conflict (user_id) do update set active_goal_id = excluded.active_goal_id;
end $$;

-- Everything the signed-in user owns, read in one statement so it is one consistent
-- snapshot (separate requests could see another device's save half-way). It is a single
-- jsonb value, so PostgREST's row limit does not apply either.
create function public.load_all_data() returns jsonb
language sql stable security invoker set search_path = public as $$
  select jsonb_build_object(
    -- Content and the owner's own state are joined back into the shape the app stores.
    'goals', coalesce((
      select jsonb_agg(
        to_jsonb(g) || jsonb_build_object(
          'start_date', s.start_date, 'target_date', s.target_date, 'hours_per_day', s.hours_per_day)
        order by g.position, g.id)
      from public.goals g
      left join public.plan_settings s on s.user_id = g.user_id and s.goal_id = g.id), '[]'),
    'phases', coalesce((select jsonb_agg(to_jsonb(p) order by p.position, p.id) from public.phases p), '[]'),
    'resources', coalesce((
      select jsonb_agg(
        to_jsonb(r) || jsonb_build_object(
          'done_minutes', coalesce(q.done_minutes, 0), 'done', coalesce(q.done, false),
          'done_at', q.done_at, 'started_at', q.started_at)
        order by r.position, r.id)
      from public.resources r
      left join public.resource_progress q on q.user_id = r.user_id and q.resource_id = r.id), '[]'),
    'active_goal_id', (select active_goal_id from public.profiles limit 1)
  );
$$;

-- Adds plans after the existing ones; nothing already saved is touched.
create function public.append_goals(p_goals jsonb, p_active_goal_id text) returns void
language plpgsql security invoker set search_path = public as $$
declare
  g jsonb;
begin
  for g in select value from jsonb_array_elements(coalesce(p_goals, '[]')) loop
    perform public.save_goal_tree(g);
  end loop;
  if p_active_goal_id is not null then
    perform public.set_active_goal(p_active_goal_id);
  end if;
end $$;

create function public.set_active_goal(p_goal_id text) returns void
language sql security invoker set search_path = public as $$
  insert into public.profiles (active_goal_id) values (p_goal_id)
  on conflict (user_id) do update set active_goal_id = excluded.active_goal_id;
$$;

revoke all on function
  public.save_goal(jsonb), public.save_phase(text, jsonb), public.save_resource(text, jsonb),
  public.reorder_resources(text, text[]), public.reorder_phases(text, text[]),
  public.save_goal_tree(jsonb), public.delete_all_data(), public.replace_all_data(jsonb),
  public.set_active_goal(text), public.load_all_data(), public.append_goals(jsonb, text)
  from public, anon;
grant execute on function
  public.save_goal(jsonb), public.save_phase(text, jsonb), public.save_resource(text, jsonb),
  public.reorder_resources(text, text[]), public.reorder_phases(text, text[]),
  public.save_goal_tree(jsonb), public.delete_all_data(), public.replace_all_data(jsonb),
  public.set_active_goal(text), public.load_all_data(), public.append_goals(jsonb, text)
  to authenticated;

-- ---------------------------------------------------------------------------------------
-- Sharing. A plan can be shared as `unlisted` (anyone with the link) or `public` (also
-- listed in Explore). Only plan content is ever returned to other people: title,
-- description, phases and resources (title, link, type, estimate, notes). The functions
-- below never read plan_settings or resource_progress.
--
-- Owner-only Row Level Security stays on every table and `anon` still has no table access.
-- Other people read through the two narrow SECURITY DEFINER functions, which return
-- explicit columns. Writes to the sharing tables also go through SECURITY DEFINER
-- functions that check ownership themselves, so users cannot edit `hidden` (takedown)
-- or `copy_count` directly.
-- ---------------------------------------------------------------------------------------

create table public.plan_shares (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  goal_id text not null,
  visibility text not null check (visibility in ('unlisted', 'public')),
  slug text not null unique,
  tags text[] not null default '{}' check (cardinality(tags) <= 5),
  published_at timestamptz not null default now(),
  copy_count integer not null default 0,
  -- Set by a moderator (in SQL) to take a plan down without deleting it.
  hidden boolean not null default false,
  primary key (user_id, goal_id),
  foreign key (user_id, goal_id) references public.goals (user_id, id) on delete cascade
);
create index plan_shares_public_idx on public.plan_shares (published_at desc)
  where visibility = 'public' and not hidden;

-- One row per person who copied a plan, so copy_count counts people.
create table public.plan_copies (
  user_id uuid not null references auth.users (id) on delete cascade,
  owner_id uuid not null,
  goal_id text not null,
  primary key (user_id, owner_id, goal_id),
  foreign key (owner_id, goal_id) references public.plan_shares (user_id, goal_id) on delete cascade
);

create table public.plan_reports (
  id bigint generated always as identity primary key,
  slug text not null,
  reporter_id uuid not null references auth.users (id) on delete cascade,
  reason text not null check (char_length(reason) between 1 and 500),
  created_at timestamptz not null default now(),
  unique (reporter_id, slug)
);

alter table public.plan_shares enable row level security;
alter table public.plan_copies enable row level security;
alter table public.plan_reports enable row level security;
create policy plan_shares_owner_read on public.plan_shares for select to authenticated
  using (user_id = (select auth.uid()));
-- plan_copies and plan_reports have no policy: nobody reads them through the API.

revoke all on public.plan_shares, public.plan_copies, public.plan_reports from anon, authenticated;
grant select on public.plan_shares to authenticated;

-- A plan for anyone with its link. Null when the link is wrong, private or taken down.
create function public.get_shared_plan(p_slug text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'slug', s.slug, 'visibility', s.visibility, 'tags', to_jsonb(s.tags),
    'published_at', s.published_at, 'copy_count', s.copy_count,
    'author', p.display_name,
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

-- Summaries of public plans, newest first. Unlisted plans never appear.
create function public.list_public_plans(p_query text, p_tag text, p_limit integer, p_offset integer)
returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(t.item order by t.published_at desc, t.slug), '[]')
  from (
    select s.published_at, s.slug, jsonb_build_object(
      'slug', s.slug, 'name', g.name, 'description', g.description, 'author', p.display_name,
      'tags', to_jsonb(s.tags), 'published_at', s.published_at, 'copy_count', s.copy_count,
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
    where s.visibility = 'public' and not s.hidden
      -- A plan that is still empty is shared but not listed until it has a resource.
      and rs.n > 0
      and (p_tag is null or p_tag = '' or lower(p_tag) = any (s.tags))
      and (
        p_query is null or btrim(p_query) = ''
        or g.name ilike '%' || replace(replace(replace(btrim(p_query), '\', '\\'), '%', '\%'), '_', '\_') || '%'
        or g.description ilike '%' || replace(replace(replace(btrim(p_query), '\', '\\'), '%', '\%'), '_', '\_') || '%'
      )
    order by s.published_at desc, s.slug
    limit least(greatest(coalesce(p_limit, 24), 1), 50) offset greatest(coalesce(p_offset, 0), 0)
  ) t
$$;

-- Sets how a plan the caller owns is shared. 'private' stops sharing. Returns the new settings.
-- A plan can be shared while empty (it is chosen when the plan is created). A non-null
-- p_display_name sets the author name in the same call, so going public is one step.
create function public.set_plan_sharing(
  p_goal_id text, p_visibility text, p_tags text[], p_display_name text default null)
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
  if p_display_name is not null then
    perform public.set_display_name(p_display_name);
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

-- Sign-up can pass a name as user metadata ({ display_name }); this makes it the profile's
-- display_name, so it is set even before the email is confirmed.
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (user_id, display_name)
  values (new.id, nullif(left(btrim(coalesce(new.raw_user_meta_data ->> 'display_name', '')), 40), ''))
  on conflict (user_id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

create function public.set_display_name(p_name text) returns void
language sql security invoker set search_path = public as $$
  insert into public.profiles (display_name) values (nullif(btrim(p_name), ''))
  on conflict (user_id) do update set display_name = excluded.display_name;
$$;

-- Counts each person's first copy of a plan. People copying their own plan do not count.
create function public.record_plan_copy(p_slug text) returns void
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
  insert into public.plan_copies (user_id, owner_id, goal_id)
  values (uid, share.user_id, share.goal_id) on conflict do nothing;
  if found then
    update public.plan_shares set copy_count = copy_count + 1
    where user_id = share.user_id and goal_id = share.goal_id;
  end if;
end $$;

create function public.report_plan(p_slug text, p_reason text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  if not exists (select 1 from public.plan_shares where slug = p_slug) then
    raise exception 'plan not found' using errcode = 'P0002';
  end if;
  insert into public.plan_reports (slug, reporter_id, reason)
  values (p_slug, auth.uid(), left(btrim(p_reason), 500))
  on conflict (reporter_id, slug) do nothing;
end $$;

revoke all on function
  public.get_shared_plan(text), public.list_public_plans(text, text, integer, integer),
  public.set_plan_sharing(text, text, text[], text), public.set_display_name(text),
  public.record_plan_copy(text), public.report_plan(text, text)
  from public, anon;
grant execute on function
  public.get_shared_plan(text), public.list_public_plans(text, text, integer, integer)
  to anon, authenticated;
grant execute on function
  public.set_plan_sharing(text, text, text[], text), public.set_display_name(text),
  public.record_plan_copy(text), public.report_plan(text, text)
  to authenticated;
