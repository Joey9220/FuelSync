import type { MacroTotals } from "../types";

export function MacroBadges({ totals }: { totals: MacroTotals }) {
  return (
    <div className="flex flex-wrap gap-2">
      <Badge label="kcal" value={Math.round(totals.kcal)} tone="bg-amber-100 text-amber-900" />
      <Badge label="P" value={`${totals.protein_g}g`} tone="bg-emerald-100 text-emerald-900" />
      <Badge label="C" value={`${totals.carbs_g}g`} tone="bg-sky-100 text-sky-900" />
      <Badge label="F" value={`${totals.fat_g}g`} tone="bg-rose-100 text-rose-900" />
    </div>
  );
}

function Badge({ label, value, tone }: { label: string; value: string | number; tone: string }) {
  return <span className={`rounded-full px-2.5 py-1 text-xs font-black ${tone}`}>{label} {value}</span>;
}
