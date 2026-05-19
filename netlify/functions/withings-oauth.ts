import { requireAuth } from "./_shared/auth";
import { db } from "./_shared/db";
import { fail, ok, parseJson } from "./_shared/http";
import type { Handler } from "./_shared/netlify-types";
import { exchangeCodeForToken, upsertWithingsConnection } from "./_shared/withings";

export const handler: Handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") return ok({ error: "Method not allowed." }, 405);

    const { userId } = await requireAuth(event);
    const payload = parseJson<Record<string, unknown>>(event.body);
    if (typeof payload.code !== "string" || !payload.code) {
      throw Object.assign(new Error("code is required."), { statusCode: 400 });
    }

    const token = await exchangeCodeForToken(payload.code);
    await upsertWithingsConnection(db(), userId, token);
    return ok({ connected: true });
  } catch (error) {
    return fail(error);
  }
};
