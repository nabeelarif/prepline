-- Road to Goals: initial database schema. Run once in the Supabase SQL Editor (or psql).
-- Later changes go in supabase/migrations/ as new, ordered .sql files.

-- Road to Goals: initial schema.
--
-- Every row belongs to one user (auth.users.id, which never changes when sign-in
-- methods are linked). Row Level Security restricts every table to its owner, so the
-- frontend's anon key can never read or write another user's data.
--
-- Ids are text because plans created before the move to Supabase and imported files
-- use short ids. Primary keys include user_id so two users can never collide.
-- Order is the `position` column (0-based); the app treats it as array order.

create table public.profiles (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  active_goal_id text
);

create table public.goals (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id text not null,
  name text not null check (char_length(name) <= 120),
  description text not null default '' check (char_length(description) <= 1000),
  target_date date not null,
  hours_per_day numeric check (hours_per_day is null or hours_per_day between 0.25 and 16),
  created_at date not null,
  position integer not null default 0,
  primary key (user_id, id)
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
  done_minutes integer not null default 0 check (done_minutes >= 0),
  notes text not null default '',
  done boolean not null default false,
  done_at date,
  started_at date,
  phase_id text,
  created_at date not null,
  position integer not null default 0,
  primary key (user_id, id),
  foreign key (user_id, goal_id) references public.goals (user_id, id) on delete cascade,
  -- Deleting a phase keeps its resources in the plan, just without a phase.
  foreign key (user_id, goal_id, phase_id) references public.phases (user_id, goal_id, id)
    on delete set null (phase_id)
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
alter table public.phases enable row level security;
alter table public.resources enable row level security;

create policy profiles_owner on public.profiles for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy goals_owner on public.goals for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy phases_owner on public.phases for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy resources_owner on public.resources for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

revoke all on public.profiles, public.goals, public.phases, public.resources from anon;
grant select, insert, update, delete
  on public.profiles, public.goals, public.phases, public.resources to authenticated;

-- Atomic operations. All functions are SECURITY INVOKER, so Row Level Security applies
-- exactly as for direct table access. Each call runs in one transaction.
-- JSON payloads use the column names of the tables (snake_case).

-- Inserts at the end, or updates in place and keeps the position.
create function public.save_goal(p_goal jsonb) returns void
language plpgsql security invoker set search_path = public as $$
begin
  insert into public.goals (id, name, description, target_date, hours_per_day, created_at, position)
  values (
    p_goal ->> 'id', p_goal ->> 'name', coalesce(p_goal ->> 'description', ''),
    (p_goal ->> 'target_date')::date, (p_goal ->> 'hours_per_day')::numeric,
    (p_goal ->> 'created_at')::date,
    coalesce((select max(position) + 1 from public.goals), 0)
  )
  on conflict (user_id, id) do update set
    name = excluded.name, description = excluded.description,
    target_date = excluded.target_date, hours_per_day = excluded.hours_per_day,
    created_at = excluded.created_at;
end $$;

create function public.save_phase(p_goal_id text, p_phase jsonb) returns void
language plpgsql security invoker set search_path = public as $$
begin
  insert into public.phases (goal_id, id, name, description, color, position)
  values (
    p_goal_id, p_phase ->> 'id', p_phase ->> 'name', coalesce(p_phase ->> 'description', ''),
    p_phase ->> 'color',
    coalesce((select max(position) + 1 from public.phases where goal_id = p_goal_id), 0)
  )
  on conflict (user_id, id) do update set
    name = excluded.name, description = excluded.description, color = excluded.color
    where public.phases.goal_id = excluded.goal_id;
end $$;

create function public.save_resource(p_goal_id text, p_resource jsonb) returns void
language plpgsql security invoker set search_path = public as $$
begin
  insert into public.resources (
    goal_id, id, title, url, type, minutes, done_minutes, notes, done,
    done_at, started_at, phase_id, created_at, position
  )
  values (
    p_goal_id, p_resource ->> 'id', p_resource ->> 'title', coalesce(p_resource ->> 'url', ''),
    p_resource ->> 'type', (p_resource ->> 'minutes')::integer,
    coalesce((p_resource ->> 'done_minutes')::integer, 0), coalesce(p_resource ->> 'notes', ''),
    coalesce((p_resource ->> 'done')::boolean, false),
    (p_resource ->> 'done_at')::date, (p_resource ->> 'started_at')::date,
    p_resource ->> 'phase_id', (p_resource ->> 'created_at')::date,
    coalesce((select max(position) + 1 from public.resources where goal_id = p_goal_id), 0)
  )
  on conflict (user_id, id) do update set
    title = excluded.title, url = excluded.url, type = excluded.type,
    minutes = excluded.minutes, done_minutes = excluded.done_minutes, notes = excluded.notes,
    done = excluded.done, done_at = excluded.done_at, started_at = excluded.started_at,
    phase_id = excluded.phase_id, created_at = excluded.created_at
    where public.resources.goal_id = excluded.goal_id;
end $$;

create function public.reorder_resources(p_goal_id text, p_ids text[]) returns void
language sql security invoker set search_path = public as $$
  update public.resources r set position = o.pos - 1
  from unnest(p_ids) with ordinality as o(id, pos)
  where r.goal_id = p_goal_id and r.id = o.id;
$$;

create function public.reorder_phases(p_goal_id text, p_ids text[]) returns void
language sql security invoker set search_path = public as $$
  update public.phases p set position = o.pos - 1
  from unnest(p_ids) with ordinality as o(id, pos)
  where p.goal_id = p_goal_id and p.id = o.id;
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

create function public.set_active_goal(p_goal_id text) returns void
language sql security invoker set search_path = public as $$
  insert into public.profiles (active_goal_id) values (p_goal_id)
  on conflict (user_id) do update set active_goal_id = excluded.active_goal_id;
$$;

revoke all on function
  public.save_goal(jsonb), public.save_phase(text, jsonb), public.save_resource(text, jsonb),
  public.reorder_resources(text, text[]), public.reorder_phases(text, text[]),
  public.save_goal_tree(jsonb), public.delete_all_data(), public.replace_all_data(jsonb),
  public.set_active_goal(text)
  from public, anon;
grant execute on function
  public.save_goal(jsonb), public.save_phase(text, jsonb), public.save_resource(text, jsonb),
  public.reorder_resources(text, text[]), public.reorder_phases(text, text[]),
  public.save_goal_tree(jsonb), public.delete_all_data(), public.replace_all_data(jsonb),
  public.set_active_goal(text)
  to authenticated;
