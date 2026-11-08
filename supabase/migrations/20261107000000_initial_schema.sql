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
