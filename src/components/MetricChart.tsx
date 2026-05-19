import { useState } from "react";
import type { BodyMetric } from "../types";

type MetricKey = "weight_kg" | "fat_mass_kg" | "fat_percentage" | "muscle_mass_kg";
type ScaleMode = "auto" | "tight" | "zero";

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

const units: Record<MetricKey, string> = {
  weight_kg: "kg",
  fat_mass_kg: "kg",
  fat_percentage: "%",
  muscle_mass_kg: "kg",
};

const scaleLabels: Record<ScaleMode, string> = {
  auto: "Auto",
  tight: "Tight",
  zero: "Zero",
};

export function MetricChart({
  metrics,
  metricKey,
  height = 220,
  showControls = true,
}: {
  metrics: BodyMetric[];
  metricKey: MetricKey;
  height?: number;
  showControls?: boolean;
}) {
  const [scaleMode, setScaleMode] = useState<ScaleMode>("auto");
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
  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  const { min, max } = getScale(rawMin, rawMax, scaleMode);
  const range = Math.max(max - min, 0.1);
  const gridLines = Array.from({ length: 5 }, (_, index) => {
    const ratio = index / 4;
    const value = max - range * ratio;
    const y = 8 + ratio * 84;
    return { value, y };
  });
  const verticalLines = Array.from({ length: 4 }, (_, index) => 8 + index * 28);
  const path = points
    .map((point, index) => {
      const x = 8 + (index / (points.length - 1)) * 84;
      const y = 100 - ((point.value - min) / range) * 84 - 8;
      return `${index === 0 ? "M" : "L"} ${x} ${y}`;
    })
    .join(" ");

  return (
    <div>
      <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-baseline gap-2 text-xs font-black text-slate-600">
          <span>{labels[metricKey]}</span>
          <span className="text-slate-900">{round(points.at(-1)?.value ?? 0)} {units[metricKey]}</span>
        </div>
        {showControls && (
          <div className="flex rounded-lg border border-slate-300 bg-white p-0.5 shadow-sm">
            {(Object.keys(scaleLabels) as ScaleMode[]).map((mode) => (
              <button
                key={mode}
                type="button"
                className={`min-h-7 rounded-md px-2.5 text-[11px] font-black transition ${
                  scaleMode === mode ? "bg-ink text-white shadow-sm" : "text-slate-600 hover:bg-slate-100"
                }`}
                onClick={() => setScaleMode(mode)}
              >
                {scaleLabels[mode]}
              </button>
            ))}
          </div>
        )}
      </div>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full rounded-lg border border-slate-300 bg-white" style={{ height }}>
        <rect x="0" y="0" width="100" height="100" fill="#ffffff" />
        {verticalLines.map((x) => (
          <line key={x} x1={x} x2={x} y1="8" y2="92" stroke="#e2e8f0" strokeWidth="0.5" vectorEffect="non-scaling-stroke" />
        ))}
        {gridLines.map((line) => (
          <line key={line.y} x1="8" x2="92" y1={line.y} y2={line.y} stroke="#cbd5e1" strokeWidth="0.65" vectorEffect="non-scaling-stroke" />
        ))}
        <path d={path} fill="none" stroke={colors[metricKey]} strokeWidth="2.8" vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="mt-2 grid grid-cols-[auto_1fr_auto] items-start gap-3 text-[11px] font-semibold text-slate-500">
        <div className="space-y-0.5">
          <div>{formatAxisValue(max, units[metricKey])}</div>
          <div>{formatAxisValue(min, units[metricKey])}</div>
        </div>
        <div />
        <div className="flex min-w-36 justify-between gap-4">
          <span>{formatDate(points[0].date)}</span>
          <span>{formatDate(points.at(-1)?.date ?? points[0].date)}</span>
        </div>
      </div>
    </div>
  );
}

function getScale(rawMin: number, rawMax: number, mode: ScaleMode) {
  const rawRange = Math.max(rawMax - rawMin, 0.1);
  if (mode === "zero") {
    const max = rawMax + rawRange * 0.08;
    return { min: 0, max };
  }

  const padding = mode === "tight" ? rawRange * 0.08 : rawRange * 0.25;
  return {
    min: Math.max(0, rawMin - padding),
    max: rawMax + padding,
  };
}

function round(value: number) {
  return Math.round(value * 10) / 10;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(new Date(value));
}

function formatAxisValue(value: number, unit: string) {
  return `${round(value)} ${unit}`;
}
