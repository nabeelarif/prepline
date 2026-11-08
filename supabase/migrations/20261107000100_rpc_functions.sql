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
