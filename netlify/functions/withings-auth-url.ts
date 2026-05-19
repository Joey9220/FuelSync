import crypto from "node:crypto";
import { requireAuth } from "./_shared/auth";
import { fail, ok } from "./_shared/http";
import type { Handler } from "./_shared/netlify-types";
import { withingsConfig } from "./_shared/withings";

export const handler: Handler = async (event) => {
  try {
    if (event.httpMethod !== "GET") return ok({ error: "Method not allowed." }, 405);
    await requireAuth(event);

    const config = withingsConfig();
    const state = crypto.randomBytes(24).toString("hex");
    const params = new URLSearchParams({
      response_type: "code",
      client_id: config.clientId,
      redirect_uri: config.callbackUrl,
      scope: "user.metrics",
      state,
    });

    return ok({ url: `https://account.withings.com/oauth2_user/authorize2?${params}`, state });
  } catch (error) {
    return fail(error);
  }
};
