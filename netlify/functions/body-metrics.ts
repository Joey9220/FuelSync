import { requireAuth } from "./_shared/auth";
import { db } from "./_shared/db";
import { fail, ok } from "./_shared/http";
import type { Handler } from "./_shared/netlify-types";

export const handler: Handler = async (event) => {
  try {
    if (event.httpMethod !== "GET") return ok({ error: "Method not allowed." }, 405);

    const { userId } = await requireAuth(event);
    const rawDays = Number(event.queryStringParameters?.days || 30);
    const days = Math.min(Number.isFinite(rawDays) ? rawDays : 30, 3650);
    const sql = db();
    const metrics = await sql`
      select *
      from body_metrics
      where user_id = ${userId}
        and measured_at >= now() - (${days}::int * interval '1 day')
      order by measured_at asc
    `;
    const [connection] = await sql`
      select user_id, last_synced_at
      from withings_connections
      where user_id = ${userId}
    `;

    return ok({ metrics, connected: Boolean(connection), last_synced_at: connection?.last_synced_at ?? null });
  } catch (error) {
    return fail(error);
  }
};
