import { requireAuth } from "./_shared/auth";
import { db } from "./_shared/db";
import { fail, ok, parseJson } from "./_shared/http";
import type { Handler } from "./_shared/netlify-types";
import { optionalNonNegativeInteger, requireEnum, targetGoals } from "./_shared/validation";

export const handler: Handler = async (event) => {
  try {
    const { userId } = await requireAuth(event);
    const sql = db();

    if (event.httpMethod === "GET") {
      const [preferences] = await sql`
        insert into user_preferences (user_id, target_goal)
        values (${userId}, 'maintenance')
        on conflict (user_id) do update set user_id = excluded.user_id
        returning target_goal, height_cm
      `;
      return ok({ preferences });
    }

    if (event.httpMethod === "PUT") {
      const payload = parseJson<Record<string, unknown>>(event.body);
      const targetGoal = requireEnum(payload, "target_goal", targetGoals);
      const heightCm = optionalNonNegativeInteger(payload, "height_cm");
      const [preferences] = await sql`
        insert into user_preferences (user_id, target_goal, height_cm)
        values (${userId}, ${targetGoal}, ${heightCm})
        on conflict (user_id)
        do update set
          target_goal = excluded.target_goal,
          height_cm = coalesce(excluded.height_cm, user_preferences.height_cm)
        returning target_goal, height_cm
      `;
      return ok({ preferences });
    }

    return ok({ error: "Method not allowed." }, 405);
  } catch (error) {
    return fail(error);
  }
};
