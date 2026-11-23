-- pgTAP tests. Run with: supabase test db   (needs the local stack: supabase start)
begin;
create extension if not exists pgtap with schema extensions;
select plan(116);

-- Two users and some data for each, created as the table owner.
insert into auth.users (id, instance_id, aud, role, email)
values
  ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a@example.test'),
  ('00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'b@example.test');

-- A provider name (Google gives full_name, others name) becomes the display name; the sign-up
-- name wins over it, and a blank one falls through to the random name.
insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data)
values
  ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'c1@example.test', '{"full_name": "  Grace Hopper ", "name": "Other"}'),
  ('00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'c2@example.test', '{"name": "Alan Turing"}'),
  ('00000000-0000-0000-0000-0000000000c3', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'c3@example.test', '{"display_name": "Ada", "full_name": "Grace Hopper"}'),
  ('00000000-0000-0000-0000-0000000000c4', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'c4@example.test', '{"full_name": "   "}');
select is((select display_name from public.profiles where user_id = '00000000-0000-0000-0000-0000000000c1'), 'Grace Hopper', 'a Google full name is used, trimmed');
select is((select display_name from public.profiles where user_id = '00000000-0000-0000-0000-0000000000c2'), 'Alan Turing', 'a provider name is used when there is no full name');
select is((select display_name from public.profiles where user_id = '00000000-0000-0000-0000-0000000000c3'), 'Ada', 'the sign-up name wins');
select is((select display_name ~ '^[A-Z][a-z]+ [A-Z][a-z]+ [0-9]{2}$' from public.profiles where user_id = '00000000-0000-0000-0000-0000000000c4'), true, 'a blank provider name gets a random one');

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
      {"id": "r1", "title": "R1", "type": "read", "minutes": 30, "created_at": "2026-01-01", "phase_id": "p1"},
      {"id": "r2", "title": "R2", "type": "watch", "minutes": 60, "created_at": "2026-01-01"}]
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

-- Content and the owner's own state live in separate tables.
select is((select hours_per_day from public.plan_settings where goal_id = 'g1'), 1.5, 'the schedule is stored in plan_settings');
select lives_ok($$ select public.save_resource('g1', '{"id": "r3", "title": "R3b", "type": "course", "minutes": 90,
  "created_at": "2026-01-01", "done": true, "done_minutes": 90, "done_at": "2026-02-01"}'::jsonb) $$, 'saving progress runs');
select is((select count(*)::int from public.resource_progress where resource_id = 'r3'), 1, 'progress is stored in resource_progress');
select is((select (e ->> 'done')::boolean from jsonb_array_elements(public.load_all_data() -> 'resources') e where e ->> 'id' = 'r3'), true, 'load_all_data joins progress back onto the resource');
select lives_ok($$ select public.save_resource('g1', '{"id": "r3", "title": "R3b", "type": "course", "minutes": 90, "created_at": "2026-01-01"}'::jsonb) $$, 'saving without progress runs');
select is((select count(*)::int from public.resource_progress where resource_id = 'r3'), 0, 'no progress is stored as no row');
select lives_ok($$ select public.save_resource('g1', '{"id": "r3", "title": "R3b", "type": "course", "minutes": 90, "created_at": "2026-01-01", "logged_on": "2026-02-01", "logged_minutes": 25}'::jsonb) $$, 'saving only a study tally runs');
select is((select (e ->> 'logged_minutes')::int || ' on ' || (e ->> 'logged_on') from jsonb_array_elements(public.load_all_data() -> 'resources') e where e ->> 'id' = 'r3'), '25 on 2026-02-01', 'the tally is stored and loaded back');
select lives_ok($$ select public.save_resource('g1', '{"id": "r3", "title": "R3b", "type": "course", "minutes": 90, "created_at": "2026-01-01", "started_at": "2026-02-01"}'::jsonb) $$, 're-adding progress for the isolation checks');

-- Atomic: a bad row anywhere rolls back the whole append.
select throws_ok($$
  select public.append_goals('[
    {"id": "n1", "name": "New", "description": "", "target_date": "2027-01-01", "created_at": "2026-01-01",
     "phases": [], "resources": [{"id": "bad", "title": "x", "type": "read", "minutes": 0, "created_at": "2026-01-01"}]}]'::jsonb, null)
$$, '23514', null, 'invalid data is rejected');
select is((select count(*)::int from public.goals where id in ('g1', 'n1')), 1, 'and nothing of it is saved, the old data is still there');

-- Isolation: user B sees nothing of A, and cannot change it.
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
select is((select count(*)::int from public.goals), 0, 'B sees no plans of A');
select is((select count(*)::int from public.resources), 0, 'B sees no resources of A');
select is((select count(*)::int from public.resource_progress) + (select count(*)::int from public.plan_settings), 0, 'B sees no progress or schedule of A');
select is(jsonb_array_length(public.load_all_data() -> 'goals'), 0, 'load_all_data returns none of A''s plans to B');
delete from public.goals where id = 'g1';
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
select is((select count(*)::int from public.goals), 1, 'B cannot delete A''s plan');

-- Writing a row for someone else is refused.
select throws_ok($$
  insert into public.goals (user_id, id, name, created_at)
  values ('00000000-0000-0000-0000-00000000000b', 'evil', 'x', '2026-01-01')
$$, '42501', null, 'cannot insert a row owned by another user');

-- Study log: per user, absolute saves, zero removes a day.
select lives_ok($$ select public.save_study_day('2026-03-10', 25) $$, 'A logs a day');
select lives_ok($$ select public.save_study_day('2026-03-10', 40) $$, 'saving the day again sets it');
select is((select minutes from public.study_log where day = '2026-03-10'), 40, 'the value is absolute, not added');
select is((select count(*)::int from public.study_log), 1, 'one row per day');
select throws_ok($$ select public.save_study_day('2026-03-11', 1441) $$, '23514', null, 'a day cannot exceed 24 hours');
select lives_ok($$ select public.save_study_day('2026-03-11', 5) $$, 'A logs a second day');
select lives_ok($$ select public.save_study_day('2026-03-11', 0) $$, 'zero minutes');
select is((select count(*)::int from public.study_log), 1, 'removes that day');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
select is((select count(*)::int from public.study_log), 0, 'B cannot see A''s study log');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');

-- The anon role gets nothing.
reset role;
set local role anon;
select throws_ok($$ select count(*) from public.goals $$, '42501', null, 'anon cannot read plans');
select throws_ok($$ select count(*) from public.resource_progress $$, '42501', null, 'anon cannot read progress');
select throws_ok($$ select count(*) from public.study_log $$, '42501', null, 'anon cannot read the study log');

-- Appending keeps what is saved; an id used by another plan is an error, not a silent skip.
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
select lives_ok($$
  select public.append_goals('[{"id": "g2", "name": "Second", "description": "", "target_date": "2027-01-01",
    "created_at": "2026-01-01", "phases": [], "resources": []}]'::jsonb, 'g2')
$$, 'append_goals adds a plan');
select is((select array_agg(id order by position) from public.goals), array['g1', 'g2'], 'and keeps the existing plan first');
select throws_ok($$
  select public.save_resource('g2', '{"id": "r1", "title": "x", "type": "read", "minutes": 5, "created_at": "2026-01-01"}'::jsonb)
$$, '23505', null, 'a resource id used by another plan is rejected');

-- Sharing. Other people get content only, never progress, dates or daily hours.
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
select is((select display_name ~ '^[A-Z][a-z]+ [A-Z][a-z]+ [0-9]{2}$' from public.profiles), true, 'a new account is given a random name');
select lives_ok($$ select public.set_display_name('  Ada  ') $$, 'the name can be changed');
select is((select display_name from public.profiles), 'Ada', 'and is trimmed and saved');
select throws_ok($$ select public.set_display_name('   ') $$, '23514', null, 'a blank name is rejected');
select is((select display_name from public.profiles), 'Ada', 'and does not clear the saved name');
select lives_ok($$ select public.set_display_name('Ada') $$, 'restore the name');
select lives_ok($$ select public.set_plan_sharing('g1', 'unlisted', array['Swift', ' swift ', 'ios']) $$, 'share a plan by link');
select is((select tags from public.plan_shares where goal_id = 'g1'), array['ios', 'swift'], 'tags are normalised');
select lives_ok($$ select public.set_plan_sharing('g2', 'unlisted', '{}') $$, 'a plan can be shared before it has resources');
select throws_ok($$ select public.set_plan_sharing('nope', 'unlisted', '{}') $$, 'P0002', null, 'only the owner''s plans can be shared');
create temp table shared_slug as select slug from public.plan_shares where goal_id = 'g1';
grant all on shared_slug to anon, authenticated;

select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
select throws_ok($$ select public.set_plan_sharing('g1', 'public', '{}') $$, 'P0002', null, 'B cannot share A''s plan');
select is((select count(*)::int from public.plan_shares), 0, 'B cannot read A''s sharing settings');

reset role;
set local role anon;
select is((select public.get_shared_plan((select slug from shared_slug)) ->> 'name'), 'A plan', 'anyone with the link can open an unlisted plan');
select is(jsonb_array_length(public.get_shared_plan((select slug from shared_slug)) -> 'resources'), 3, 'with its resources');
select is((public.get_shared_plan((select slug from shared_slug))::text ~ '(done|started_at|target_date|start_date|hours_per_day|user_id)'), false, 'and no progress, dates, daily hours or user id');
select is(jsonb_array_length(public.list_public_plans(null, null, 24, 0)), 0, 'an unlisted plan is not in the public list');
select is(public.get_shared_plan('wrong'), null, 'an unknown link finds nothing');
select throws_ok($$ select count(*) from public.plan_shares $$, '42501', null, 'anon cannot read the sharing table');

select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
select lives_ok($$ select public.set_plan_sharing('g1', 'public', '{}') $$, 'make it public');
select throws_ok($$ update public.plan_shares set hidden = false, copy_count = 99 $$, '42501', null, 'the owner cannot edit moderation or copy counts');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
select lives_ok($$ select public.record_plan_copy((select slug from shared_slug)) $$, 'B copies the plan');
select lives_ok($$ select public.record_plan_copy((select slug from shared_slug)) $$, 'copying twice');
reset role;
select is((select copy_count from public.plan_shares where goal_id = 'g1'), 1, 'counts each person once');
set local role anon;
select is((public.list_public_plans('plan', null, 24, 0) -> 0 ->> 'resource_count')::int, 3, 'a public plan is listed with its counts');
select is(public.list_public_plans('plan', null, 24, 0) -> 0 ->> 'author', 'Ada', 'the author is the owner''s account name');
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
select lives_ok($$ select public.set_display_name('Ada Lovelace') $$, 'the owner renames their account');
reset role;
set local role anon;
select is(public.get_shared_plan((select slug from shared_slug)) ->> 'author', 'Ada Lovelace', 'and the author of the shared plan follows the new name');
select is(jsonb_array_length(public.list_public_plans('100%', null, 24, 0)), 0, 'search treats % literally');
reset role;
update public.plan_shares set tags = array['ios', 'swift'] where goal_id = 'g1';
set local role anon;
select is(jsonb_array_length(public.list_public_plans('swi', null, 24, 0)), 1, 'search also matches tags');
select is(jsonb_array_length(public.list_public_plans(null, null, 24, 0, 'popular')), 1, 'a plan can be listed most copied first');
select is(public.list_popular_tags(10) -> 0 ->> 'tag', 'ios', 'popular tags are listed for anyone');
select is(public.similar_plans((select slug from shared_slug)), '[]'::jsonb, 'a plan is never similar to itself');

-- Favorites: signed-in only, once per person, not your own plan, and they can be undone.
select throws_ok($$ select public.set_plan_favorite((select slug from shared_slug), true) $$, '42501', null, 'anon cannot favorite a plan');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
select lives_ok($$ select public.set_plan_favorite((select slug from shared_slug), true) $$, 'B favorites the plan');
select lives_ok($$ select public.set_plan_favorite((select slug from shared_slug), true) $$, 'favoriting twice is harmless');
select is((public.get_shared_plan((select slug from shared_slug)) ->> 'favorite_count')::int, 1, 'each person counts once');
select is(public.get_shared_plan((select slug from shared_slug)) -> 'favorited', 'true'::jsonb, 'and B sees it as favorited');
select is(jsonb_array_length(public.list_my_favorites(24, 0)), 1, 'B lists their favorites');
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
select lives_ok($$ select public.set_plan_favorite((select slug from shared_slug), true) $$, 'the owner favoriting their own plan is ignored');
reset role;
select is((select count(*)::int from public.plan_favorites), 1, 'and is not counted');
set local role anon;
select is(public.get_shared_plan((select slug from shared_slug)) -> 'favorited', 'false'::jsonb, 'anyone else sees it as not favorited');
select is((public.list_public_plans(null, null, 24, 0, 'favorites') -> 0 ->> 'favorite_count')::int, 1, 'a plan can be listed most favorited first');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
select lives_ok($$ select public.set_plan_favorite((select slug from shared_slug), false) $$, 'B un-favorites the plan');
select is(jsonb_array_length(public.list_my_favorites(24, 0)), 0, 'and it leaves their list');
select lives_ok($$ select public.set_plan_favorite((select slug from shared_slug), true) $$, 'favorite it again');
reset role;
update public.plan_shares set hidden = true where goal_id = 'g1';
set local role anon;
select is(public.get_shared_plan((select slug from shared_slug)), null, 'a taken-down plan is gone');
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
select lives_ok($$ select public.set_plan_sharing('g1', 'private', '{}') $$, 'the owner of a taken-down plan can set it private');
select lives_ok($$ select public.set_plan_sharing('g1', 'public', '{}') $$, 'and share it again');
select is((select hidden from public.plan_shares where goal_id = 'g1'), true, 'but it stays taken down');
reset role;
update public.plan_shares set hidden = false where goal_id = 'g1';
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
select lives_ok($$ select public.set_plan_sharing('g1', 'private', '{}') $$, 'stop sharing');
reset role;
select is((select count(*)::int from public.plan_favorites), 0, 'and stopping sharing removes its favorites');
set local role anon;
select is(public.get_shared_plan((select slug from shared_slug)), null, 'a private plan has no link');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
select lives_ok($$ select public.set_plan_sharing('g2', 'public', '{}') $$, 'an empty plan can be made public');
set local role anon;
select is(jsonb_array_length(public.list_public_plans(null, null, 24, 0)), 0, 'but it is not listed until it has a resource');

-- A copy shows where it came from once it is shared; the link works only while the original is shared.
select lives_ok($$
  select public.save_goal('{"id": "g3", "name": "A copy", "description": "", "created_at": "2026-01-01",
    "source_slug": "some-slug", "source_name": "A plan"}'::jsonb)
$$, 'a copy keeps where it came from');
select lives_ok($$ select public.set_plan_sharing('g3', 'public', '{}') $$, 'and can be shared');
create temp table copy_slug as select slug from public.plan_shares where goal_id = 'g3';
grant all on copy_slug to anon, authenticated;
set local role anon;
select is(public.get_shared_plan((select slug from copy_slug)) -> 'source' ->> 'name', 'A plan', 'a shared copy shows its origin');
select is(public.get_shared_plan((select slug from copy_slug)) -> 'source' -> 'available', 'false'::jsonb, 'and not as a link when the original is not shared');
select is(public.get_shared_plan((select slug from copy_slug)) -> 'source' -> 'slug', 'null'::jsonb, 'and never reveals the link of an original that is not public');

-- Deleting the account: anon cannot, and it removes only the caller's data.
set local role anon;
select throws_ok($$ select public.delete_account() $$, '42501', null, 'anon cannot delete an account');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
select lives_ok($$ select public.delete_account() $$, 'a user can delete their own account');
reset role;
select is((select count(*)::int from auth.users where id = '00000000-0000-0000-0000-00000000000b'), 0, 'the user is gone');
select is((select count(*)::int from auth.users where id = '00000000-0000-0000-0000-00000000000a'), 1, 'other users are untouched');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
select lives_ok($$ select public.delete_account() $$, 'a user with plans and shares can delete their account');
reset role;
select is((select count(*)::int from public.goals) + (select count(*)::int from public.plan_shares), 0, 'and all their plans and shares are gone');

select * from finish();
rollback;
