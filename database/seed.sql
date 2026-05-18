-- Replace the user_id value below with an Auth0 user id from your tenant before running.
-- Example: auth0|1234567890abcdef
\set seed_user_id 'auth0|replace-me'

insert into ingredients (user_id, name, default_quantity, unit, kcal, protein_g, carbs_g, fat_g, notes)
values
  (:'seed_user_id', 'oats', 40, 'g', 150, 5, 27, 3, 'Base for breakfast bowls'),
  (:'seed_user_id', 'whey', 30, 'g', 120, 24, 2, 2, 'Protein powder'),
  (:'seed_user_id', 'halfvolle melk', 250, 'ml', 115, 8.5, 12, 3.8, 'Semi-skimmed milk'),
  (:'seed_user_id', 'banana', 1, 'piece', 105, 1.3, 27, 0.4, null),
  (:'seed_user_id', 'rice', 100, 'g', 130, 2.7, 28, 0.3, 'Cooked white rice'),
  (:'seed_user_id', 'chicken breast', 100, 'g', 165, 31, 0, 3.6, 'Cooked weight'),
  (:'seed_user_id', 'pasta', 100, 'g', 157, 5.8, 30, 0.9, 'Cooked pasta'),
  (:'seed_user_id', 'salmon', 100, 'g', 208, 20, 0, 13, null),
  (:'seed_user_id', 'skyr', 150, 'g', 95, 16, 6, 0.2, null),
  (:'seed_user_id', 'peanut butter', 15, 'g', 90, 3.5, 3, 7.5, null)
on conflict do nothing;

with created_recipes as (
  insert into recipes (user_id, name, meal_type, suitable_day_types, suitable_timing, preparation_notes, tags)
  values
    (:'seed_user_id', 'Performance oats', 'breakfast', array['gym', 'interval_bike'], array['pre_workout', 'neutral'], 'Mix oats, milk, whey and banana.', array['quick', 'high-carb']),
    (:'seed_user_id', 'Rijst + kip bowl', 'lunch', array['gym', 'endurance_bike'], array['post_workout', 'neutral'], 'Serve rice with sliced chicken breast.', array['meal-prep']),
    (:'seed_user_id', 'Zalm + groenten', 'dinner', array['rest', 'endurance_bike'], array['evening_recovery', 'neutral'], 'Add vegetables of choice after the foundation schema is extended.', array['omega-3'])
  returning id, name
)
insert into recipe_ingredients (user_id, recipe_id, ingredient_id, quantity, unit)
select :'seed_user_id', r.id, i.id, x.quantity, x.unit
from created_recipes r
join (
  values
    ('Performance oats', 'oats', 80, 'g'),
    ('Performance oats', 'whey', 30, 'g'),
    ('Performance oats', 'halfvolle melk', 250, 'ml'),
    ('Performance oats', 'banana', 1, 'piece'),
    ('Rijst + kip bowl', 'rice', 200, 'g'),
    ('Rijst + kip bowl', 'chicken breast', 150, 'g'),
    ('Zalm + groenten', 'salmon', 150, 'g'),
    ('Zalm + groenten', 'rice', 150, 'g')
) as x(recipe_name, ingredient_name, quantity, unit) on x.recipe_name = r.name
join ingredients i on i.user_id = :'seed_user_id' and i.name = x.ingredient_name;
