import type { HandlerResponse } from "./netlify-types";

export const jsonHeaders = {
  "Content-Type": "application/json",
};

export function ok(data: unknown, statusCode = 200): HandlerResponse {
  return {
    statusCode,
    headers: jsonHeaders,
    body: JSON.stringify(data),
  };
}

export function noContent(): HandlerResponse {
  return {
    statusCode: 204,
    headers: jsonHeaders,
    body: "",
  };
}

export function parseJson<T>(body: string | null): T {
  if (!body) {
    throw Object.assign(new Error("Request body is required."), { statusCode: 400 });
  }

  try {
    return JSON.parse(body) as T;
  } catch {
    throw Object.assign(new Error("Invalid JSON body."), { statusCode: 400 });
  }
}

export function fail(error: unknown): HandlerResponse {
  const statusCode = getStatusCode(error);
  const message = error instanceof Error ? error.message : "Unexpected error.";

  return ok({ error: message }, statusCode);
}

function getStatusCode(error: unknown): number {
  if (typeof error === "object" && error && "statusCode" in error && typeof error.statusCode === "number") {
    return error.statusCode;
  }
  return 500;
}
