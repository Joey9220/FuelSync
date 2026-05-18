import postgres from "postgres";

const databaseUrl = process.env.DATABASE_URL;
const userId = process.env.SEED_USER_ID;

if (!databaseUrl) throw new Error("DATABASE_URL is required.");
if (!userId) throw new Error("SEED_USER_ID is required.");

const sql = postgres(databaseUrl, { ssl: "require", max: 1 });

const ingredients = [
  ["oats", 40, "g", 150, 5, 27, 3, "Base for breakfast bowls"],
  ["whey", 30, "g", 120, 24, 2, 2, "Protein powder"],
  ["halfvolle melk", 250, "ml", 115, 8.5, 12, 3.8, "Semi-skimmed milk"],
  ["banana", 1, "piece", 105, 1.3, 27, 0.4, null],
  ["rice", 100, "g", 130, 2.7, 28, 0.3, "Cooked white rice"],
  ["chicken breast", 100, "g", 165, 31, 0, 3.6, "Cooked weight"],
  ["pasta", 100, "g", 157, 5.8, 30, 0.9, "Cooked pasta"],
  ["salmon", 100, "g", 208, 20, 0, 13, null],
  ["skyr", 150, "g", 95, 16, 6, 0.2, null],
  ["peanut butter", 15, "g", 90, 3.5, 3, 7.5, null],
];

const recipes = [
  {
    name: "Performance oats",
    meal: "breakfast",
    days: ["gym", "interval_bike"],
    timing: ["pre_workout", "neutral"],
    notes: "Mix oats, milk, whey and banana.",
    tags: ["quick", "high-carb"],
    items: [
      ["oats", 80, "g"],
      ["whey", 30, "g"],
      ["halfvolle melk", 250, "ml"],
      ["banana", 1, "piece"],
    ],
  },
  {
    name: "Rijst + kip bowl",
    meal: "lunch",
    days: ["gym", "endurance_bike"],
    timing: ["post_workout", "neutral"],
    notes: "Serve rice with sliced chicken breast.",
    tags: ["meal-prep"],
    items: [
      ["rice", 200, "g"],
      ["chicken breast", 150, "g"],
    ],
  },
  {
    name: "Zalm + groenten",
    meal: "dinner",
    days: ["rest", "endurance_bike"],
    timing: ["evening_recovery", "neutral"],
    notes: "Add vegetables of choice after the foundation schema is extended.",
    tags: ["omega-3"],
    items: [
      ["salmon", 150, "g"],
      ["rice", 150, "g"],
    ],
  },
];

try {
  for (const item of ingredients) {
    const [name, qty, unit, kcal, protein, carbs, fat, notes] = item;
    const exists = await sql`
      select id from ingredients
      where user_id = ${userId} and name = ${name}
    `;

    if (!exists.length) {
      await sql`
        insert into ingredients (user_id, name, default_quantity, unit, kcal, protein_g, carbs_g, fat_g, notes)
        values (${userId}, ${name}, ${qty}, ${unit}, ${kcal}, ${protein}, ${carbs}, ${fat}, ${notes})
      `;
    }
  }

  for (const recipe of recipes) {
    const existing = await sql`
      select id from recipes
      where user_id = ${userId} and name = ${recipe.name}
    `;

    if (existing.length) continue;

    const [created] = await sql`
      insert into recipes (user_id, name, meal_type, suitable_day_types, suitable_timing, preparation_notes, tags)
      values (${userId}, ${recipe.name}, ${recipe.meal}, ${recipe.days}, ${recipe.timing}, ${recipe.notes}, ${recipe.tags})
      returning id
    `;

    for (const [ingredientName, quantity, unit] of recipe.items) {
      const [ingredient] = await sql`
        select id from ingredients
        where user_id = ${userId} and name = ${ingredientName}
      `;

      await sql`
        insert into recipe_ingredients (user_id, recipe_id, ingredient_id, quantity, unit)
        values (${userId}, ${created.id}, ${ingredient.id}, ${quantity}, ${unit})
      `;
    }
  }

  const [counts] = await sql`
    select
      (select count(*)::int from ingredients where user_id = ${userId}) as ingredients,
      (select count(*)::int from recipes where user_id = ${userId}) as recipes
  `;

  console.log(JSON.stringify(counts));
} finally {
  await sql.end();
}
