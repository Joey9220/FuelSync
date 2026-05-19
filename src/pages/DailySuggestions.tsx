import { CalendarDays, ChefHat, Dumbbell, SlidersHorizontal, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { ActivityFormModal } from "../components/ActivityFormModal";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { Field, Input } from "../components/FormField";
import { MacroBadges } from "../components/MacroBadges";
import { ProgressBar } from "../components/ProgressBar";
import { RecipeSuggestionCard } from "../components/RecipeSuggestionCard";
import { EmptyState, ErrorState, LoadingState } from "../components/State";
import { addMacroTotals } from "../lib/calculations";
import { dayTypes, label, mealTypes } from "../lib/constants";
import { formatShortDate, todayKey } from "../lib/date";
import { useApi } from "../hooks/useApi";
import { determineDayType } from "../services/dayPriority";
import { recommendRecipes } from "../services/recommendations";
import { determineTimingContext } from "../services/timingEngine";
import type { Activity, DailyMealSelection, MacroTarget, MealType, Recipe, RecommendedRecipe, TargetGoal } from "../types";

export function DailySuggestions() {
  const api = useApi();
  const navigate = useNavigate();
  const [date, setDate] = useState(todayKey());
  const [activities, setActivities] = useState<Activity[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [selections, setSelections] = useState<DailyMealSelection[]>([]);
  const [targets, setTargets] = useState<MacroTarget[]>([]);
  const [targetGoal, setTargetGoal] = useState<TargetGoal>("maintenance");
  const [loading, setLoading] = useState(true);
  const [savingPlan, setSavingPlan] = useState(false);
  const [trainingModalOpen, setTrainingModalOpen] = useState(false);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    meals: true,
    progress: true,
    training: false,
    setup: false,
  });
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
  const dayLabel = useMemo(() => getDisplayDayType(activities, dayType), [activities, dayType]);
  const timing = useMemo(() => determineTimingContext(activities), [activities]);
  const target = targets.find((item) => item.day_type === dayType) ?? defaultTarget(dayType);
  const recommendations = useMemo(
    () =>
      Object.fromEntries(
        mealTypes.map((mealType) => [mealType, recommendRecipes({ dayType, timing: timing[mealType], mealType, recipes })]),
      ) as Record<MealType, RecommendedRecipe[]>,
    [dayType, recipes, timing],
  );
  const selectedRecipes = selections
    .map((selection) => recipes.find((recipe) => recipe.id === selection.selected_recipe_id))
    .filter((recipe): recipe is Recipe => Boolean(recipe));
  const totals = addMacroTotals(selectedRecipes.map((recipe) => recipe.totals));
  const planRecipes = mealTypes
    .map((mealType) => selections.find((selection) => selection.meal_type === mealType)?.selected_recipe_id
      ? recipes.find((recipe) => recipe.id === selections.find((selection) => selection.meal_type === mealType)?.selected_recipe_id)
      : recommendations[mealType][0])
    .filter((recipe): recipe is Recipe => Boolean(recipe));
  const planTotals = addMacroTotals(planRecipes.map((recipe) => recipe.totals));
  const hasTargets = targets.length > 0;
  const hasAnyRecommendation = mealTypes.some((mealType) => recommendations[mealType].length > 0);

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

  async function usePlanForToday() {
    setSavingPlan(true);
    setError("");
    try {
      for (const mealType of mealTypes) {
        const selectedId = selections.find((selection) => selection.meal_type === mealType)?.selected_recipe_id;
        const recipeId = selectedId ?? recommendations[mealType][0]?.id;
        if (recipeId) await selectRecipe(mealType, recipeId);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save today's plan.");
    } finally {
      setSavingPlan(false);
    }
  }

  const toggleSection = (key: keyof typeof openSections) =>
    setOpenSections((current) => ({ ...current, [key]: !current[key] }));

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-black uppercase tracking-wide text-mint">Today</p>
          <h1 className="mt-1 text-3xl font-black tracking-tight sm:text-4xl">What should I eat today?</h1>
          <p className="mt-1 text-sm font-semibold text-slate-500">{formatShortDate(date)} - {label(targetGoal)}</p>
        </div>
        <div className="w-full sm:w-56">
          <Field label="Date">
            <Input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
          </Field>
        </div>
      </header>

      {error && <ErrorState message={error} />}
      {loading ? <LoadingState label="Solving today's fueling..." /> : (
        <>
          <Card className="border-emerald-100 bg-gradient-to-br from-white to-emerald-50">
            <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-black uppercase tracking-wide text-mint ring-1 ring-emerald-100">
                  <Sparkles size={14} /> Fueling autopilot
                </div>
                <h2 className="mt-4 text-2xl font-black tracking-tight sm:text-3xl">
                  {hasAnyRecommendation
                    ? `Use a ${dayLabel} plan built around today's training.`
                    : "Add a few recipes and FuelSync will build today's plan."}
                </h2>
                <div className="mt-4 flex flex-wrap gap-2">
                  <SummaryPill label="Training" value={activities.length ? `${activities.length} planned` : "not planned"} />
                  <SummaryPill label="Day type" value={dayLabel} />
                  <SummaryPill label="Target" value={`${target.kcal_min ?? "-"}-${target.kcal_max ?? "-"} kcal`} />
                </div>
              </div>
              <div className="space-y-3">
                <MacroBadges totals={planTotals} />
                <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-1">
                  <Button icon={<Sparkles />} onClick={usePlanForToday} disabled={!hasAnyRecommendation || savingPlan}>
                    {savingPlan ? "Saving..." : "Use this plan for today"}
                  </Button>
                  <Button variant="secondary" icon={<Dumbbell />} onClick={() => setTrainingModalOpen(true)}>Edit training</Button>
                  <Button variant="secondary" icon={<SlidersHorizontal />} onClick={() => navigate("/settings")}>Adjust targets</Button>
                </div>
              </div>
            </div>
          </Card>

          {!hasTargets && (
            <EmptyAction
              title="No macro targets set"
              body="Use a preset target goal, then fine-tune the numbers for your training days."
              actionLabel="Set default targets"
              onAction={() => navigate("/settings")}
            />
          )}

          {recipes.length === 0 && (
            <EmptyAction
              title="No recipes yet"
              body="Add your first recipe or seed sample recipes so FuelSync can start recommending meals."
              actionLabel="Add first recipe"
              onAction={() => navigate("/recipes")}
            />
          )}

          <Collapsible title="Recommended meal plan" open={openSections.meals} onToggle={() => toggleSection("meals")}>
            {!hasAnyRecommendation ? (
              <EmptyState
                title="No recommendations yet"
                body="FuelSync needs recipes with meal type, suitable day type, timing, and macro data before it can solve today."
              />
            ) : (
              <div className="space-y-4">
                {mealTypes.map((mealType) => {
                  const selectedId = selections.find((selection) => selection.meal_type === mealType)?.selected_recipe_id;
                  const options = recommendations[mealType];
                  return (
                    <MealBlock
                      key={mealType}
                      mealType={mealType}
                      timingLabel={label(timing[mealType])}
                      options={options}
                      selectedId={selectedId}
                      onSelect={(recipeId) => selectRecipe(mealType, recipeId)}
                      onAddRecipe={() => navigate("/recipes")}
                    />
                  );
                })}
              </div>
            )}
          </Collapsible>

          <Collapsible title="Macro progress" open={openSections.progress} onToggle={() => toggleSection("progress")}>
            <div className="grid gap-3 lg:grid-cols-[0.8fr_1.2fr]">
              <Card>
                <div className="mb-3 text-sm font-black uppercase tracking-wide text-slate-500">Current selected meals</div>
                {selectedRecipes.length === 0 ? (
                  <p className="text-sm font-semibold text-slate-500">No meals selected yet. Use the plan or choose meals below.</p>
                ) : (
                  <div className="space-y-2">
                    {selections.map((selection) => {
                      const recipe = recipes.find((item) => item.id === selection.selected_recipe_id);
                      if (!recipe) return null;
                      return (
                        <div key={selection.meal_type} className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
                          <span className="font-black">{label(selection.meal_type)}</span>
                          <span className="truncate pl-3 text-slate-600">{recipe.name}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </Card>
              <Card>
                <MacroBadges totals={totals} />
                <div className="mt-4 space-y-3">
                  <ProgressBar label="kcal" value={totals.kcal} target={target.kcal_max} />
                  <ProgressBar label="protein" value={totals.protein_g} target={target.protein_min} />
                  <ProgressBar label="carbs" value={totals.carbs_g} target={target.carbs_max} />
                  <ProgressBar label="fat" value={totals.fat_g} target={target.fat_max} />
                </div>
              </Card>
            </div>
          </Collapsible>

          <Collapsible title="Training details" open={openSections.training} onToggle={() => toggleSection("training")}>
            <Card>
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <div className="font-black">Today's training</div>
                  <p className="text-sm font-semibold text-slate-500">Day type: {dayLabel}</p>
                </div>
                <Button variant="secondary" icon={<CalendarDays />} onClick={() => setTrainingModalOpen(true)}>Plan training</Button>
              </div>
              {activities.length === 0 ? (
                <EmptyState title="No training planned" body="Plan today's training to sharpen meal timing and macro recommendations." />
              ) : (
                <div className="grid gap-2 sm:grid-cols-2">
                  {activities.map((activity) => (
                    <div key={activity.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
                      <div className="font-black">{label(activity.activity_type)}</div>
                      <div className="mt-1 text-slate-600">
                        {activity.start_time?.slice(0, 5) || "Any time"} - {activity.duration_minutes ?? "-"} min - {activity.intensity ?? "no intensity"}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </Collapsible>

          <Collapsible title="Setup and admin" open={openSections.setup} onToggle={() => toggleSection("setup")}>
            <div className="grid gap-3 sm:grid-cols-3">
              <Button variant="secondary" icon={<ChefHat />} onClick={() => navigate("/recipes")}>Manage recipes</Button>
              <Button variant="secondary" onClick={() => navigate("/ingredients")}>Ingredients</Button>
              <Button variant="secondary" onClick={() => navigate("/planner")}>Weekly planner</Button>
            </div>
          </Collapsible>
        </>
      )}

      {trainingModalOpen && (
        <ActivityFormModal
          activity={activities[0] ?? null}
          date={date}
          onClose={() => setTrainingModalOpen(false)}
          onSaved={() => {
            setTrainingModalOpen(false);
            load();
          }}
        />
      )}
    </div>
  );
}

function MealBlock({
  mealType,
  timingLabel,
  options,
  selectedId,
  onSelect,
  onAddRecipe,
}: {
  mealType: MealType;
  timingLabel: string;
  options: RecommendedRecipe[];
  selectedId: string | null | undefined;
  onSelect: (recipeId: string) => void;
  onAddRecipe: () => void;
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-black capitalize">{label(mealType)}</h2>
          <p className="text-sm font-semibold text-slate-500">Best timing: {timingLabel}</p>
        </div>
        <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-mint">{options.length} options</span>
      </div>
      {options.length === 0 ? (
        <EmptyAction
          title={`No ${label(mealType)} recipes`}
          body="Add recipes with matching metadata so this meal can be recommended."
          actionLabel="Add recipe"
          onAction={onAddRecipe}
        />
      ) : (
        <div className="grid gap-3 xl:grid-cols-3">
          {options.map((recipe, index) => (
            <RecipeSuggestionCard
              key={recipe.id}
              recipe={recipe}
              selected={selectedId === recipe.id}
              rank={index + 1}
              onSelect={() => onSelect(recipe.id)}
              onSwap={() => onSelect(options[(index + 1) % options.length]?.id ?? recipe.id)}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function Collapsible({ title, open, onToggle, children }: { title: string; open: boolean; onToggle: () => void; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <button
        type="button"
        className="flex min-h-12 w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-4 text-left font-black shadow-sm transition hover:bg-slate-50"
        onClick={onToggle}
      >
        <span>{title}</span>
        <span className="text-xl leading-none text-slate-500">{open ? "-" : "+"}</span>
      </button>
      {open && <div>{children}</div>}
    </section>
  );
}

function EmptyAction({ title, body, actionLabel, onAction }: { title: string; body: string; actionLabel: string; onAction: () => void }) {
  return (
    <Card className="border-dashed">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="font-black">{title}</div>
          <p className="mt-1 text-sm font-semibold text-slate-500">{body}</p>
        </div>
        <Button variant="secondary" onClick={onAction}>{actionLabel}</Button>
      </div>
    </Card>
  );
}

function SummaryPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
      <div className="text-[11px] font-black uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-0.5 text-sm font-black capitalize">{value}</div>
    </div>
  );
}

function getDisplayDayType(activities: Activity[], dayType: string) {
  const activityTypes = new Set(activities.map((activity) => activity.activity_type).filter((type) => type !== "rest"));
  if (activityTypes.size > 1 && dayType !== "interval_bike") return "mixed";
  return label(dayType);
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
