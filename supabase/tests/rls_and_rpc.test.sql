-- pgTAP tests. Run with: supabase test db   (needs the local stack: supabase start)
begin;
create extension if not exists pgtap with schema extensions;
select plan(26);

-- Two users and some data for each, created as the table owner.
insert into auth.users (id, instance_id, aud, role, email)
values
  ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a@example.test'),
  ('00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'b@example.test');

-- Acts as user A for the following statements.
create function pg_temp.as_user(uid text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  set local role authenticated;
end $$;

select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');

select lives_ok($$
  select public.save_goal_tree('{
    "id": "g1", "name": "A plan", "description": "", "target_date": "2027-01-01",
    "hours_per_day": 1.5, "created_at": "2026-01-01",
    "phases": [{"id": "p1", "name": "One", "description": "", "color": "blue"},
               {"id": "p2", "name": "Two", "description": "", "color": "red"}],
    "resources": [
      {"id": "r1", "title": "R1", "type": "article", "minutes": 30, "created_at": "2026-01-01", "phase_id": "p1"},
      {"id": "r2", "title": "R2", "type": "video", "minutes": 60, "created_at": "2026-01-01"}]
  }'::jsonb)
$$, 'user A saves a plan tree');

select is((select count(*)::int from public.resources), 2, 'A sees both resources');
select is((select array_agg(id order by position) from public.resources), array['r1', 'r2'], 'order follows the payload');

select lives_ok($$ select public.reorder_resources('g1', array['r2', 'r1']) $$, 'reorder runs');
select is((select array_agg(id order by position) from public.resources), array['r2', 'r1'], 'reorder is applied');

select lives_ok($$ select public.save_resource('g1', '{"id": "r3", "title": "R3", "type": "course", "minutes": 90, "created_at": "2026-01-01"}'::jsonb) $$, 'append a resource');
select is((select position from public.resources where id = 'r3'), 2, 'a new resource goes last');
select lives_ok($$ select public.save_resource('g1', '{"id": "r3", "title": "R3b", "type": "course", "minutes": 90, "created_at": "2026-01-01"}'::jsonb) $$, 'saving again is an update');
select is((select count(*)::int from public.resources where id = 'r3'), 1, 'retrying a save does not duplicate');
select is((select position from public.resources where id = 'r3'), 2, 'an update keeps the position');

delete from public.phases where id = 'p1';
select is((select phase_id from public.resources where id = 'r1'), null, 'deleting a phase unassigns its resources');
select is((select count(*)::int from public.resources), 3, 'and keeps them');

select is(jsonb_array_length(public.load_all_data() -> 'resources'), 3, 'load_all_data returns the user''s rows');
-- A row missing from the list (added by another device) is renumbered after the listed ones.
select lives_ok($$ select public.reorder_resources('g1', array['r3']) $$, 'reorder with a partial list runs');
select is((select array_agg(id order by position) from public.resources), array['r3', 'r2', 'r1'], 'unlisted rows follow in their old order');

-- Atomic: a bad row anywhere rolls back the whole replace.
select throws_ok($$
  select public.replace_all_data('{"active_goal_id": null, "goals": [
    {"id": "n1", "name": "New", "description": "", "target_date": "2027-01-01", "created_at": "2026-01-01",
     "phases": [], "resources": [{"id": "bad", "title": "x", "type": "article", "minutes": 0, "created_at": "2026-01-01"}]}]}'::jsonb)
$$, '23514', null, 'invalid data is rejected');
select is((select count(*)::int from public.goals where id = 'g1'), 1, 'and the old data is still there');

-- Isolation: user B sees nothing of A, and cannot change it.
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
select is((select count(*)::int from public.goals), 0, 'B sees no plans of A');
select is((select count(*)::int from public.resources), 0, 'B sees no resources of A');
select is(jsonb_array_length(public.load_all_data() -> 'goals'), 0, 'load_all_data returns none of A''s plans to B');
delete from public.goals where id = 'g1';
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
select is((select count(*)::int from public.goals), 1, 'B cannot delete A''s plan');

-- Writing a row for someone else is refused.
select throws_ok($$
  insert into public.goals (user_id, id, name, target_date, created_at)
  values ('00000000-0000-0000-0000-00000000000b', 'evil', 'x', '2027-01-01', '2026-01-01')
$$, '42501', null, 'cannot insert a row owned by another user');

-- The anon role gets nothing.
reset role;
set local role anon;
select throws_ok($$ select count(*) from public.goals $$, '42501', null, 'anon cannot read plans');

-- Appending keeps what is saved; an id used by another plan is an error, not a silent skip.
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
select lives_ok($$
  select public.append_goals('[{"id": "g2", "name": "Second", "description": "", "target_date": "2027-01-01",
    "created_at": "2026-01-01", "phases": [], "resources": []}]'::jsonb, 'g2')
$$, 'append_goals adds a plan');
select is((select array_agg(id order by position) from public.goals), array['g1', 'g2'], 'and keeps the existing plan first');
select throws_ok($$
  select public.save_resource('g2', '{"id": "r1", "title": "x", "type": "article", "minutes": 5, "created_at": "2026-01-01"}'::jsonb)
$$, '23505', null, 'a resource id used by another plan is rejected');

select * from finish();
rollback;
