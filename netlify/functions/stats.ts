import { requireAuth } from "./_shared/auth";
import { db } from "./_shared/db";
import { fail, ok } from "./_shared/http";
import type { Handler } from "./_shared/netlify-types";

export const handler: Handler = async (event) => {
  try {
    if (event.httpMethod !== "GET") return ok({ error: "Method not allowed." }, 405);

    const { userId } = await requireAuth(event);
    const sql = db();
    const [counts] = await sql`
      select
        (select count(*)::int from ingredients where user_id = ${userId}) as ingredients,
        (select count(*)::int from recipes where user_id = ${userId}) as recipes
    `;

    return ok({ stats: counts });
  } catch (error) {
    return fail(error);
  }
};
