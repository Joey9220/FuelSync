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
  const [tooltip, setTooltip] = useState<{
    pointIndex: number;
    clientX: number;
    clientY: number;
    offsetX: number;
    offsetY: number;
    chartWidth: number;
  } | null>(null);
  const points = metrics
    .map((metric) => ({ date: metric.measured_at, value: metric[metricKey], metric }))
    .filter((point): point is { date: string; value: number; metric: BodyMetric } => point.value !== null);

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
  const horizontalTicks = Array.from({ length: 7 }, (_, index) => {
    const tickRatio = index / 6;
    const value = max - range * tickRatio;
    const y = 8 + tickRatio * 84;
    return { value, y };
  });
  const verticalTickCount = Math.min(6, points.length);
  const verticalTicks = Array.from({ length: verticalTickCount }, (_, index) => {
    const ratio = verticalTickCount === 1 ? 0 : index / (verticalTickCount - 1);
    const pointIndex = Math.round(ratio * (points.length - 1));
    return {
      x: 8 + ratio * 84,
      date: points[pointIndex].date,
    };
  });
  const pathPoints = points.map((point, index) => ({
    x: 8 + (index / (points.length - 1)) * 84,
    y: 100 - ((point.value - min) / range) * 84 - 8,
    value: point.value,
  }));
  const trendPoints = movingAverage(points.map((point) => point.value), Math.min(7, Math.max(3, Math.ceil(points.length / 8)))).map(
    (value, index) => ({
      x: 8 + (index / (points.length - 1)) * 84,
      y: 100 - ((value - min) / range) * 84 - 8,
      value,
    }),
  );
  const path = toPath(pathPoints);
  const trendPath = toPath(trendPoints);
  const activePoint = tooltip ? pathPoints[tooltip.pointIndex] : null;
  const activeMetric = tooltip ? points[tooltip.pointIndex] : null;
  const yAxisWidth = 40;
  const tooltipLeft = tooltip ? yAxisWidth + clamp(tooltip.offsetX + 14, 8, Math.max(8, tooltip.chartWidth - 232)) : 0;
  const tooltipTop = tooltip ? clamp(tooltip.offsetY - 96, 8, Math.max(8, height - 118)) : 0;

  function updateTooltip(clientX: number, clientY: number, target: EventTarget | null) {
    const svg = target instanceof SVGElement ? target.closest("svg") : null;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const xPercent = ((clientX - rect.left) / rect.width) * 100;
    const plotRatio = clamp((xPercent - 8) / 84, 0, 1);
    const pointIndex = Math.round(plotRatio * (points.length - 1));
    setTooltip({
      pointIndex,
      clientX,
      clientY,
      offsetX: clientX - rect.left,
      offsetY: clientY - rect.top,
      chartWidth: rect.width,
    });
  }

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
      <div className="relative pb-7 pl-10">
        <div className="relative" style={{ height }}>
          <div className="pointer-events-none absolute bottom-0 left-0 top-0 w-9 text-right text-[11px] font-bold leading-none text-slate-600">
            {horizontalTicks.map((tick) => (
              <span
                key={tick.y}
                className="absolute right-0 -translate-y-1/2"
                style={{ top: `${tick.y}%` }}
              >
                {formatTickValue(tick.value)}
              </span>
            ))}
          </div>
          <svg
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            className="absolute inset-y-0 left-10 right-0 w-[calc(100%-2.5rem)] cursor-crosshair rounded-lg border border-slate-300 bg-white"
            style={{ height }}
            onMouseMove={(event) => updateTooltip(event.clientX, event.clientY, event.currentTarget)}
            onMouseLeave={() => setTooltip(null)}
            onTouchMove={(event) => {
              const touch = event.touches[0];
              if (touch) updateTooltip(touch.clientX, touch.clientY, event.currentTarget);
            }}
            onTouchEnd={() => setTooltip(null)}
          >
            <rect x="0" y="0" width="100" height="100" fill="#ffffff" />
            {verticalTicks.map((tick) => (
              <line key={tick.x} x1={tick.x} x2={tick.x} y1="8" y2="92" stroke="#cbd5e1" strokeWidth="0.7" vectorEffect="non-scaling-stroke" />
            ))}
            {horizontalTicks.map((tick) => (
              <line key={tick.y} x1="8" x2="92" y1={tick.y} y2={tick.y} stroke="#94a3b8" strokeWidth="0.75" vectorEffect="non-scaling-stroke" />
            ))}
            <line x1="8" x2="8" y1="8" y2="92" stroke="#64748b" strokeWidth="0.9" vectorEffect="non-scaling-stroke" />
            <line x1="8" x2="92" y1="92" y2="92" stroke="#64748b" strokeWidth="0.9" vectorEffect="non-scaling-stroke" />
            <path d={path} fill="none" stroke={colors[metricKey]} strokeOpacity="0.38" strokeWidth="3.2" vectorEffect="non-scaling-stroke" />
            <path d={trendPath} fill="none" stroke={colors[metricKey]} strokeWidth="1.6" vectorEffect="non-scaling-stroke" />
            {activePoint && (
              <>
                <line x1={activePoint.x} x2={activePoint.x} y1="8" y2="92" stroke="#0f172a" strokeOpacity="0.55" strokeWidth="1" vectorEffect="non-scaling-stroke" />
                <circle cx={activePoint.x} cy={activePoint.y} r="1.3" fill="#ffffff" stroke={colors[metricKey]} strokeWidth="1" vectorEffect="non-scaling-stroke" />
              </>
            )}
          </svg>
        </div>
        <div className="pointer-events-none absolute bottom-0 left-10 right-0 text-[11px] font-bold leading-none text-slate-600">
          {verticalTicks.map((tick, index) => (
            <span
              key={tick.x}
              className={`absolute ${index === 0 ? "" : index === verticalTicks.length - 1 ? "-translate-x-full" : "-translate-x-1/2"}`}
              style={{ left: `${tick.x}%` }}
            >
              {formatDate(tick.date)}
            </span>
          ))}
        </div>
        {tooltip && activeMetric && (
          <div
            className="pointer-events-none absolute z-10 w-56 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700 shadow-lg"
            style={{
              left: tooltipLeft,
              top: tooltipTop,
            }}
          >
            <div className="text-[11px] uppercase tracking-wide text-slate-500">{formatLongDate(activeMetric.date)}</div>
            <div className="mt-1 text-sm text-slate-950">
              {labels[metricKey]}: {round(activeMetric.value)} {units[metricKey]}
            </div>
            <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] text-slate-600">
              <TooltipMetric label="Weight" value={activeMetric.metric.weight_kg} unit="kg" />
              <TooltipMetric label="Fat mass" value={activeMetric.metric.fat_mass_kg} unit="kg" />
              <TooltipMetric label="Fat" value={activeMetric.metric.fat_percentage} unit="%" />
              <TooltipMetric label="Muscle" value={activeMetric.metric.muscle_mass_kg} unit="kg" />
            </div>
          </div>
        )}
      </div>
      <div className="mt-2 flex justify-end text-[11px] font-semibold text-slate-500">
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1"><span className="h-0.5 w-4 rounded-full opacity-40" style={{ backgroundColor: colors[metricKey] }} /> Raw</span>
          <span className="inline-flex items-center gap-1"><span className="h-0.5 w-4 rounded-full" style={{ backgroundColor: colors[metricKey] }} /> Trend</span>
        </div>
      </div>
    </div>
  );
}

function TooltipMetric({ label, value, unit }: { label: string; value: number | null; unit: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span>{label}</span>
      <span className="text-slate-900">{value == null ? "-" : `${round(value)} ${unit}`}</span>
    </div>
  );
}

function toPath(points: Array<{ x: number; y: number }>) {
  return points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");
}

function movingAverage(values: number[], windowSize: number) {
  const halfWindow = Math.floor(windowSize / 2);
  return values.map((_, index) => {
    const start = Math.max(0, index - halfWindow);
    const end = Math.min(values.length, index + halfWindow + 1);
    const slice = values.slice(start, end);
    return slice.reduce((sum, value) => sum + value, 0) / slice.length;
  });
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

function formatLongDate(value: string) {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(value));
}

function formatTickValue(value: number) {
  const rounded = round(value);
  return Math.abs(rounded) >= 100 ? String(Math.round(rounded)) : String(rounded);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}
