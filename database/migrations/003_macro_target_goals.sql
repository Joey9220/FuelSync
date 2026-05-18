alter table macro_targets
add column if not exists target_goal text not null default 'maintenance';

alter table macro_targets drop constraint if exists macro_targets_goal_allowed;
alter table macro_targets add constraint macro_targets_goal_allowed check (
  target_goal in ('recomp', 'fat_loss', 'maintenance', 'cut', 'lean_bulk')
);

alter table macro_targets drop constraint if exists macro_targets_unique;
alter table macro_targets add constraint macro_targets_unique unique (user_id, target_goal, day_type);

drop index if exists macro_targets_user_id_day_type_idx;
create index if not exists macro_targets_user_id_goal_day_type_idx on macro_targets(user_id, target_goal, day_type);

create table if not exists user_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id text not null unique,
  target_goal text not null default 'maintenance' check (
    target_goal in ('recomp', 'fat_loss', 'maintenance', 'cut', 'lean_bulk')
  ),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists user_preferences_user_id_idx on user_preferences(user_id);

drop trigger if exists user_preferences_set_updated_at on user_preferences;
create trigger user_preferences_set_updated_at
before update on user_preferences
for each row execute function set_updated_at();
