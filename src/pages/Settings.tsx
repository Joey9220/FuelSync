import { useAuth0 } from "@auth0/auth0-react";
import { FormEvent, useEffect, useState } from "react";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { Field, Input, Select } from "../components/FormField";
import { ErrorState, LoadingState } from "../components/State";
import { dayTypes, label, targetGoals } from "../lib/constants";
import { useApi } from "../hooks/useApi";
import type { DayType, MacroTarget, MacroTargetPayload, TargetGoal } from "../types";

type TargetNumbers = Omit<MacroTargetPayload, "day_type" | "target_goal">;

const defaults: Record<TargetGoal, Record<DayType, TargetNumbers>> = {
  recomp: {
    rest: { kcal_min: 2000, kcal_max: 2350, protein_min: 170, carbs_min: 130, carbs_max: 230, fat_min: 55, fat_max: 85 },
    gym: { kcal_min: 2350, kcal_max: 2850, protein_min: 180, carbs_min: 220, carbs_max: 350, fat_min: 55, fat_max: 90 },
    interval_bike: { kcal_min: 2550, kcal_max: 3300, protein_min: 170, carbs_min: 320, carbs_max: 500, fat_min: 50, fat_max: 85 },
    endurance_bike: { kcal_min: 2850, kcal_max: 3800, protein_min: 170, carbs_min: 390, carbs_max: 620, fat_min: 55, fat_max: 95 },
  },
  fat_loss: {
    rest: { kcal_min: 1650, kcal_max: 2050, protein_min: 170, carbs_min: 90, carbs_max: 170, fat_min: 45, fat_max: 75 },
    gym: { kcal_min: 2000, kcal_max: 2450, protein_min: 180, carbs_min: 160, carbs_max: 280, fat_min: 45, fat_max: 80 },
    interval_bike: { kcal_min: 2200, kcal_max: 2850, protein_min: 175, carbs_min: 240, carbs_max: 420, fat_min: 40, fat_max: 75 },
    endurance_bike: { kcal_min: 2400, kcal_max: 3200, protein_min: 175, carbs_min: 300, carbs_max: 520, fat_min: 45, fat_max: 80 },
  },
  maintenance: {
    rest: { kcal_min: 1900, kcal_max: 2300, protein_min: 150, carbs_min: 120, carbs_max: 220, fat_min: 55, fat_max: 85 },
    gym: { kcal_min: 2300, kcal_max: 2800, protein_min: 170, carbs_min: 220, carbs_max: 340, fat_min: 55, fat_max: 90 },
    interval_bike: { kcal_min: 2500, kcal_max: 3300, protein_min: 160, carbs_min: 320, carbs_max: 500, fat_min: 50, fat_max: 85 },
    endurance_bike: { kcal_min: 2800, kcal_max: 3800, protein_min: 160, carbs_min: 380, carbs_max: 620, fat_min: 55, fat_max: 95 },
  },
  cut: {
    rest: { kcal_min: 1500, kcal_max: 1900, protein_min: 180, carbs_min: 70, carbs_max: 140, fat_min: 40, fat_max: 65 },
    gym: { kcal_min: 1850, kcal_max: 2300, protein_min: 190, carbs_min: 140, carbs_max: 240, fat_min: 40, fat_max: 70 },
    interval_bike: { kcal_min: 2050, kcal_max: 2650, protein_min: 185, carbs_min: 220, carbs_max: 360, fat_min: 35, fat_max: 65 },
    endurance_bike: { kcal_min: 2250, kcal_max: 3000, protein_min: 185, carbs_min: 280, carbs_max: 460, fat_min: 40, fat_max: 70 },
  },
  lean_bulk: {
    rest: { kcal_min: 2250, kcal_max: 2650, protein_min: 160, carbs_min: 180, carbs_max: 300, fat_min: 65, fat_max: 95 },
    gym: { kcal_min: 2700, kcal_max: 3300, protein_min: 180, carbs_min: 300, carbs_max: 460, fat_min: 65, fat_max: 100 },
    interval_bike: { kcal_min: 2950, kcal_max: 3700, protein_min: 170, carbs_min: 420, carbs_max: 620, fat_min: 60, fat_max: 95 },
    endurance_bike: { kcal_min: 3300, kcal_max: 4300, protein_min: 170, carbs_min: 520, carbs_max: 760, fat_min: 65, fat_max: 110 },
  },
};

export function Settings() {
  const { user, logout } = useAuth0();
  const api = useApi();
  const [selectedGoal, setSelectedGoal] = useState<TargetGoal>("maintenance");
  const [targets, setTargets] = useState<Record<TargetGoal, Record<DayType, MacroTargetPayload>>>(() => initialTargets([]));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([api.getUserPreferences(), api.getMacroTargets()])
      .then(([preferences, rows]) => {
        setSelectedGoal(preferences.target_goal);
        setTargets(initialTargets(rows));
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [api]);

  async function changeGoal(goal: TargetGoal) {
    setSelectedGoal(goal);
    try {
      await api.saveUserPreferences({ target_goal: goal });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save target goal.");
    }
  }

  function update(dayType: DayType, key: keyof TargetNumbers, value: string) {
    setTargets((current) => ({
      ...current,
      [selectedGoal]: {
        ...current[selectedGoal],
        [dayType]: { ...current[selectedGoal][dayType], [key]: value === "" ? null : Number(value) },
      },
    }));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await Promise.all(dayTypes.map((dayType) => api.saveMacroTarget(targets[selectedGoal][dayType])));
      await api.saveUserPreferences({ target_goal: selectedGoal });
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
          <Card>
            <Field label="Target goal">
              <Select value={selectedGoal} onChange={(event) => changeGoal(event.target.value as TargetGoal)}>
                {targetGoals.map((goal) => (
                  <option key={goal} value={goal}>
                    {label(goal)}
                  </option>
                ))}
              </Select>
            </Field>
            <p className="mt-2 text-sm text-slate-500">
              The dashboard and daily suggestions use targets from this active goal.
            </p>
          </Card>

          {dayTypes.map((dayType) => (
            <Card key={`${selectedGoal}-${dayType}`}>
              <h2 className="text-lg font-black">{label(dayType)}</h2>
              <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
                <NumberField label="kcal min" value={targets[selectedGoal][dayType].kcal_min} onChange={(value) => update(dayType, "kcal_min", value)} />
                <NumberField label="kcal max" value={targets[selectedGoal][dayType].kcal_max} onChange={(value) => update(dayType, "kcal_max", value)} />
                <NumberField label="protein min" value={targets[selectedGoal][dayType].protein_min} onChange={(value) => update(dayType, "protein_min", value)} />
                <NumberField label="carbs min" value={targets[selectedGoal][dayType].carbs_min} onChange={(value) => update(dayType, "carbs_min", value)} />
                <NumberField label="carbs max" value={targets[selectedGoal][dayType].carbs_max} onChange={(value) => update(dayType, "carbs_max", value)} />
                <NumberField label="fat min" value={targets[selectedGoal][dayType].fat_min} onChange={(value) => update(dayType, "fat_min", value)} />
                <NumberField label="fat max" value={targets[selectedGoal][dayType].fat_max} onChange={(value) => update(dayType, "fat_max", value)} />
              </div>
            </Card>
          ))}
          <Button type="submit" disabled={saving}>{saving ? "Saving..." : `Save ${label(selectedGoal)} targets`}</Button>
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

function initialTargets(rows: MacroTarget[]): Record<TargetGoal, Record<DayType, MacroTargetPayload>> {
  return targetGoals.reduce(
    (goalAcc, goal) => {
      goalAcc[goal] = dayTypes.reduce(
        (dayAcc, dayType) => {
          const existing = rows.find((row) => row.target_goal === goal && row.day_type === dayType);
          dayAcc[dayType] = existing ? toPayload(existing) : { target_goal: goal, day_type: dayType, ...defaults[goal][dayType] };
          return dayAcc;
        },
        {} as Record<DayType, MacroTargetPayload>,
      );
      return goalAcc;
    },
    {} as Record<TargetGoal, Record<DayType, MacroTargetPayload>>,
  );
}

function toPayload(target: MacroTarget): MacroTargetPayload {
  return {
    target_goal: target.target_goal,
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
