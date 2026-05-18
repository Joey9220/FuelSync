import type postgres from "postgres";
import { requireAuth } from "./_shared/auth";
import { db } from "./_shared/db";
import { fail, noContent, ok, parseJson } from "./_shared/http";
import type { Handler } from "./_shared/netlify-types";
import {
  dayTypes,
  mealTypes,
  optionalString,
  optionalStringArray,
  requireEnum,
  requirePositiveNumber,
  requireString,
  timingTypes,
} from "./_shared/validation";

type RecipeIngredientPayload = {
  ingredient_id: string;
  quantity: number;
  unit: string;
};

type RecipePayload = {
  name: string;
  meal_type: string;
  suitable_day_types: string[];
  suitable_timing: string[];
  preparation_notes: string | null;
  tags: string[];
  ingredients: RecipeIngredientPayload[];
};

export const handler: Handler = async (event) => {
  try {
    const { userId } = await requireAuth(event);
    const sql = db();
    const id = event.queryStringParameters?.id;
    const mealType = event.queryStringParameters?.meal_type;

    if (event.httpMethod === "GET") {
      const recipes = mealType && mealTypes.includes(mealType as (typeof mealTypes)[number])
        ? await sql`select * from recipes where user_id = ${userId} and meal_type = ${mealType} order by created_at desc`
        : await sql`select * from recipes where user_id = ${userId} order by created_at desc`;
      const recipeIds = recipes.map((recipe) => recipe.id);
      const items = recipeIds.length
        ? await sql`
            select
              ri.id,
              ri.recipe_id,
              ri.ingredient_id,
              ri.quantity,
              ri.unit,
              i.name,
              i.default_quantity,
              i.kcal,
              i.protein_g,
              i.carbs_g,
              i.fat_g
            from recipe_ingredients ri
            join ingredients i on i.id = ri.ingredient_id and i.user_id = ${userId}
            where ri.user_id = ${userId} and ri.recipe_id in ${sql(recipeIds)}
            order by i.name asc
          `
        : [];

      return ok({ recipes: recipes.map((recipe) => withIngredients(recipe, items)) });
    }

    if (event.httpMethod === "POST") {
      const payload = validateRecipe(parseJson<Record<string, unknown>>(event.body));
      const recipe = await sql.begin(async (tx) => {
        const [created] = await tx`
          insert into recipes (
            user_id, name, meal_type, suitable_day_types, suitable_timing, preparation_notes, tags
          )
          values (
            ${userId}, ${payload.name}, ${payload.meal_type}, ${payload.suitable_day_types},
            ${payload.suitable_timing}, ${payload.preparation_notes}, ${payload.tags}
          )
          returning *
        `;
        await replaceRecipeIngredients(tx, userId, created.id, payload.ingredients);
        return created;
      });
      return ok({ recipe }, 201);
    }

    if (event.httpMethod === "PUT") {
      if (!id) throw Object.assign(new Error("id query parameter is required."), { statusCode: 400 });
      const payload = validateRecipe(parseJson<Record<string, unknown>>(event.body));
      const recipe = await sql.begin(async (tx) => {
        const [updated] = await tx`
          update recipes
          set
            name = ${payload.name},
            meal_type = ${payload.meal_type},
            suitable_day_types = ${payload.suitable_day_types},
            suitable_timing = ${payload.suitable_timing},
            preparation_notes = ${payload.preparation_notes},
            tags = ${payload.tags}
          where id = ${id} and user_id = ${userId}
          returning *
        `;
        if (!updated) throw Object.assign(new Error("Recipe not found."), { statusCode: 404 });
        await replaceRecipeIngredients(tx, userId, updated.id, payload.ingredients);
        return updated;
      });
      return ok({ recipe });
    }

    if (event.httpMethod === "DELETE") {
      if (!id) throw Object.assign(new Error("id query parameter is required."), { statusCode: 400 });
      const result = await sql`
        delete from recipes
        where id = ${id} and user_id = ${userId}
        returning id
      `;
      if (result.count === 0) throw Object.assign(new Error("Recipe not found."), { statusCode: 404 });
      return noContent();
    }

    return ok({ error: "Method not allowed." }, 405);
  } catch (error) {
    return fail(error);
  }
};

function validateRecipe(fields: Record<string, unknown>): RecipePayload {
  const ingredients = fields.ingredients;
  if (!Array.isArray(ingredients)) {
    throw Object.assign(new Error("ingredients must be an array."), { statusCode: 400 });
  }

  return {
    name: requireString(fields, "name"),
    meal_type: requireEnum(fields, "meal_type", mealTypes),
    suitable_day_types: optionalStringArray(fields, "suitable_day_types", dayTypes),
    suitable_timing: optionalStringArray(fields, "suitable_timing", timingTypes),
    preparation_notes: optionalString(fields, "preparation_notes"),
    tags: optionalStringArray(fields, "tags"),
    ingredients: ingredients.map((item) => {
      if (!item || typeof item !== "object") {
        throw Object.assign(new Error("Each recipe ingredient must be an object."), { statusCode: 400 });
      }
      const record = item as Record<string, unknown>;
      return {
        ingredient_id: requireString(record, "ingredient_id"),
        quantity: requirePositiveNumber(record, "quantity"),
        unit: requireString(record, "unit"),
      };
    }),
  };
}

async function replaceRecipeIngredients(
  tx: postgres.TransactionSql,
  userId: string,
  recipeId: string,
  ingredients: RecipeIngredientPayload[],
) {
  await tx`delete from recipe_ingredients where recipe_id = ${recipeId} and user_id = ${userId}`;

  for (const item of ingredients) {
    const [ingredient] = await tx`
      select id
      from ingredients
      where id = ${item.ingredient_id} and user_id = ${userId}
    `;
    if (!ingredient) {
      throw Object.assign(new Error("Recipe contains an ingredient that does not belong to the user."), {
        statusCode: 400,
      });
    }

    await tx`
      insert into recipe_ingredients (user_id, recipe_id, ingredient_id, quantity, unit)
      values (${userId}, ${recipeId}, ${item.ingredient_id}, ${item.quantity}, ${item.unit})
    `;
  }
}

function withIngredients(recipe: Record<string, unknown>, items: postgres.Row[]) {
  const recipeItems = items.filter((item) => item.recipe_id === recipe.id);
  const totals = recipeItems.reduce(
    (acc, item) => {
      const scale = Number(item.quantity) / Number(item.default_quantity);
      acc.kcal += Number(item.kcal) * scale;
      acc.protein_g += Number(item.protein_g) * scale;
      acc.carbs_g += Number(item.carbs_g) * scale;
      acc.fat_g += Number(item.fat_g) * scale;
      return acc;
    },
    { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 },
  );

  return {
    ...recipe,
    ingredients: recipeItems,
    totals: {
      kcal: Math.round(totals.kcal),
      protein_g: roundMacro(totals.protein_g),
      carbs_g: roundMacro(totals.carbs_g),
      fat_g: roundMacro(totals.fat_g),
    },
  };
}

function roundMacro(value: number) {
  return Math.round(value * 10) / 10;
}
