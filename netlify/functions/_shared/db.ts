import postgres from "postgres";

let sql: postgres.Sql | undefined;

export function db() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw Object.assign(new Error("DATABASE_URL is not configured."), { statusCode: 500 });
  }

  sql ??= postgres(databaseUrl, {
    max: 1,
    ssl: "require",
  });

  return sql;
}
