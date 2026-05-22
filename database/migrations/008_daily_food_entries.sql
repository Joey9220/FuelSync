create table if not exists daily_food_entries (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  date date not null,
  meal_type text not null check (meal_type in ('breakfast', 'lunch', 'dinner', 'snack')),
  entry_type text not null check (entry_type in ('recipe', 'ingredient')),
  recipe_id uuid references recipes(id) on delete cascade,
  ingredient_id uuid references ingredients(id) on delete cascade,
  quantity numeric,
  unit text,
  ingredient_overrides jsonb not null default '[]'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint daily_food_entries_recipe_shape check (
    (entry_type = 'recipe' and recipe_id is not null and ingredient_id is null)
    or
    (entry_type = 'ingredient' and ingredient_id is not null and recipe_id is null and quantity is not null and quantity > 0 and unit is not null)
  ),
  constraint daily_food_entries_overrides_array check (jsonb_typeof(ingredient_overrides) = 'array')
);

create index if not exists daily_food_entries_user_id_date_idx on daily_food_entries(user_id, date);
create index if not exists daily_food_entries_recipe_id_idx on daily_food_entries(recipe_id);
create index if not exists daily_food_entries_ingredient_id_idx on daily_food_entries(ingredient_id);

drop trigger if exists daily_food_entries_set_updated_at on daily_food_entries;
create trigger daily_food_entries_set_updated_at
before update on daily_food_entries
for each row execute function set_updated_at();
