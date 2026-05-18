create extension if not exists "pgcrypto";

create table if not exists ingredients (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  name text not null,
  default_quantity numeric not null check (default_quantity > 0),
  unit text not null,
  kcal numeric not null check (kcal >= 0),
  protein_g numeric not null check (protein_g >= 0),
  carbs_g numeric not null check (carbs_g >= 0),
  fat_g numeric not null check (fat_g >= 0),
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists recipes (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  name text not null,
  meal_type text not null check (meal_type in ('breakfast', 'lunch', 'dinner', 'snack')),
  suitable_day_types text[] not null default '{}',
  suitable_timing text[] not null default '{}',
  preparation_notes text,
  tags text[] default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint recipes_day_types_allowed check (
    suitable_day_types <@ array['rest', 'gym', 'interval_bike', 'endurance_bike']::text[]
  ),
  constraint recipes_timing_allowed check (
    suitable_timing <@ array['pre_workout', 'post_workout', 'neutral', 'evening_recovery']::text[]
  )
);

create table if not exists recipe_ingredients (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  recipe_id uuid not null references recipes(id) on delete cascade,
  ingredient_id uuid not null references ingredients(id),
  quantity numeric not null check (quantity > 0),
  unit text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists ingredients_user_id_idx on ingredients(user_id);
create index if not exists recipes_user_id_idx on recipes(user_id);
create index if not exists recipes_meal_type_idx on recipes(meal_type);
create index if not exists recipe_ingredients_user_id_idx on recipe_ingredients(user_id);
create index if not exists recipe_ingredients_recipe_id_idx on recipe_ingredients(recipe_id);
create index if not exists recipe_ingredients_ingredient_id_idx on recipe_ingredients(ingredient_id);

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists ingredients_set_updated_at on ingredients;
create trigger ingredients_set_updated_at
before update on ingredients
for each row execute function set_updated_at();

drop trigger if exists recipes_set_updated_at on recipes;
create trigger recipes_set_updated_at
before update on recipes
for each row execute function set_updated_at();

drop trigger if exists recipe_ingredients_set_updated_at on recipe_ingredients;
create trigger recipe_ingredients_set_updated_at
before update on recipe_ingredients
for each row execute function set_updated_at();
