import { requireAuth } from "./_shared/auth";
import { db } from "./_shared/db";
import { fail, ok } from "./_shared/http";
import type { Handler } from "./_shared/netlify-types";
import { getValidWithingsAccessToken, withingsConfig } from "./_shared/withings";

const measureTypes = {
  1: "weight_kg",
  5: "fat_free_mass_kg",
  6: "fat_percentage",
  8: "fat_mass_kg",
  76: "muscle_mass_kg",
  88: "bone_mass_kg",
} as const;

type MetricRow = {
  measured_at: Date;
  weight_kg: number | null;
  fat_mass_kg: number | null;
  fat_percentage: number | null;
  muscle_mass_kg: number | null;
  bone_mass_kg: number | null;
  fat_free_mass_kg: number | null;
  source_measure_id: string | null;
};

export const handler: Handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") return ok({ error: "Method not allowed." }, 405);

    const { userId } = await requireAuth(event);
    const sql = db();
    const accessToken = await getValidWithingsAccessToken(sql, userId);
    const config = withingsConfig();
    const days = Math.min(parsePositiveInteger(event.queryStringParameters?.days, 370), 3650);
    const startDate =
      event.queryStringParameters?.startdate || String(Math.floor(Date.now() / 1000) - 86400 * days);

    const response = await fetch(`${config.apiEndpoint}/measure`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        action: "getmeas",
        category: "1",
        startdate: startDate,
      }),
    });

    const data = await response.json();
    if (!response.ok || data.status !== 0) {
      throw Object.assign(new Error(data.error || "Withings measure sync failed."), { statusCode: 502 });
    }

    const metrics = parseMeasureGroups(data.body?.measuregrps ?? []);
    for (const metric of metrics) {
      await sql`
        insert into body_metrics (
          user_id, measured_at, weight_kg, fat_mass_kg, fat_percentage, muscle_mass_kg,
          bone_mass_kg, fat_free_mass_kg, source_measure_id
        )
        values (
          ${userId}, ${metric.measured_at}, ${metric.weight_kg}, ${metric.fat_mass_kg},
          ${metric.fat_percentage}, ${metric.muscle_mass_kg}, ${metric.bone_mass_kg},
          ${metric.fat_free_mass_kg}, ${metric.source_measure_id}
        )
        on conflict (user_id, measured_at, source)
        do update set
          weight_kg = coalesce(excluded.weight_kg, body_metrics.weight_kg),
          fat_mass_kg = coalesce(excluded.fat_mass_kg, body_metrics.fat_mass_kg),
          fat_percentage = coalesce(excluded.fat_percentage, body_metrics.fat_percentage),
          muscle_mass_kg = coalesce(excluded.muscle_mass_kg, body_metrics.muscle_mass_kg),
          bone_mass_kg = coalesce(excluded.bone_mass_kg, body_metrics.bone_mass_kg),
          fat_free_mass_kg = coalesce(excluded.fat_free_mass_kg, body_metrics.fat_free_mass_kg),
          source_measure_id = coalesce(excluded.source_measure_id, body_metrics.source_measure_id)
      `;
    }

    await sql`
      update withings_connections
      set last_synced_at = now()
      where user_id = ${userId}
    `;

    return ok({ synced: metrics.length, days });
  } catch (error) {
    return fail(error);
  }
};

function parsePositiveInteger(value: string | undefined, fallback: number) {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

function parseMeasureGroups(groups: any[]): MetricRow[] {
  return groups.map((group) => {
    const row: MetricRow = {
      measured_at: new Date(Number(group.date) * 1000),
      weight_kg: null,
      fat_mass_kg: null,
      fat_percentage: null,
      muscle_mass_kg: null,
      bone_mass_kg: null,
      fat_free_mass_kg: null,
      source_measure_id: group.grpid ? String(group.grpid) : null,
    };

    for (const measure of group.measures ?? []) {
      const key = measureTypes[Number(measure.type) as keyof typeof measureTypes];
      if (!key) continue;
      row[key] = Number(measure.value) * 10 ** Number(measure.unit);
    }

    return row;
  });
}
