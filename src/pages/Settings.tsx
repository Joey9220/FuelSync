import { useAuth0 } from "@auth0/auth0-react";
import { FormEvent, useEffect, useState } from "react";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { Field, Input } from "../components/FormField";
import { ErrorState, LoadingState } from "../components/State";
import { dayTypes, label } from "../lib/constants";
import { useApi } from "../hooks/useApi";
import type { DayType, MacroTarget, MacroTargetPayload } from "../types";

const defaults: Record<DayType, Omit<MacroTargetPayload, "day_type">> = {
  rest: { kcal_min: 1900, kcal_max: 2300, protein_min: 150, carbs_min: 120, carbs_max: 220, fat_min: 55, fat_max: 85 },
  gym: { kcal_min: 2300, kcal_max: 2800, protein_min: 170, carbs_min: 220, carbs_max: 340, fat_min: 55, fat_max: 90 },
  interval_bike: { kcal_min: 2500, kcal_max: 3300, protein_min: 160, carbs_min: 320, carbs_max: 500, fat_min: 50, fat_max: 85 },
  endurance_bike: { kcal_min: 2800, kcal_max: 3800, protein_min: 160, carbs_min: 380, carbs_max: 620, fat_min: 55, fat_max: 95 },
};

export function Settings() {
  const { user, logout } = useAuth0();
  const api = useApi();
  const [targets, setTargets] = useState<Record<DayType, MacroTargetPayload>>(() => initialTargets([]));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api.getMacroTargets()
      .then((rows) => setTargets(initialTargets(rows)))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [api]);

  function update(dayType: DayType, key: keyof Omit<MacroTargetPayload, "day_type">, value: string) {
    setTargets((current) => ({
      ...current,
      [dayType]: { ...current[dayType], [key]: value === "" ? null : Number(value) },
    }));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await Promise.all(dayTypes.map((dayType) => api.saveMacroTarget(targets[dayType])));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save macro targets.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <header>
        <p className="text-sm font-bold uppercase tracking-wide text-mint">Settings</p>
        <h1 className="mt-1 text-3xl font-black tracking-tight">Account and targets</h1>
      </header>

      <Card>
        <div className="text-sm font-bold text-slate-500">Signed in as</div>
        <div className="mt-2 break-words text-lg font-black">{user?.email || user?.name}</div>
        <div className="mt-1 break-words text-sm text-slate-500">{user?.sub}</div>
        <Button
          className="mt-5"
          variant="secondary"
          onClick={() => logout({ logoutParams: { returnTo: window.location.origin } })}
        >
          Log out
        </Button>
      </Card>

      {error && <ErrorState message={error} />}
      {loading ? <LoadingState label="Loading macro targets..." /> : (
        <form className="space-y-3" onSubmit={submit}>
          {dayTypes.map((dayType) => (
            <Card key={dayType}>
              <h2 className="text-lg font-black">{label(dayType)}</h2>
              <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
                <NumberField label="kcal min" value={targets[dayType].kcal_min} onChange={(value) => update(dayType, "kcal_min", value)} />
                <NumberField label="kcal max" value={targets[dayType].kcal_max} onChange={(value) => update(dayType, "kcal_max", value)} />
                <NumberField label="protein min" value={targets[dayType].protein_min} onChange={(value) => update(dayType, "protein_min", value)} />
                <NumberField label="carbs min" value={targets[dayType].carbs_min} onChange={(value) => update(dayType, "carbs_min", value)} />
                <NumberField label="carbs max" value={targets[dayType].carbs_max} onChange={(value) => update(dayType, "carbs_max", value)} />
                <NumberField label="fat min" value={targets[dayType].fat_min} onChange={(value) => update(dayType, "fat_min", value)} />
                <NumberField label="fat max" value={targets[dayType].fat_max} onChange={(value) => update(dayType, "fat_max", value)} />
              </div>
            </Card>
          ))}
          <Button type="submit" disabled={saving}>{saving ? "Saving..." : "Save targets"}</Button>
        </form>
      )}
    </div>
  );
}

function NumberField({ label: labelText, value, onChange }: { label: string; value: number | null; onChange: (value: string) => void }) {
  return (
    <Field label={labelText}>
      <Input type="number" min="0" value={value ?? ""} onChange={(event) => onChange(event.target.value)} />
    </Field>
  );
}

function initialTargets(rows: MacroTarget[]): Record<DayType, MacroTargetPayload> {
  return dayTypes.reduce(
    (acc, dayType) => {
      const existing = rows.find((row) => row.day_type === dayType);
      acc[dayType] = existing ? toPayload(existing) : { day_type: dayType, ...defaults[dayType] };
      return acc;
    },
    {} as Record<DayType, MacroTargetPayload>,
  );
}

function toPayload(target: MacroTarget): MacroTargetPayload {
  return {
    day_type: target.day_type,
    kcal_min: target.kcal_min,
    kcal_max: target.kcal_max,
    protein_min: target.protein_min,
    carbs_min: target.carbs_min,
    carbs_max: target.carbs_max,
    fat_min: target.fat_min,
    fat_max: target.fat_max,
  };
}
