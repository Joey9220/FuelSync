import { requireAuth } from "./_shared/auth";
import { db } from "./_shared/db";
import { fail, ok, parseJson } from "./_shared/http";
import type { Handler } from "./_shared/netlify-types";
import { dayTypes, optionalNonNegativeInteger, requireEnum } from "./_shared/validation";

export const handler: Handler = async (event) => {
  try {
    const { userId } = await requireAuth(event);
    const sql = db();

    if (event.httpMethod === "GET") {
      const rows = await sql`
        select *
        from macro_targets
        where user_id = ${userId}
        order by array_position(array['rest','gym','interval_bike','endurance_bike'], day_type)
      `;
      return ok({ targets: rows });
    }

    if (event.httpMethod === "PUT") {
      const payload = validateTarget(parseJson<Record<string, unknown>>(event.body));
      const [target] = await sql`
        insert into macro_targets (
          user_id, day_type, kcal_min, kcal_max, protein_min, carbs_min, carbs_max, fat_min, fat_max
        )
        values (
          ${userId}, ${payload.day_type}, ${payload.kcal_min}, ${payload.kcal_max}, ${payload.protein_min},
          ${payload.carbs_min}, ${payload.carbs_max}, ${payload.fat_min}, ${payload.fat_max}
        )
        on conflict (user_id, day_type)
        do update set
          kcal_min = excluded.kcal_min,
          kcal_max = excluded.kcal_max,
          protein_min = excluded.protein_min,
          carbs_min = excluded.carbs_min,
          carbs_max = excluded.carbs_max,
          fat_min = excluded.fat_min,
          fat_max = excluded.fat_max
        returning *
      `;
      return ok({ target });
    }

    return ok({ error: "Method not allowed." }, 405);
  } catch (error) {
    return fail(error);
  }
};

function validateTarget(fields: Record<string, unknown>) {
  return {
    day_type: requireEnum(fields, "day_type", dayTypes),
    kcal_min: optionalNonNegativeInteger(fields, "kcal_min"),
    kcal_max: optionalNonNegativeInteger(fields, "kcal_max"),
    protein_min: optionalNonNegativeInteger(fields, "protein_min"),
    carbs_min: optionalNonNegativeInteger(fields, "carbs_min"),
    carbs_max: optionalNonNegativeInteger(fields, "carbs_max"),
    fat_min: optionalNonNegativeInteger(fields, "fat_min"),
    fat_max: optionalNonNegativeInteger(fields, "fat_max"),
  };
}
