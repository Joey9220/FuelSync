import { requireAuth } from "./_shared/auth";
import { db } from "./_shared/db";
import { fail, noContent, ok, parseJson } from "./_shared/http";
import type { Handler } from "./_shared/netlify-types";
import { mealTypes, optionalString, requireDate, requireEnum, requirePositiveNumber, requireString } from "./_shared/validation";

const entryTypes = ["recipe", "ingredient"] as const;

type IngredientOverride = {
  ingredient_id: string;
  quantity: number;
  unit: string;
};

type EntryPayload = {
  date: string;
  meal_type: (typeof mealTypes)[number];
  entry_type: (typeof entryTypes)[number];
  intake_time: string | null;
  recipe_id: string | null;
  ingredient_id: string | null;
  quantity: number | null;
  unit: string | null;
  ingredient_overrides: IngredientOverride[];
};

export const handler: Handler = async (event) => {
  try {
    const { userId } = await requireAuth(event);
    const sql = db();
    const id = event.queryStringParameters?.id;
    const date = event.queryStringParameters?.date;

    if (event.httpMethod === "GET") {
      if (!date) throw Object.assign(new Error("date query parameter is required."), { statusCode: 400 });
      const entries = await sql`
        select *
        from daily_food_entries
        where user_id = ${userId} and date = ${date}
        order by created_at asc
      `;
      return ok({ entries });
    }

    if (event.httpMethod === "POST") {
      const payload = validateEntry(parseJson<Record<string, unknown>>(event.body));
      await validateOwnership(sql, userId, payload);
      const [entry] = await sql`
        insert into daily_food_entries (
          user_id, date, meal_type, entry_type, intake_time, recipe_id, ingredient_id, quantity, unit, ingredient_overrides
        )
        values (
          ${userId}, ${payload.date}, ${payload.meal_type}, ${payload.entry_type}, ${payload.intake_time}, ${payload.recipe_id},
          ${payload.ingredient_id}, ${payload.quantity}, ${payload.unit}, ${sql.json(payload.ingredient_overrides)}
        )
        returning *
      `;
      return ok({ entry }, 201);
    }

    if (event.httpMethod === "PUT") {
      if (!id) throw Object.assign(new Error("id query parameter is required."), { statusCode: 400 });
      const payload = validateEntry(parseJson<Record<string, unknown>>(event.body));
      await validateOwnership(sql, userId, payload);
      const [entry] = await sql`
        update daily_food_entries
        set
          date = ${payload.date},
          meal_type = ${payload.meal_type},
          entry_type = ${payload.entry_type},
          intake_time = ${payload.intake_time},
          recipe_id = ${payload.recipe_id},
          ingredient_id = ${payload.ingredient_id},
          quantity = ${payload.quantity},
          unit = ${payload.unit},
          ingredient_overrides = ${sql.json(payload.ingredient_overrides)}
        where id = ${id} and user_id = ${userId}
        returning *
      `;
      if (!entry) throw Object.assign(new Error("Daily food entry not found."), { statusCode: 404 });
      return ok({ entry });
    }

    if (event.httpMethod === "DELETE") {
      if (!id) throw Object.assign(new Error("id query parameter is required."), { statusCode: 400 });
      const result = await sql`
        delete from daily_food_entries
        where id = ${id} and user_id = ${userId}
        returning id
      `;
      if (result.count === 0) throw Object.assign(new Error("Daily food entry not found."), { statusCode: 404 });
      return noContent();
    }

    return ok({ error: "Method not allowed." }, 405);
  } catch (error) {
    return fail(error);
  }
};

function validateEntry(fields: Record<string, unknown>): EntryPayload {
  const entry_type = requireEnum(fields, "entry_type", entryTypes);
  const overrides = validateOverrides(fields.ingredient_overrides);
  const intake_time = optionalTime(fields, "intake_time");

  if (entry_type === "recipe") {
    return {
      date: requireDate(fields, "date"),
      meal_type: requireEnum(fields, "meal_type", mealTypes),
      entry_type,
      intake_time,
      recipe_id: requireString(fields, "recipe_id"),
      ingredient_id: null,
      quantity: null,
      unit: null,
      ingredient_overrides: overrides,
    };
  }

  return {
    date: requireDate(fields, "date"),
    meal_type: requireEnum(fields, "meal_type", mealTypes),
    entry_type,
    intake_time,
    recipe_id: null,
    ingredient_id: requireString(fields, "ingredient_id"),
    quantity: requirePositiveNumber(fields, "quantity"),
    unit: requireString(fields, "unit"),
    ingredient_overrides: [],
  };
}

function optionalTime(fields: Record<string, unknown>, key: string) {
  const value = optionalString(fields, key);
  if (!value) return null;
  if (!/^\d{2}:\d{2}$/.test(value)) {
    throw Object.assign(new Error(`${key} must be HH:MM.`), { statusCode: 400 });
  }
  return value;
}

function validateOverrides(value: unknown): IngredientOverride[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) {
    throw Object.assign(new Error("ingredient_overrides must be an array."), { statusCode: 400 });
  }

  return value.map((item) => {
    if (!item || typeof item !== "object") {
      throw Object.assign(new Error("Each ingredient override must be an object."), { statusCode: 400 });
    }
    const record = item as Record<string, unknown>;
    return {
      ingredient_id: requireString(record, "ingredient_id"),
      quantity: requirePositiveNumber(record, "quantity"),
      unit: requireString(record, "unit"),
    };
  });
}

async function validateOwnership(sql: ReturnType<typeof db>, userId: string, payload: EntryPayload) {
  if (payload.entry_type === "recipe") {
    const [recipe] = await sql`
      select id
      from recipes
      where id = ${payload.recipe_id} and user_id = ${userId} and meal_type = ${payload.meal_type}
    `;
    if (!recipe) {
      throw Object.assign(new Error("Selected recipe does not belong to the user or meal type."), { statusCode: 400 });
    }

    if (payload.ingredient_overrides.length) {
      const ingredientIds = payload.ingredient_overrides.map((item) => item.ingredient_id);
      const rows = await sql`
        select ingredient_id
        from recipe_ingredients
        where user_id = ${userId} and recipe_id = ${payload.recipe_id} and ingredient_id in ${sql(ingredientIds)}
      `;
      if (rows.length !== new Set(ingredientIds).size) {
        throw Object.assign(new Error("Recipe overrides must belong to the selected recipe."), { statusCode: 400 });
      }
    }
    return;
  }

  const [ingredient] = await sql`
    select id
    from ingredients
    where id = ${payload.ingredient_id} and user_id = ${userId}
  `;
  if (!ingredient) throw Object.assign(new Error("Ingredient does not belong to the user."), { statusCode: 400 });
}
