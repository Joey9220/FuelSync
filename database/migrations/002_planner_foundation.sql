create table if not exists activities (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  date date not null,
  activity_type text not null check (activity_type in ('rest', 'gym', 'interval_bike', 'endurance_bike')),
  start_time time,
  duration_minutes integer check (duration_minutes is null or duration_minutes > 0),
  intensity text check (intensity is null or intensity in ('low', 'medium', 'high')),
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists daily_meal_selections (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  date date not null,
  meal_type text not null check (meal_type in ('breakfast', 'lunch', 'dinner', 'snack')),
  selected_recipe_id uuid references recipes(id) on delete set null,
  created_at timestamptz default now(),
  constraint daily_meal_selections_unique unique (user_id, date, meal_type)
);

create table if not exists macro_targets (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  day_type text not null check (day_type in ('rest', 'gym', 'interval_bike', 'endurance_bike')),
  kcal_min integer,
  kcal_max integer,
  protein_min integer,
  carbs_min integer,
  carbs_max integer,
  fat_min integer,
  fat_max integer,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint macro_targets_unique unique (user_id, day_type)
);

create index if not exists activities_user_id_date_idx on activities(user_id, date);
create index if not exists daily_meal_selections_user_id_date_idx on daily_meal_selections(user_id, date);
create index if not exists macro_targets_user_id_day_type_idx on macro_targets(user_id, day_type);

alter table recipes drop constraint if exists recipes_timing_allowed;
alter table recipes add constraint recipes_timing_allowed check (
  suitable_timing <@ array['pre_workout', 'post_workout', 'neutral', 'evening_recovery', 'carb_support']::text[]
);

drop trigger if exists activities_set_updated_at on activities;
create trigger activities_set_updated_at
before update on activities
for each row execute function set_updated_at();

drop trigger if exists macro_targets_set_updated_at on macro_targets;
create trigger macro_targets_set_updated_at
before update on macro_targets
for each row execute function set_updated_at();
