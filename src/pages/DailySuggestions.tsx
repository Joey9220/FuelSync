import { CalendarDays } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { Field, Input } from "../components/FormField";
import { MacroBadges } from "../components/MacroBadges";
import { ProgressBar } from "../components/ProgressBar";
import { RecipeSuggestionCard } from "../components/RecipeSuggestionCard";
import { Section } from "../components/Section";
import { EmptyState, ErrorState, LoadingState } from "../components/State";
import { addMacroTotals } from "../lib/calculations";
import { dayTypes, label, mealTypes } from "../lib/constants";
import { formatShortDate, todayKey } from "../lib/date";
import { useApi } from "../hooks/useApi";
import { determineDayType } from "../services/dayPriority";
import { recommendRecipes } from "../services/recommendations";
import { determineTimingContext } from "../services/timingEngine";
import type { Activity, DailyMealSelection, MacroTarget, MealType, Recipe, TargetGoal } from "../types";

export function DailySuggestions() {
  const api = useApi();
  const [date, setDate] = useState(todayKey());
  const [activities, setActivities] = useState<Activity[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [selections, setSelections] = useState<DailyMealSelection[]>([]);
  const [targets, setTargets] = useState<MacroTarget[]>([]);
  const [targetGoal, setTargetGoal] = useState<TargetGoal>("maintenance");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = () => {
    setLoading(true);
    Promise.all([api.getActivities({ date }), api.getRecipes(), api.getMealSelections(date), api.getUserPreferences()])
      .then(async ([activityRows, recipeRows, selectionRows, preferences]) => {
        const targetRows = await api.getMacroTargets(preferences.target_goal);
        setActivities(activityRows);
        setRecipes(recipeRows);
        setSelections(selectionRows);
        setTargets(targetRows);
        setTargetGoal(preferences.target_goal);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, [date]);

  const dayType = useMemo(() => determineDayType(activities), [activities]);
  const timing = useMemo(() => determineTimingContext(activities), [activities]);
  const target = targets.find((item) => item.day_type === dayType) ?? defaultTarget(dayType);
  const selectedRecipes = selections
    .map((selection) => recipes.find((recipe) => recipe.id === selection.selected_recipe_id))
    .filter((recipe): recipe is Recipe => Boolean(recipe));
  const totals = addMacroTotals(selectedRecipes.map((recipe) => recipe.totals));

  async function selectRecipe(mealType: MealType, recipeId: string) {
    const optimistic = {
      id: `${date}-${mealType}`,
      date,
      meal_type: mealType,
      selected_recipe_id: recipeId,
      created_at: new Date().toISOString(),
    };
    setSelections((current) => [...current.filter((item) => item.meal_type !== mealType), optimistic]);
    const saved = await api.saveMealSelection({ date, meal_type: mealType, selected_recipe_id: recipeId });
    setSelections((current) => [...current.filter((item) => item.meal_type !== mealType), saved]);
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-bold uppercase tracking-wide text-mint">Daily suggestions</p>
          <h1 className="mt-1 text-3xl font-black tracking-tight">{formatShortDate(date)}</h1>
        </div>
        <div className="w-full sm:w-56">
          <Field label="Date">
            <Input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
          </Field>
        </div>
      </header>

      {error && <ErrorState message={error} />}
      {loading ? <LoadingState label="Loading recommendations..." /> : (
        <>
          <div className="grid gap-3 lg:grid-cols-[1fr_360px]">
            <Card>
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-ink p-3 text-white"><CalendarDays size={20} /></div>
                <div>
                  <div className="text-sm font-bold text-slate-500">Detected day type · {label(targetGoal)}</div>
                  <div className="text-2xl font-black">{label(dayType)}</div>
                </div>
              </div>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {activities.length === 0 ? (
                  <p className="text-sm text-slate-500">No activities planned.</p>
                ) : activities.map((activity) => (
                  <div key={activity.id} className="rounded-lg bg-slate-50 p-3 text-sm">
                    <span className="font-black">{label(activity.activity_type)}</span> · {activity.start_time?.slice(0, 5) || "Any time"}
                  </div>
                ))}
              </div>
            </Card>
            <Card>
              <div className="mb-3 font-black">Selected totals</div>
              <MacroBadges totals={totals} />
              <div className="mt-4 space-y-3">
                <ProgressBar label="kcal" value={totals.kcal} target={target.kcal_max} />
                <ProgressBar label="protein" value={totals.protein_g} target={target.protein_min} />
                <ProgressBar label="carbs" value={totals.carbs_g} target={target.carbs_max} />
                <ProgressBar label="fat" value={totals.fat_g} target={target.fat_max} />
              </div>
            </Card>
          </div>

          {mealTypes.map((mealType) => {
            const recommended = recommendRecipes({ dayType, timing: timing[mealType], mealType, recipes });
            const selectedId = selections.find((selection) => selection.meal_type === mealType)?.selected_recipe_id;
            return (
              <Section key={mealType} title={`${label(mealType)} · ${label(timing[mealType])}`}>
                {recommended.length === 0 ? (
                  <EmptyState title={`No ${label(mealType)} matches`} body="Add recipes with matching day and timing metadata." />
                ) : (
                  <div className="grid gap-3 lg:grid-cols-3">
                    {recommended.map((recipe) => (
                      <RecipeSuggestionCard
                        key={recipe.id}
                        recipe={recipe}
                        selected={selectedId === recipe.id}
                        onSelect={() => selectRecipe(mealType, recipe.id)}
                      />
                    ))}
                  </div>
                )}
              </Section>
            );
          })}
        </>
      )}
    </div>
  );
}

function defaultTarget(dayType: string): MacroTarget {
  const base = dayType === "rest"
    ? { kcal_min: 1900, kcal_max: 2300, protein_min: 150, carbs_min: 120, carbs_max: 220, fat_min: 55, fat_max: 85 }
    : dayType === "gym"
      ? { kcal_min: 2300, kcal_max: 2800, protein_min: 170, carbs_min: 220, carbs_max: 340, fat_min: 55, fat_max: 90 }
      : { kcal_min: 2600, kcal_max: 3400, protein_min: 160, carbs_min: 320, carbs_max: 520, fat_min: 50, fat_max: 90 };

  return {
    id: dayType,
    target_goal: "maintenance",
    day_type: dayTypes.includes(dayType as never) ? (dayType as never) : "rest",
    ...base,
    created_at: "",
    updated_at: "",
  };
}
