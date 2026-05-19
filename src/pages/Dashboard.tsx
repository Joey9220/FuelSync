import { CalendarPlus, ChefHat, Plus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ActivityFormModal } from "../components/ActivityFormModal";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { MacroBadges } from "../components/MacroBadges";
import { MetricChart } from "../components/MetricChart";
import { ProgressBar } from "../components/ProgressBar";
import { RecipeSuggestionCard } from "../components/RecipeSuggestionCard";
import { Section } from "../components/Section";
import { ErrorState, LoadingState } from "../components/State";
import { addMacroTotals } from "../lib/calculations";
import { label, mealTypes } from "../lib/constants";
import { addDays, normalizeDateKey, todayKey, toDateKey } from "../lib/date";
import { useApi } from "../hooks/useApi";
import { determineDayType } from "../services/dayPriority";
import { recommendRecipes } from "../services/recommendations";
import { determineTimingContext } from "../services/timingEngine";
import type { Activity, BodyMetric, DailyMealSelection, MacroTarget, Recipe, Stats, TargetGoal } from "../types";

export function Dashboard() {
  const api = useApi();
  const navigate = useNavigate();
  const today = todayKey();
  const [stats, setStats] = useState<Stats | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [weekActivities, setWeekActivities] = useState<Activity[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [selections, setSelections] = useState<DailyMealSelection[]>([]);
  const [targets, setTargets] = useState<MacroTarget[]>([]);
  const [bodyMetrics, setBodyMetrics] = useState<BodyMetric[]>([]);
  const [targetGoal, setTargetGoal] = useState<TargetGoal>("maintenance");
  const [quickAdd, setQuickAdd] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = () => {
    setLoading(true);
    Promise.all([
      api.getStats(),
      api.getActivities({ date: today }),
      api.getActivities({ from: today, to: toDateKey(addDays(new Date(), 6)) }),
      api.getRecipes(),
      api.getMealSelections(today),
      api.getUserPreferences(),
      api.getBodyMetrics(30),
    ])
      .then(async ([statsRow, todayRows, weekRows, recipeRows, selectionRows, preferences, bodyMetricRows]) => {
        const targetRows = await api.getMacroTargets(preferences.target_goal);
        setStats(statsRow);
        setActivities(todayRows);
        setWeekActivities(weekRows);
        setRecipes(recipeRows);
        setSelections(selectionRows);
        setTargets(targetRows);
        setTargetGoal(preferences.target_goal);
        setBodyMetrics(bodyMetricRows.metrics);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, [api, today]);

  const dayType = useMemo(() => determineDayType(activities), [activities]);
  const timing = useMemo(() => determineTimingContext(activities), [activities]);
  const target = targets.find((item) => item.day_type === dayType);
  const selectedRecipes = selections
    .map((selection) => recipes.find((recipe) => recipe.id === selection.selected_recipe_id))
    .filter((recipe): recipe is Recipe => Boolean(recipe));
  const totals = addMacroTotals(selectedRecipes.map((recipe) => recipe.totals));
  const todaySuggestions = mealTypes.flatMap((mealType) =>
    recommendRecipes({ dayType, timing: timing[mealType], mealType, recipes }).slice(0, 1),
  );

  return (
    <div className="space-y-5">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-bold uppercase tracking-wide text-mint">Dashboard</p>
          <h1 className="mt-1 text-3xl font-black tracking-tight">Today’s fuel plan</h1>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" icon={<CalendarPlus size={18} />} onClick={() => setQuickAdd(true)}>Activity</Button>
          <Button icon={<ChefHat size={18} />} onClick={() => navigate("/recipes")}>Recipe</Button>
        </div>
      </header>

      {error && <ErrorState message={error} />}
      {loading ? <LoadingState label="Loading dashboard..." /> : (
        <>
          <div className="grid gap-3 lg:grid-cols-[1.2fr_0.8fr]">
            <Card className="bg-gradient-to-br from-white to-emerald-50">
              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <div className="text-sm font-bold text-slate-500">Detected day · {label(targetGoal)}</div>
                  <div className="mt-1 text-3xl font-black">{label(dayType)}</div>
                </div>
                <StatCard label="Recipes" value={stats?.recipes ?? 0} />
                <StatCard label="Ingredients" value={stats?.ingredients ?? 0} />
              </div>
              <div className="mt-5">
                <MacroBadges totals={totals} />
              </div>
            </Card>

            <Card>
              <div className="mb-3 font-black">Macro target summary</div>
              <div className="space-y-3">
                <ProgressBar label="kcal" value={totals.kcal} target={target?.kcal_max} />
                <ProgressBar label="protein" value={totals.protein_g} target={target?.protein_min} />
                <ProgressBar label="carbs" value={totals.carbs_g} target={target?.carbs_max} />
                <ProgressBar label="fat" value={totals.fat_g} target={target?.fat_max} />
              </div>
            </Card>
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <Card>
              <div className="font-black">Today’s activity</div>
              <div className="mt-3 space-y-2">
                {activities.length === 0 ? <p className="text-sm text-slate-500">No workout planned.</p> : activities.map((activity) => (
                  <div key={activity.id} className="rounded-lg bg-slate-50 p-3 text-sm">
                    <span className="font-black">{label(activity.activity_type)}</span> · {activity.start_time?.slice(0, 5) || "Any time"} · {activity.duration_minutes ?? "-"} min
                  </div>
                ))}
              </div>
            </Card>
            <Card>
              <div className="font-black">Upcoming workouts</div>
              <div className="mt-3 space-y-2">
                {weekActivities.length === 0 ? <p className="text-sm text-slate-500">No activities in the next week.</p> : weekActivities.slice(0, 4).map((activity) => (
                  <div key={activity.id} className="flex items-center justify-between rounded-lg bg-slate-50 p-3 text-sm">
                    <span className="font-black">{label(activity.activity_type)}</span>
                    <span className="text-slate-500">{normalizeDateKey(activity.date)}</span>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          <Card>
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <div className="font-black">Body trend</div>
                <p className="text-sm text-slate-500">Last 30 days from Withings</p>
              </div>
              <Button variant="secondary" onClick={() => navigate("/body")}>Open</Button>
            </div>
            <MetricChart metrics={bodyMetrics} metricKey="weight_kg" height={150} />
          </Card>

          <Section title="Today's meal suggestions" action={<Button variant="secondary" icon={<Plus size={16} />} onClick={() => navigate("/today")}>Open day</Button>}>
            <div className="grid gap-3 lg:grid-cols-4">
              {todaySuggestions.map((recipe) => (
                <RecipeSuggestionCard
                  key={recipe.id}
                  recipe={recipe}
                  selected={selections.some((selection) => selection.selected_recipe_id === recipe.id)}
                  onSelect={() => navigate("/today")}
                />
              ))}
            </div>
          </Section>
        </>
      )}

      {quickAdd && (
        <ActivityFormModal
          activity={null}
          date={today}
          onClose={() => setQuickAdd(false)}
          onSaved={() => {
            setQuickAdd(false);
            load();
          }}
        />
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="text-sm font-bold text-slate-500">{label}</div>
      <div className="mt-1 text-3xl font-black">{value}</div>
    </div>
  );
}
