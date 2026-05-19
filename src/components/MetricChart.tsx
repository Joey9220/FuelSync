import type { BodyMetric } from "../types";

type MetricKey = "weight_kg" | "fat_mass_kg" | "fat_percentage" | "muscle_mass_kg";

const labels: Record<MetricKey, string> = {
  weight_kg: "Weight",
  fat_mass_kg: "Fat mass",
  fat_percentage: "Fat %",
  muscle_mass_kg: "Muscle",
};

const colors: Record<MetricKey, string> = {
  weight_kg: "#0f2f57",
  fat_mass_kg: "#e11d48",
  fat_percentage: "#f59e0b",
  muscle_mass_kg: "#16a34a",
};

export function MetricChart({
  metrics,
  metricKey,
  height = 220,
}: {
  metrics: BodyMetric[];
  metricKey: MetricKey;
  height?: number;
}) {
  const points = metrics
    .map((metric) => ({ date: metric.measured_at, value: metric[metricKey] }))
    .filter((point): point is { date: string; value: number } => point.value !== null);

  if (points.length < 2) {
    return (
      <div className="flex items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 p-8 text-sm font-semibold text-slate-500" style={{ height }}>
        Not enough {labels[metricKey].toLowerCase()} data yet.
      </div>
    );
  }

  const values = points.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(max - min, 0.1);
  const path = points
    .map((point, index) => {
      const x = (index / (points.length - 1)) * 100;
      const y = 100 - ((point.value - min) / range) * 84 - 8;
      return `${index === 0 ? "M" : "L"} ${x} ${y}`;
    })
    .join(" ");

  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-xs font-black text-slate-600">
        <span>{labels[metricKey]}</span>
        <span>{round(points.at(-1)?.value ?? 0)}</span>
      </div>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full rounded-lg border border-slate-300 bg-white" style={{ height }}>
        <path d={path} fill="none" stroke={colors[metricKey]} strokeWidth="2.8" vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="mt-2 flex justify-between text-[11px] font-semibold text-slate-500">
        <span>{formatDate(points[0].date)}</span>
        <span>{formatDate(points.at(-1)?.date ?? points[0].date)}</span>
      </div>
    </div>
  );
}

function round(value: number) {
  return Math.round(value * 10) / 10;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(new Date(value));
}
