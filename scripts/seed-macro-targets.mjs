import postgres from "postgres";

const databaseUrl = process.env.DATABASE_URL;
const userId = process.env.SEED_USER_ID;

if (!databaseUrl) throw new Error("DATABASE_URL is required.");
if (!userId) throw new Error("SEED_USER_ID is required.");

const sql = postgres(databaseUrl, { ssl: "require", max: 1 });

const targets = [
  ["rest", 1900, 2300, 150, 120, 220, 55, 85],
  ["gym", 2300, 2800, 170, 220, 340, 55, 90],
  ["interval_bike", 2500, 3300, 160, 320, 500, 50, 85],
  ["endurance_bike", 2800, 3800, 160, 380, 620, 55, 95],
];

try {
  for (const target of targets) {
    const [dayType, kcalMin, kcalMax, proteinMin, carbsMin, carbsMax, fatMin, fatMax] = target;
    await sql`
      insert into macro_targets (
        user_id, day_type, kcal_min, kcal_max, protein_min, carbs_min, carbs_max, fat_min, fat_max
      )
      values (
        ${userId}, ${dayType}, ${kcalMin}, ${kcalMax}, ${proteinMin}, ${carbsMin}, ${carbsMax}, ${fatMin}, ${fatMax}
      )
      on conflict (user_id, day_type) do nothing
    `;
  }

  const rows = await sql`
    select day_type
    from macro_targets
    where user_id = ${userId}
    order by day_type
  `;
  console.log(rows.map((row) => row.day_type).join(","));
} finally {
  await sql.end();
}
