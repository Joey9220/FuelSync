import postgres from "postgres";

const databaseUrl = process.env.DATABASE_URL;
const userId = process.env.SEED_USER_ID;

if (!databaseUrl) throw new Error("DATABASE_URL is required.");
if (!userId) throw new Error("SEED_USER_ID is required.");

const sql = postgres(databaseUrl, { ssl: "require", max: 1 });

const targets = {
  recomp: {
    rest: [2000, 2350, 170, 130, 230, 55, 85],
    gym: [2350, 2850, 180, 220, 350, 55, 90],
    interval_bike: [2550, 3300, 170, 320, 500, 50, 85],
    endurance_bike: [2850, 3800, 170, 390, 620, 55, 95],
  },
  fat_loss: {
    rest: [1650, 2050, 170, 90, 170, 45, 75],
    gym: [2000, 2450, 180, 160, 280, 45, 80],
    interval_bike: [2200, 2850, 175, 240, 420, 40, 75],
    endurance_bike: [2400, 3200, 175, 300, 520, 45, 80],
  },
  maintenance: {
    rest: [1900, 2300, 150, 120, 220, 55, 85],
    gym: [2300, 2800, 170, 220, 340, 55, 90],
    interval_bike: [2500, 3300, 160, 320, 500, 50, 85],
    endurance_bike: [2800, 3800, 160, 380, 620, 55, 95],
  },
  cut: {
    rest: [1500, 1900, 180, 70, 140, 40, 65],
    gym: [1850, 2300, 190, 140, 240, 40, 70],
    interval_bike: [2050, 2650, 185, 220, 360, 35, 65],
    endurance_bike: [2250, 3000, 185, 280, 460, 40, 70],
  },
  lean_bulk: {
    rest: [2250, 2650, 160, 180, 300, 65, 95],
    gym: [2700, 3300, 180, 300, 460, 65, 100],
    interval_bike: [2950, 3700, 170, 420, 620, 60, 95],
    endurance_bike: [3300, 4300, 170, 520, 760, 65, 110],
  },
};

try {
  await sql`
    insert into user_preferences (user_id, target_goal)
    values (${userId}, 'maintenance')
    on conflict (user_id) do nothing
  `;

  for (const [targetGoal, dayTargets] of Object.entries(targets)) {
    for (const [dayType, values] of Object.entries(dayTargets)) {
      const [kcalMin, kcalMax, proteinMin, carbsMin, carbsMax, fatMin, fatMax] = values;
      await sql`
        insert into macro_targets (
          user_id, target_goal, day_type, kcal_min, kcal_max, protein_min, carbs_min, carbs_max, fat_min, fat_max
        )
        values (
          ${userId}, ${targetGoal}, ${dayType}, ${kcalMin}, ${kcalMax}, ${proteinMin}, ${carbsMin}, ${carbsMax}, ${fatMin}, ${fatMax}
        )
        on conflict (user_id, target_goal, day_type) do nothing
      `;
    }
  }

  const [summary] = await sql`
    select count(*)::int as count
    from macro_targets
    where user_id = ${userId}
  `;
  console.log(`macro_targets=${summary.count}`);
} finally {
  await sql.end();
}
