export function ProgressBar({ label, value, target }: { label: string; value: number; target: number | null | undefined }) {
  const percent = target ? Math.min(100, Math.round((value / target) * 100)) : 0;

  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs font-bold text-slate-600">
        <span>{label}</span>
        <span>
          {Math.round(value)} / {target ?? "-"}
        </span>
      </div>
      <div className="h-2 rounded-full bg-slate-100">
        <div className="h-2 rounded-full bg-mint transition-all" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}
