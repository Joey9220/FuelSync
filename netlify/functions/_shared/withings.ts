import type postgres from "postgres";

export type WithingsToken = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  userid?: string;
  scope?: string;
};

export function withingsConfig() {
  const clientId = process.env.WITHINGS_CLIENT_ID;
  const clientSecret = process.env.WITHINGS_CLIENT_SECRET;
  const callbackUrl = process.env.WITHINGS_CALLBACK_URL;
  const apiEndpoint = process.env.WITHINGS_API_ENDPOINT || "https://wbsapi.withings.net";

  if (!clientId || !clientSecret || !callbackUrl) {
    throw Object.assign(new Error("Withings environment variables are missing."), { statusCode: 500 });
  }

  return { clientId, clientSecret, callbackUrl, apiEndpoint };
}

export async function exchangeCodeForToken(code: string): Promise<WithingsToken> {
  const config = withingsConfig();
  return tokenRequest({
    action: "requesttoken",
    grant_type: "authorization_code",
    client_id: config.clientId,
    client_secret: config.clientSecret,
    code,
    redirect_uri: config.callbackUrl,
  });
}

export async function refreshWithingsToken(refreshToken: string): Promise<WithingsToken> {
  const config = withingsConfig();
  return tokenRequest({
    action: "requesttoken",
    grant_type: "refresh_token",
    client_id: config.clientId,
    client_secret: config.clientSecret,
    refresh_token: refreshToken,
  });
}

export async function getValidWithingsAccessToken(sql: postgres.Sql, userId: string) {
  const [connection] = await sql`
    select *
    from withings_connections
    where user_id = ${userId}
  `;

  if (!connection) {
    throw Object.assign(new Error("Withings is not connected."), { statusCode: 400 });
  }

  if (new Date(connection.expires_at).getTime() > Date.now() + 60000) {
    return String(connection.access_token);
  }

  const token = await refreshWithingsToken(String(connection.refresh_token));
  await upsertWithingsConnection(sql, userId, token);
  return token.access_token;
}

export async function upsertWithingsConnection(sql: postgres.Sql, userId: string, token: WithingsToken) {
  const expiresAt = new Date(Date.now() + Number(token.expires_in) * 1000);
  await sql`
    insert into withings_connections (
      user_id, withings_user_id, access_token, refresh_token, expires_at, scope
    )
    values (
      ${userId}, ${token.userid ?? null}, ${token.access_token}, ${token.refresh_token}, ${expiresAt}, ${token.scope ?? null}
    )
    on conflict (user_id)
    do update set
      withings_user_id = excluded.withings_user_id,
      access_token = excluded.access_token,
      refresh_token = excluded.refresh_token,
      expires_at = excluded.expires_at,
      scope = excluded.scope
  `;
}

async function tokenRequest(params: Record<string, string>) {
  const config = withingsConfig();
  const response = await fetch(`${config.apiEndpoint}/v2/oauth2`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params),
  });

  const data = await response.json();
  if (!response.ok || data.status !== 0) {
    throw Object.assign(new Error(data.error || "Withings token request failed."), { statusCode: 502 });
  }

  return data.body as WithingsToken;
}
