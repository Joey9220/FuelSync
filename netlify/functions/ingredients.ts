import { requireAuth } from "./_shared/auth";
import { db } from "./_shared/db";
import { fail, noContent, ok, parseJson } from "./_shared/http";
import type { Handler } from "./_shared/netlify-types";
import {
  optionalString,
  requireNonNegativeNumber,
  requirePositiveNumber,
  requireString,
} from "./_shared/validation";

type IngredientPayload = {
  name: string;
  default_quantity: number;
  unit: string;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  notes: string | null;
};

export const handler: Handler = async (event) => {
  try {
    const { userId } = await requireAuth(event);
    const sql = db();
    const id = event.queryStringParameters?.id;
    const search = event.queryStringParameters?.search?.trim();

    if (event.httpMethod === "GET") {
      const rows = search
        ? await sql`
            select *
            from ingredients
            where user_id = ${userId} and name ilike ${`%${search}%`}
            order by name asc
          `
        : await sql`
            select *
            from ingredients
            where user_id = ${userId}
            order by name asc
          `;
      return ok({ ingredients: rows });
    }

    if (event.httpMethod === "POST") {
      const payload = validateIngredient(parseJson<Record<string, unknown>>(event.body));
      const [ingredient] = await sql`
        insert into ingredients (
          user_id, name, default_quantity, unit, kcal, protein_g, carbs_g, fat_g, notes
        )
        values (
          ${userId}, ${payload.name}, ${payload.default_quantity}, ${payload.unit},
          ${payload.kcal}, ${payload.protein_g}, ${payload.carbs_g}, ${payload.fat_g}, ${payload.notes}
        )
        returning *
      `;
      return ok({ ingredient }, 201);
    }

    if (event.httpMethod === "PUT") {
      if (!id) throw Object.assign(new Error("id query parameter is required."), { statusCode: 400 });
      const payload = validateIngredient(parseJson<Record<string, unknown>>(event.body));
      const [ingredient] = await sql`
        update ingredients
        set
          name = ${payload.name},
          default_quantity = ${payload.default_quantity},
          unit = ${payload.unit},
          kcal = ${payload.kcal},
          protein_g = ${payload.protein_g},
          carbs_g = ${payload.carbs_g},
          fat_g = ${payload.fat_g},
          notes = ${payload.notes}
        where id = ${id} and user_id = ${userId}
        returning *
      `;
      if (!ingredient) throw Object.assign(new Error("Ingredient not found."), { statusCode: 404 });
      return ok({ ingredient });
    }

    if (event.httpMethod === "DELETE") {
      if (!id) throw Object.assign(new Error("id query parameter is required."), { statusCode: 400 });
      const result = await sql`
        delete from ingredients
        where id = ${id} and user_id = ${userId}
        returning id
      `;
      if (result.count === 0) throw Object.assign(new Error("Ingredient not found."), { statusCode: 404 });
      return noContent();
    }

    return ok({ error: "Method not allowed." }, 405);
  } catch (error) {
    return fail(error);
  }
};

function validateIngredient(fields: Record<string, unknown>): IngredientPayload {
  return {
    name: requireString(fields, "name"),
    default_quantity: requirePositiveNumber(fields, "default_quantity"),
    unit: requireString(fields, "unit"),
    kcal: requireNonNegativeNumber(fields, "kcal"),
    protein_g: requireNonNegativeNumber(fields, "protein_g"),
    carbs_g: requireNonNegativeNumber(fields, "carbs_g"),
    fat_g: requireNonNegativeNumber(fields, "fat_g"),
    notes: optionalString(fields, "notes"),
  };
}
