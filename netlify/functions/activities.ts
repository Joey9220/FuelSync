import { requireAuth } from "./_shared/auth";
import { db } from "./_shared/db";
import { fail, noContent, ok, parseJson } from "./_shared/http";
import type { Handler } from "./_shared/netlify-types";
import {
  dayTypes,
  intensityTypes,
  optionalEnum,
  optionalPositiveInteger,
  optionalString,
  requireDate,
  requireEnum,
} from "./_shared/validation";

type ActivityPayload = {
  date: string;
  activity_type: string;
  start_time: string | null;
  duration_minutes: number | null;
  intensity: string | null;
  notes: string | null;
};

export const handler: Handler = async (event) => {
  try {
    const { userId } = await requireAuth(event);
    const sql = db();
    const id = event.queryStringParameters?.id;
    const from = event.queryStringParameters?.from;
    const to = event.queryStringParameters?.to;
    const date = event.queryStringParameters?.date;

    if (event.httpMethod === "GET") {
      const rows = from && to
        ? await sql`
            select *
            from activities
            where user_id = ${userId} and date between ${from} and ${to}
            order by date asc, start_time asc nulls last, created_at asc
          `
        : date
          ? await sql`
              select *
              from activities
              where user_id = ${userId} and date = ${date}
              order by start_time asc nulls last, created_at asc
            `
          : await sql`
              select *
              from activities
              where user_id = ${userId}
              order by date desc, start_time asc nulls last
              limit 100
            `;
      return ok({ activities: rows });
    }

    if (event.httpMethod === "POST") {
      const payload = validateActivity(parseJson<Record<string, unknown>>(event.body));
      const [activity] = await sql`
        insert into activities (user_id, date, activity_type, start_time, duration_minutes, intensity, notes)
        values (
          ${userId}, ${payload.date}, ${payload.activity_type}, ${payload.start_time},
          ${payload.duration_minutes}, ${payload.intensity}, ${payload.notes}
        )
        returning *
      `;
      return ok({ activity }, 201);
    }

    if (event.httpMethod === "PUT") {
      if (!id) throw Object.assign(new Error("id query parameter is required."), { statusCode: 400 });
      const payload = validateActivity(parseJson<Record<string, unknown>>(event.body));
      const [activity] = await sql`
        update activities
        set
          date = ${payload.date},
          activity_type = ${payload.activity_type},
          start_time = ${payload.start_time},
          duration_minutes = ${payload.duration_minutes},
          intensity = ${payload.intensity},
          notes = ${payload.notes}
        where id = ${id} and user_id = ${userId}
        returning *
      `;
      if (!activity) throw Object.assign(new Error("Activity not found."), { statusCode: 404 });
      return ok({ activity });
    }

    if (event.httpMethod === "DELETE") {
      if (!id) throw Object.assign(new Error("id query parameter is required."), { statusCode: 400 });
      const result = await sql`
        delete from activities
        where id = ${id} and user_id = ${userId}
        returning id
      `;
      if (result.count === 0) throw Object.assign(new Error("Activity not found."), { statusCode: 404 });
      return noContent();
    }

    return ok({ error: "Method not allowed." }, 405);
  } catch (error) {
    return fail(error);
  }
};

function validateActivity(fields: Record<string, unknown>): ActivityPayload {
  return {
    date: requireDate(fields, "date"),
    activity_type: requireEnum(fields, "activity_type", dayTypes),
    start_time: optionalString(fields, "start_time"),
    duration_minutes: optionalPositiveInteger(fields, "duration_minutes"),
    intensity: optionalEnum(fields, "intensity", intensityTypes),
    notes: optionalString(fields, "notes"),
  };
}
