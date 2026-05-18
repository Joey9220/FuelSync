import { requireAuth } from "./_shared/auth";
import { db } from "./_shared/db";
import { fail, ok, parseJson } from "./_shared/http";
import type { Handler } from "./_shared/netlify-types";
import { mealTypes, optionalString, requireDate, requireEnum } from "./_shared/validation";

export const handler: Handler = async (event) => {
  try {
    const { userId } = await requireAuth(event);
    const sql = db();
    const date = event.queryStringParameters?.date;

    if (event.httpMethod === "GET") {
      if (!date) throw Object.assign(new Error("date query parameter is required."), { statusCode: 400 });
      const rows = await sql`
        select dms.*, r.name as recipe_name
        from daily_meal_selections dms
        left join recipes r on r.id = dms.selected_recipe_id and r.user_id = ${userId}
        where dms.user_id = ${userId} and dms.date = ${date}
        order by dms.meal_type asc
      `;
      return ok({ selections: rows });
    }

    if (event.httpMethod === "PUT") {
      const payload = validateSelection(parseJson<Record<string, unknown>>(event.body));

      if (payload.selected_recipe_id) {
        const [recipe] = await sql`
          select id
          from recipes
          where id = ${payload.selected_recipe_id} and user_id = ${userId} and meal_type = ${payload.meal_type}
        `;
        if (!recipe) {
          throw Object.assign(new Error("Selected recipe does not belong to the user or meal type."), { statusCode: 400 });
        }
      }

      const [selection] = await sql`
        insert into daily_meal_selections (user_id, date, meal_type, selected_recipe_id)
        values (${userId}, ${payload.date}, ${payload.meal_type}, ${payload.selected_recipe_id})
        on conflict (user_id, date, meal_type)
        do update set selected_recipe_id = excluded.selected_recipe_id
        returning *
      `;
      return ok({ selection });
    }

    return ok({ error: "Method not allowed." }, 405);
  } catch (error) {
    return fail(error);
  }
};

function validateSelection(fields: Record<string, unknown>) {
  return {
    date: requireDate(fields, "date"),
    meal_type: requireEnum(fields, "meal_type", mealTypes),
    selected_recipe_id: optionalString(fields, "selected_recipe_id"),
  };
}
