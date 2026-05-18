import { createRemoteJWKSet, jwtVerify } from "jose";
import type { HandlerEvent } from "./netlify-types";

let jwks: ReturnType<typeof createRemoteJWKSet> | undefined;

export type AuthContext = {
  userId: string;
};

export async function requireAuth(event: HandlerEvent): Promise<AuthContext> {
  const domain = process.env.AUTH0_DOMAIN;
  const audience = process.env.AUTH0_AUDIENCE;

  if (!domain || !audience) {
    throw Object.assign(new Error("Auth0 server environment variables are missing."), { statusCode: 500 });
  }

  const token = getBearerToken(event.headers.authorization || event.headers.Authorization);
  if (!token) {
    throw Object.assign(new Error("Missing bearer token."), { statusCode: 401 });
  }

  jwks ??= createRemoteJWKSet(new URL(`https://${domain}/.well-known/jwks.json`));
  const issuer = `https://${domain}/`;
  const { payload } = await jwtVerify(token, jwks, { audience, issuer });

  if (!payload.sub) {
    throw Object.assign(new Error("Token has no subject."), { statusCode: 401 });
  }

  return { userId: payload.sub };
}

function getBearerToken(header: string | undefined): string | null {
  if (!header?.startsWith("Bearer ")) return null;
  return header.slice("Bearer ".length).trim();
}
