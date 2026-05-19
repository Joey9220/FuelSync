import { useAuth0 } from "@auth0/auth0-react";
import { FormEvent, useEffect, useState } from "react";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { Field, Input, Select } from "../components/FormField";
import { ErrorState, LoadingState } from "../components/State";
import { dayTypes, label, targetGoals } from "../lib/constants";
import { useApi } from "../hooks/useApi";
import type { BodyMetric, DayType, MacroTarget, MacroTargetPayload, TargetGoal } from "../types";

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

const dayTypeEnergyAdjustment: Record<DayType, number> = {
  rest: -150,
  gym: 250,
  interval_bike: 450,
  endurance_bike: 700,
};

const goalDefaults: Record<TargetGoal, { weeklyRate: number; protein: number; fat: number }> = {
  recomp: { weeklyRate: -0.1, protein: 2.1, fat: 0.8 },
  fat_loss: { weeklyRate: -0.5, protein: 2.2, fat: 0.75 },
  maintenance: { weeklyRate: 0, protein: 1.8, fat: 0.8 },
  cut: { weeklyRate: -0.75, protein: 2.3, fat: 0.7 },
  lean_bulk: { weeklyRate: 0.25, protein: 1.9, fat: 0.9 },
};

export function Settings() {
  const { user, logout } = useAuth0();
  const api = useApi();
  const [selectedGoal, setSelectedGoal] = useState<TargetGoal>("maintenance");
  const [targets, setTargets] = useState<Record<TargetGoal, Record<DayType, MacroTargetPayload>>>(() => initialTargets([]));
  const [calculator, setCalculator] = useState({
    currentWeight: "",
    height: "",
    bodyFatPercentage: "",
    goalWeight: "",
    goalDate: "",
    calculationMode: "goalDate" as "goalDate" | "weeklyRate",
    weeklyRate: "",
  });
  const [latestBodyMetric, setLatestBodyMetric] = useState<BodyMetric | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([api.getUserPreferences(), api.getMacroTargets(), api.getBodyMetrics(3650)])
      .then(([preferences, rows, bodyMetricRows]) => {
        const latestMetric = bodyMetricRows.metrics.at(-1) ?? null;
        setSelectedGoal(preferences.target_goal);
        setTargets(initialTargets(rows));
        setLatestBodyMetric(latestMetric);
        setCalculator((current) => ({
          ...current,
          currentWeight: latestMetric?.weight_kg ? String(roundOne(latestMetric.weight_kg)) : current.currentWeight,
          bodyFatPercentage: latestMetric?.fat_percentage ? String(roundOne(latestMetric.fat_percentage)) : current.bodyFatPercentage,
          height: preferences.height_cm ? String(preferences.height_cm) : current.height,
        }));
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

  function updateCalculator(key: keyof typeof calculator, value: string) {
    setCalculator((current) => ({ ...current, [key]: value }));
  }

  async function applyCalculatedTargets() {
    const calculated = calculateTargets({
      selectedGoal,
      currentWeight: Number(calculator.currentWeight),
      height: Number(calculator.height),
      bodyFatPercentage: Number(calculator.bodyFatPercentage),
      goalWeight: Number(calculator.goalWeight),
      goalDate: calculator.goalDate,
      calculationMode: calculator.calculationMode,
      weeklyRate: Number(calculator.weeklyRate),
    });

    if (!calculated) {
      setError(
        calculator.calculationMode === "goalDate"
          ? "Enter current weight, height, goal weight and a future goal date."
          : "Enter current weight, height and a weekly weight change rate.",
      );
      return;
    }

    setError("");
    setTargets((current) => ({
      ...current,
      [selectedGoal]: dayTypes.reduce(
        (acc, dayType) => {
          acc[dayType] = { target_goal: selectedGoal, day_type: dayType, ...calculated[dayType] };
          return acc;
        },
        {} as Record<DayType, MacroTargetPayload>,
      ),
    }));
    try {
      await api.saveUserPreferences({ target_goal: selectedGoal, height_cm: Number(calculator.height) || null });
    } catch {
      // Height persistence is helpful but should not block filling editable targets.
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await Promise.all(dayTypes.map((dayType) => api.saveMacroTarget(targets[selectedGoal][dayType])));
      await api.saveUserPreferences({ target_goal: selectedGoal, height_cm: Number(calculator.height) || null });
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

          <Card>
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <h2 className="text-lg font-black">Auto calculate targets</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Uses your latest known Withings weight/body-fat where available, then estimates macro ranges for all day types.
                </p>
                {latestBodyMetric && (
                  <p className="mt-2 text-xs font-bold text-slate-500">
                    Latest body metric: {roundOne(latestBodyMetric.weight_kg ?? 0)} kg
                    {latestBodyMetric.fat_percentage ? `, ${roundOne(latestBodyMetric.fat_percentage)}% fat` : ""}
                  </p>
                )}
              </div>
              <Button type="button" variant="secondary" onClick={applyCalculatedTargets}>
                Calculate and fill targets
              </Button>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Field label="Current weight kg">
                <Input
                  type="number"
                  min="1"
                  step="0.1"
                  value={calculator.currentWeight}
                  onChange={(event) => updateCalculator("currentWeight", event.target.value)}
                />
              </Field>
              <Field label="Body fat %">
                <Input
                  type="number"
                  min="1"
                  max="80"
                  step="0.1"
                  value={calculator.bodyFatPercentage}
                  onChange={(event) => updateCalculator("bodyFatPercentage", event.target.value)}
                />
              </Field>
              <Field label="Height cm">
                <Input
                  type="number"
                  min="1"
                  step="1"
                  value={calculator.height}
                  onChange={(event) => updateCalculator("height", event.target.value)}
                />
              </Field>
              <Field label="Calculation mode">
                <Select
                  value={calculator.calculationMode}
                  onChange={(event) => updateCalculator("calculationMode", event.target.value)}
                >
                  <option value="goalDate">Target goal date</option>
                  <option value="weeklyRate">Fixed weekly rate</option>
                </Select>
              </Field>
              <Field label="Goal weight kg">
                <Input
                  type="number"
                  min="1"
                  step="0.1"
                  value={calculator.goalWeight}
                  onChange={(event) => updateCalculator("goalWeight", event.target.value)}
                  disabled={calculator.calculationMode !== "goalDate"}
                />
              </Field>
              <Field label="Goal date">
                <Input
                  type="date"
                  value={calculator.goalDate}
                  onChange={(event) => updateCalculator("goalDate", event.target.value)}
                  disabled={calculator.calculationMode !== "goalDate"}
                />
              </Field>
              <Field label="Weight change kg/week">
                <Input
                  type="number"
                  step="0.05"
                  value={calculator.weeklyRate}
                  onChange={(event) => updateCalculator("weeklyRate", event.target.value)}
                  disabled={calculator.calculationMode !== "weeklyRate"}
                />
              </Field>
            </div>
            <p className="mt-3 text-xs font-semibold text-slate-500">
              Use negative weekly values for weight loss, positive values for lean gain. All generated targets remain editable before saving.
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

function calculateTargets({
  selectedGoal,
  currentWeight,
  height,
  bodyFatPercentage,
  goalWeight,
  goalDate,
  calculationMode,
  weeklyRate,
}: {
  selectedGoal: TargetGoal;
  currentWeight: number;
  height: number;
  bodyFatPercentage: number;
  goalWeight: number;
  goalDate: string;
  calculationMode: "goalDate" | "weeklyRate";
  weeklyRate: number;
}): Record<DayType, TargetNumbers> | null {
  if (!currentWeight || !height) return null;
  const goalProfile = goalDefaults[selectedGoal];
  let selectedWeeklyRate = goalProfile.weeklyRate;

  if (calculationMode === "goalDate") {
    if (!goalWeight || !goalDate) return null;
    const daysUntilGoal = Math.ceil((new Date(goalDate).getTime() - Date.now()) / 86400000);
    if (daysUntilGoal <= 0) return null;
    const weeksUntilGoal = daysUntilGoal / 7;
    selectedWeeklyRate = (goalWeight - currentWeight) / weeksUntilGoal;
  } else {
    if (!Number.isFinite(weeklyRate)) return null;
    selectedWeeklyRate = weeklyRate;
  }

  selectedWeeklyRate = selectedGoal === "maintenance" || selectedGoal === "recomp"
    ? selectedWeeklyRate
    : clamp(selectedWeeklyRate, -0.9, 0.45);

  const leanMassEstimate = bodyFatPercentage > 0 && bodyFatPercentage < 80
    ? currentWeight * (1 - bodyFatPercentage / 100)
    : currentWeight * 0.82;
  const bmr = 10 * currentWeight + 6.25 * height - 5 * 35 + 5;
  const maintenance = bmr * 1.45;
  const goalDelta = (selectedWeeklyRate * 7700) / 7;
  const protein = Math.round(currentWeight * goalProfile.protein);
  const fatBase = Math.round(currentWeight * goalProfile.fat);

  return dayTypes.reduce(
    (acc, dayType) => {
      const kcalCenter = Math.round(maintenance + goalDelta + dayTypeEnergyAdjustment[dayType]);
      const kcalMin = Math.max(1400, kcalCenter - 125);
      const kcalMax = Math.max(kcalMin + 100, kcalCenter + 125);
      const fatMin = Math.max(35, fatBase - 10);
      const fatMax = fatBase + 15;
      const proteinMin = Math.max(protein, Math.round(leanMassEstimate * 2));
      const carbsMin = Math.max(40, Math.round((kcalMin - proteinMin * 4 - fatMax * 9) / 4));
      const carbsMax = Math.max(carbsMin + 30, Math.round((kcalMax - proteinMin * 4 - fatMin * 9) / 4));

      acc[dayType] = {
        kcal_min: kcalMin,
        kcal_max: kcalMax,
        protein_min: proteinMin,
        carbs_min: carbsMin,
        carbs_max: carbsMax,
        fat_min: fatMin,
        fat_max: fatMax,
      };
      return acc;
    },
    {} as Record<DayType, TargetNumbers>,
  );
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function roundOne(value: number) {
  return Math.round(value * 10) / 10;
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
