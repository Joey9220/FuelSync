alter table ingredients
add column if not exists ingredient_type text not null default 'other';

create index if not exists ingredients_user_id_type_idx on ingredients(user_id, ingredient_type);
