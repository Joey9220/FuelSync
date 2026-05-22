import { CalendarDays, ChefHat, Dumbbell, Plus, ShoppingBasket, SlidersHorizontal, Sparkles, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { ActivityFormModal } from "../components/ActivityFormModal";
import { AiNutritionCoachPanel } from "../components/AiNutritionCoachPanel";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { Field, Input, Select } from "../components/FormField";
import { MacroBadges } from "../components/MacroBadges";
import { Modal } from "../components/Modal";
import { ProgressBar } from "../components/ProgressBar";
import { RecipeSuggestionCard } from "../components/RecipeSuggestionCard";
import { EmptyState, ErrorState, LoadingState } from "../components/State";
import { addMacroTotals, calculateRecipeTotals, formatTotals } from "../lib/calculations";
import { dayTypes, label, mealTypes } from "../lib/constants";
import { formatShortDate, todayKey } from "../lib/date";
import { useApi } from "../hooks/useApi";
import { determineDayType } from "../services/dayPriority";
import { recommendRecipes } from "../services/recommendations";
import { determineTimingContext } from "../services/timingEngine";
import type {
  Activity,
  AiCoachDayType,
  AiCoachGoal,
  AiNutritionCoachInput,
  AiNutritionCoachSuggestion,
  DailyFoodEntry,
  DailyFoodEntryPayload,
  DailyMealSelection,
  Ingredient,
  MacroTarget,
  MealType,
  Recipe,
  RecipeIngredient,
  RecommendedRecipe,
  TargetGoal,
} from "../types";

export function DailySuggestions() {
  const api = useApi();
  const navigate = useNavigate();
  const [date, setDate] = useState(todayKey());
  const [activities, setActivities] = useState<Activity[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [selections, setSelections] = useState<DailyMealSelection[]>([]);
  const [foodEntries, setFoodEntries] = useState<DailyFoodEntry[]>([]);
  const [detailRecipe, setDetailRecipe] = useState<Recipe | null>(null);
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
  const [openMealBlocks, setOpenMealBlocks] = useState<Record<MealType, boolean>>({
    breakfast: true,
    lunch: true,
    dinner: true,
    snack: true,
  });
  const [error, setError] = useState("");

  const load = () => {
    setLoading(true);
    Promise.all([
      api.getActivities({ date }),
      api.getRecipes(),
      api.getIngredients(),
      api.getMealSelections(date),
      api.getDailyFoodEntries(date),
      api.getUserPreferences(),
    ])
      .then(async ([activityRows, recipeRows, ingredientRows, selectionRows, entryRows, preferences]) => {
        const targetRows = await api.getMacroTargets(preferences.target_goal);
        const migratedEntries = entryRows.length
          ? entryRows
          : await Promise.all(
              selectionRows
                .filter((selection) => selection.selected_recipe_id)
                .map((selection) => {
                  const recipe = recipeRows.find((item) => item.id === selection.selected_recipe_id);
                  if (!recipe) return null;
                  return api.createDailyFoodEntry({
                    date,
                    meal_type: selection.meal_type,
                    entry_type: "recipe",
                    intake_time: defaultMealTime(selection.meal_type),
                    recipe_id: recipe.id,
                    ingredient_id: null,
                    quantity: null,
                    unit: null,
                    ingredient_overrides: recipe.ingredients.map((item) => ({
                      ingredient_id: item.ingredient_id,
                      quantity: Number(item.quantity),
                      unit: item.unit,
                    })),
                  });
                }),
            ).then((entries) => entries.filter((entry): entry is DailyFoodEntry => Boolean(entry)));
        setActivities(activityRows);
        setRecipes(recipeRows);
        setIngredients(ingredientRows);
        setSelections(selectionRows);
        setFoodEntries(migratedEntries);
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
  const entryTotals = useMemo(
    () => foodEntries.map((entry) => calculateFoodEntryTotals(entry, recipes, ingredients)),
    [foodEntries, recipes, ingredients],
  );
  const totals = addMacroTotals(entryTotals);
  const planRecipes = mealTypes
    .map((mealType) => selections.find((selection) => selection.meal_type === mealType)?.selected_recipe_id
      ? recipes.find((recipe) => recipe.id === selections.find((selection) => selection.meal_type === mealType)?.selected_recipe_id)
      : recommendations[mealType][0])
    .filter((recipe): recipe is Recipe => Boolean(recipe));
  const planTotals = addMacroTotals(planRecipes.map((recipe) => recipe.totals));
  const hasTargets = targets.length > 0;
  const hasAnyRecommendation = mealTypes.some((mealType) => recommendations[mealType].length > 0);
  const aiCoachInput = useMemo(
    () =>
      buildAiCoachInput({
        activities,
        dayType,
        dayLabel,
        targetGoal,
        target,
        selections,
        recipes,
      }),
    [activities, dayType, dayLabel, targetGoal, target, selections, recipes],
  );

  async function selectRecipe(mealType: MealType, recipeId: string) {
    const existing = foodEntries.find(
      (entry) => entry.meal_type === mealType && entry.entry_type === "recipe" && entry.recipe_id === recipeId,
    );

    if (existing) {
      setFoodEntries((current) => current.filter((entry) => entry.id !== existing.id));
      await api.deleteDailyFoodEntry(existing.id);
      if (selections.find((selection) => selection.meal_type === mealType)?.selected_recipe_id === recipeId) {
        const saved = await api.saveMealSelection({ date, meal_type: mealType, selected_recipe_id: null });
        setSelections((current) => [...current.filter((item) => item.meal_type !== mealType), saved]);
      }
      return;
    }

    const recipe = recipes.find((item) => item.id === recipeId);
    if (!recipe) return;
    const savedEntry = await api.createDailyFoodEntry({
      date,
      meal_type: mealType,
      entry_type: "recipe",
      intake_time: defaultMealTime(mealType),
      recipe_id: recipeId,
      ingredient_id: null,
      quantity: null,
      unit: null,
      ingredient_overrides: recipe.ingredients.map((item) => ({
        ingredient_id: item.ingredient_id,
        quantity: Number(item.quantity),
        unit: item.unit,
      })),
    });
    setFoodEntries((current) => [...current, savedEntry]);

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

  async function addFoodEntry(payload: DailyFoodEntryPayload) {
    const savedEntry = await api.createDailyFoodEntry(payload);
    setFoodEntries((current) => [...current, savedEntry]);
    if (payload.entry_type === "recipe" && payload.recipe_id) {
      const saved = await api.saveMealSelection({ date, meal_type: payload.meal_type, selected_recipe_id: payload.recipe_id });
      setSelections((current) => [...current.filter((item) => item.meal_type !== payload.meal_type), saved]);
    }
  }

  async function updateFoodEntry(id: string, payload: DailyFoodEntryPayload) {
    setFoodEntries((current) =>
      current.map((entry) => (entry.id === id ? { ...entry, ...payload, updated_at: new Date().toISOString() } : entry)),
    );
    try {
      const savedEntry = await api.updateDailyFoodEntry(id, payload);
      setFoodEntries((current) => current.map((entry) => (entry.id === savedEntry.id ? savedEntry : entry)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update food entry.");
      load();
    }
  }

  async function deleteFoodEntry(entry: DailyFoodEntry) {
    setFoodEntries((current) => current.filter((item) => item.id !== entry.id));
    await api.deleteDailyFoodEntry(entry.id);
    if (
      entry.entry_type === "recipe" &&
      selections.find((selection) => selection.meal_type === entry.meal_type)?.selected_recipe_id === entry.recipe_id
    ) {
      const saved = await api.saveMealSelection({ date, meal_type: entry.meal_type, selected_recipe_id: null });
      setSelections((current) => [...current.filter((item) => item.meal_type !== entry.meal_type), saved]);
    }
  }

  async function usePlanForToday() {
    setSavingPlan(true);
    setError("");
    try {
      for (const mealType of mealTypes) {
        const loggedId = foodEntries.find((entry) => entry.meal_type === mealType && entry.entry_type === "recipe")?.recipe_id;
        const selectedId = selections.find((selection) => selection.meal_type === mealType)?.selected_recipe_id;
        const recipeId = loggedId ?? selectedId ?? recommendations[mealType][0]?.id;
        const isLogged = foodEntries.some(
          (entry) => entry.meal_type === mealType && entry.entry_type === "recipe" && entry.recipe_id === recipeId,
        );
        if (recipeId && !isLogged) await selectRecipe(mealType, recipeId);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save today's plan.");
    } finally {
      setSavingPlan(false);
    }
  }

  async function applyAiTargets(suggestion: AiNutritionCoachSuggestion) {
    await api.saveMacroTarget({
      target_goal: targetGoal,
      day_type: dayType,
      kcal_min: Math.max(0, Math.round(suggestion.macroSuggestion.calories * 0.95)),
      kcal_max: Math.max(0, Math.round(suggestion.macroSuggestion.calories * 1.05)),
      protein_min: Math.max(0, Math.round(suggestion.macroSuggestion.protein)),
      carbs_min: Math.max(0, Math.round(suggestion.macroSuggestion.carbs * 0.9)),
      carbs_max: Math.max(0, Math.round(suggestion.macroSuggestion.carbs * 1.1)),
      fat_min: Math.max(0, Math.round(suggestion.macroSuggestion.fat * 0.9)),
      fat_max: Math.max(0, Math.round(suggestion.macroSuggestion.fat * 1.1)),
    });
    const targetRows = await api.getMacroTargets(targetGoal);
    setTargets(targetRows);
  }

  const toggleSection = (key: keyof typeof openSections) =>
    setOpenSections((current) => ({ ...current, [key]: !current[key] }));
  const toggleMealBlock = (mealType: MealType) =>
    setOpenMealBlocks((current) => ({ ...current, [mealType]: !current[mealType] }));

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

          <AiNutritionCoachPanel
            input={aiCoachInput}
            canGenerate={hasTargets && recipes.length > 0}
            onApplyTargets={applyAiTargets}
          />

          <LiveEnergyChart entries={foodEntries} recipes={recipes} ingredients={ingredients} activities={activities} />

          <Collapsible title="Recommended meal plan" open={openSections.meals} onToggle={() => toggleSection("meals")}>
            {!hasAnyRecommendation ? (
              <EmptyState
                title="No recommendations yet"
                body="FuelSync needs recipes with meal type, suitable day type, timing, and macro data before it can solve today."
              />
            ) : (
              <div className="space-y-4">
                {mealTypes.map((mealType) => {
                  const selectedIds = new Set(
                    foodEntries
                      .filter((entry) => entry.meal_type === mealType && entry.entry_type === "recipe" && entry.recipe_id)
                      .map((entry) => entry.recipe_id as string),
                  );
                  const options = recommendations[mealType];
                  return (
                    <MealBlock
                      key={mealType}
                      date={date}
                      mealType={mealType}
                      timingLabel={label(timing[mealType])}
                      options={options}
                      selectedIds={selectedIds}
                      open={openMealBlocks[mealType]}
                      entries={foodEntries.filter((entry) => entry.meal_type === mealType)}
                      recipes={recipes.filter((recipe) => recipe.meal_type === mealType)}
                      ingredients={ingredients}
                      onToggle={() => toggleMealBlock(mealType)}
                      onDetails={(recipe) => setDetailRecipe(recipe)}
                      onSelect={(recipeId) => selectRecipe(mealType, recipeId)}
                      onAddEntry={addFoodEntry}
                      onUpdateEntry={updateFoodEntry}
                      onDeleteEntry={deleteFoodEntry}
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
                {foodEntries.length === 0 ? (
                  <p className="text-sm font-semibold text-slate-500">No food logged yet. Use the plan or add recipes and ingredients below.</p>
                ) : (
                  <div className="space-y-2">
                    {foodEntries.map((entry) => {
                      const recipe = entry.recipe_id ? recipes.find((item) => item.id === entry.recipe_id) : null;
                      const ingredient = entry.ingredient_id ? ingredients.find((item) => item.id === entry.ingredient_id) : null;
                      return (
                        <div key={entry.id} className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
                          <span className="font-black">{label(entry.meal_type)}</span>
                          <span className="truncate pl-3 text-slate-600">
                            {recipe?.name ?? ingredient?.name ?? "Food entry"}
                          </span>
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

      {detailRecipe && <RecipeDetailsModal recipe={detailRecipe} onClose={() => setDetailRecipe(null)} />}
    </div>
  );
}

function MealBlock({
  date,
  mealType,
  timingLabel,
  options,
  selectedIds,
  open,
  entries,
  recipes,
  ingredients,
  onToggle,
  onDetails,
  onSelect,
  onAddEntry,
  onUpdateEntry,
  onDeleteEntry,
  onAddRecipe,
}: {
  date: string;
  mealType: MealType;
  timingLabel: string;
  options: RecommendedRecipe[];
  selectedIds: Set<string>;
  open: boolean;
  entries: DailyFoodEntry[];
  recipes: Recipe[];
  ingredients: Ingredient[];
  onToggle: () => void;
  onDetails: (recipe: Recipe) => void;
  onSelect: (recipeId: string) => void;
  onAddEntry: (payload: DailyFoodEntryPayload) => void;
  onUpdateEntry: (id: string, payload: DailyFoodEntryPayload) => void;
  onDeleteEntry: (entry: DailyFoodEntry) => void;
  onAddRecipe: () => void;
}) {
  const [recipeId, setRecipeId] = useState(recipes[0]?.id ?? "");
  const [ingredientId, setIngredientId] = useState(ingredients[0]?.id ?? "");
  const selectedIngredient = ingredients.find((ingredient) => ingredient.id === ingredientId);
  const [ingredientQuantity, setIngredientQuantity] = useState(selectedIngredient?.default_quantity ?? 0);
  const [recipeTime, setRecipeTime] = useState(defaultMealTime(mealType));
  const [ingredientTime, setIngredientTime] = useState(defaultMealTime(mealType));

  useEffect(() => {
    if (!recipeId && recipes[0]) setRecipeId(recipes[0].id);
  }, [recipeId, recipes]);

  useEffect(() => {
    if (!ingredientId && ingredients[0]) setIngredientId(ingredients[0].id);
  }, [ingredientId, ingredients]);

  useEffect(() => {
    if (selectedIngredient) setIngredientQuantity(Number(selectedIngredient.default_quantity));
  }, [selectedIngredient?.id]);

  const addRecipeFromLibrary = () => {
    const recipe = recipes.find((item) => item.id === recipeId);
    if (!recipe) return;
    onAddEntry({
      date,
      meal_type: mealType,
      entry_type: "recipe",
      intake_time: recipeTime,
      recipe_id: recipe.id,
      ingredient_id: null,
      quantity: null,
      unit: null,
      ingredient_overrides: recipe.ingredients.map((item) => ({
        ingredient_id: item.ingredient_id,
        quantity: Number(item.quantity),
        unit: item.unit,
      })),
    });
  };

  const addIngredientFromLibrary = () => {
    const ingredient = ingredients.find((item) => item.id === ingredientId);
    if (!ingredient) return;
    onAddEntry({
      date,
      meal_type: mealType,
      entry_type: "ingredient",
      intake_time: ingredientTime,
      recipe_id: null,
      ingredient_id: ingredient.id,
      quantity: Number(ingredientQuantity || ingredient.default_quantity),
      unit: ingredient.unit,
      ingredient_overrides: [],
    });
  };

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
      <button
        type="button"
        className="flex min-h-12 w-full items-center justify-between gap-3 rounded-lg px-1 text-left transition hover:bg-slate-50"
        onClick={onToggle}
        aria-expanded={open}
      >
        <div>
          <h2 className="text-lg font-black capitalize">{label(mealType)}</h2>
          <p className="text-sm font-semibold text-slate-500">Best timing: {timingLabel}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-mint">{options.length} options</span>
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-lg font-black leading-none text-slate-600">
            {open ? "-" : "+"}
          </span>
        </div>
      </button>
      {open && (
        <div className="mt-3">
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
                  selected={selectedIds.has(recipe.id)}
                  rank={index + 1}
                  onDetails={() => onDetails(recipe)}
                  onSelect={() => onSelect(recipe.id)}
                  onSwap={() => onSelect(options[(index + 1) % options.length]?.id ?? recipe.id)}
                />
              ))}
            </div>
          )}
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            <Card className="border-slate-200 shadow-none">
              <div className="mb-2 text-sm font-black uppercase tracking-wide text-slate-500">Add recipe</div>
              <div className="grid gap-2 sm:grid-cols-[1fr_8rem_auto]">
                <Select value={recipeId} onChange={(event) => setRecipeId(event.target.value)} disabled={recipes.length === 0}>
                  {recipes.map((recipe) => <option key={recipe.id} value={recipe.id}>{recipe.name}</option>)}
                </Select>
                <Input type="time" value={recipeTime} onChange={(event) => setRecipeTime(event.target.value)} />
                <Button type="button" variant="secondary" icon={<Plus />} onClick={addRecipeFromLibrary} disabled={!recipeId}>
                  Recipe
                </Button>
              </div>
            </Card>
            <Card className="border-slate-200 shadow-none">
              <div className="mb-2 text-sm font-black uppercase tracking-wide text-slate-500">Add ingredient</div>
              <div className="grid gap-2 sm:grid-cols-[1fr_7rem_8rem_auto]">
                <Select value={ingredientId} onChange={(event) => setIngredientId(event.target.value)} disabled={ingredients.length === 0}>
                  {ingredients.map((ingredient) => <option key={ingredient.id} value={ingredient.id}>{ingredient.name}</option>)}
                </Select>
                <Input
                  type="number"
                  min="0"
                  step="0.1"
                  value={ingredientQuantity}
                  onChange={(event) => setIngredientQuantity(Number(event.target.value))}
                />
                <Input type="time" value={ingredientTime} onChange={(event) => setIngredientTime(event.target.value)} />
                <Button type="button" variant="secondary" icon={<ShoppingBasket />} onClick={addIngredientFromLibrary} disabled={!ingredientId}>
                  Ingredient
                </Button>
              </div>
            </Card>
          </div>
          {entries.length > 0 && (
            <div className="mt-4">
              <div className="text-sm font-black uppercase tracking-wide text-slate-500">Logged for {label(mealType)}</div>
              <LoggedFoodTable
                entries={entries}
                recipes={recipes}
                ingredients={ingredients}
                onUpdate={onUpdateEntry}
                onDelete={onDeleteEntry}
              />
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function LoggedFoodTable({
  entries,
  recipes,
  ingredients,
  onUpdate,
  onDelete,
}: {
  entries: DailyFoodEntry[];
  recipes: Recipe[];
  ingredients: Ingredient[];
  onUpdate: (id: string, payload: DailyFoodEntryPayload) => void;
  onDelete: (entry: DailyFoodEntry) => void;
}) {
  return (
    <div className="mt-2 overflow-x-auto rounded-lg border border-slate-200 bg-white">
      <table className="min-w-[760px] w-full border-collapse text-sm">
        <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
          <tr>
            <th className="border-b border-slate-200 px-3 py-2 text-left">Item</th>
            <th className="border-b border-slate-200 px-3 py-2 text-left">Time</th>
            <th className="border-b border-slate-200 px-3 py-2 text-right">Qty</th>
            <th className="border-b border-slate-200 px-3 py-2 text-left">Unit</th>
            <th className="border-b border-slate-200 px-3 py-2 text-right">kcal</th>
            <th className="border-b border-slate-200 px-3 py-2 text-right">P</th>
            <th className="border-b border-slate-200 px-3 py-2 text-right">C</th>
            <th className="border-b border-slate-200 px-3 py-2 text-right">F</th>
            <th className="border-b border-slate-200 px-3 py-2 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <LoggedFoodRows
              key={entry.id}
              entry={entry}
              recipes={recipes}
              ingredients={ingredients}
              onUpdate={onUpdate}
              onDelete={onDelete}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function LoggedFoodRows({
  entry,
  recipes,
  ingredients,
  onUpdate,
  onDelete,
}: {
  entry: DailyFoodEntry;
  recipes: Recipe[];
  ingredients: Ingredient[];
  onUpdate: (id: string, payload: DailyFoodEntryPayload) => void;
  onDelete: (entry: DailyFoodEntry) => void;
}) {
  const recipe = entry.recipe_id ? recipes.find((item) => item.id === entry.recipe_id) : null;
  const ingredient = entry.ingredient_id ? ingredients.find((item) => item.id === entry.ingredient_id) : null;
  const totals = calculateFoodEntryTotals(entry, recipes, ingredients);

  const updateIngredientEntry = (quantity: number) => {
    if (!ingredient || !Number.isFinite(quantity) || quantity <= 0) return;
    onUpdate(entry.id, {
      date: normalizeEntryDate(entry.date),
      meal_type: entry.meal_type,
      entry_type: "ingredient",
      intake_time: entry.intake_time,
      recipe_id: null,
      ingredient_id: ingredient.id,
      quantity,
      unit: entry.unit ?? ingredient.unit,
      ingredient_overrides: [],
    });
  };

  const updateEntryTime = (intakeTime: string) => {
    onUpdate(entry.id, {
      date: normalizeEntryDate(entry.date),
      meal_type: entry.meal_type,
      entry_type: entry.entry_type,
      intake_time: intakeTime || null,
      recipe_id: entry.recipe_id,
      ingredient_id: entry.ingredient_id,
      quantity: entry.quantity,
      unit: entry.unit,
      ingredient_overrides: entry.ingredient_overrides,
    });
  };

  const updateRecipeIngredient = (item: RecipeIngredient, quantity: number) => {
    if (!recipe || !Number.isFinite(quantity) || quantity <= 0) return;
    const overrides = recipe.ingredients.map((ingredientItem) => {
      const existing = entry.ingredient_overrides.find((override) => override.ingredient_id === ingredientItem.ingredient_id);
      return {
        ingredient_id: ingredientItem.ingredient_id,
        quantity: ingredientItem.ingredient_id === item.ingredient_id ? quantity : Number(existing?.quantity ?? ingredientItem.quantity),
        unit: existing?.unit ?? ingredientItem.unit,
      };
    });
    onUpdate(entry.id, {
      date: normalizeEntryDate(entry.date),
      meal_type: entry.meal_type,
      entry_type: "recipe",
      intake_time: entry.intake_time,
      recipe_id: recipe.id,
      ingredient_id: null,
      quantity: null,
      unit: null,
      ingredient_overrides: overrides,
    });
  };

  if (recipe) {
    return (
      <>
        <tr className="bg-slate-50">
          <td className="border-b border-slate-200 px-3 py-2 font-black">{recipe.name}</td>
          <td className="border-b border-slate-200 px-3 py-2">
            <Input className="h-8 max-w-28 py-1" type="time" defaultValue={entry.intake_time ?? defaultMealTime(entry.meal_type)} onBlur={(event) => updateEntryTime(event.target.value)} />
          </td>
          <td className="border-b border-slate-200 px-3 py-2 text-right font-bold tabular-nums">{round(recipeWeight(entry, recipe))}</td>
          <td className="border-b border-slate-200 px-3 py-2 text-slate-500">recipe</td>
          <MacroCell value={totals.kcal} tone="kcal" />
          <MacroCell value={totals.protein_g} tone="protein" />
          <MacroCell value={totals.carbs_g} tone="carbs" />
          <MacroCell value={totals.fat_g} tone="fat" />
          <td className="border-b border-slate-200 px-3 py-2 text-right">
            <Button type="button" variant="ghost" className="h-8 w-8 px-0 text-red-600" aria-label="Remove entry" icon={<Trash2 size={16} />} onClick={() => onDelete(entry)} />
          </td>
        </tr>
        {recipe.ingredients.map((item) => {
          const override = entry.ingredient_overrides.find((entryItem) => entryItem.ingredient_id === item.ingredient_id);
          const quantity = Number(override?.quantity ?? item.quantity);
          const rowTotals = ingredientTotals({ ...item, quantity });
          return (
            <tr key={item.ingredient_id} className="hover:bg-slate-50">
              <td className="border-b border-slate-100 px-3 py-1.5 pl-6 font-semibold text-slate-700">{item.name ?? "Ingredient"}</td>
              <td className="border-b border-slate-100 px-3 py-1.5 text-slate-400"></td>
              <td className="border-b border-slate-100 px-3 py-1.5">
                <Input
                  className="ml-auto h-8 max-w-24 py-1 text-right"
                  type="number"
                  min="0"
                  step="0.1"
                  defaultValue={quantity}
                  onBlur={(event) => updateRecipeIngredient(item, Number(event.target.value))}
                />
              </td>
              <td className="border-b border-slate-100 px-3 py-1.5 text-slate-600">{override?.unit ?? item.unit}</td>
              <MacroCell value={rowTotals.kcal} tone="kcal" subtle />
              <MacroCell value={rowTotals.protein_g} tone="protein" subtle />
              <MacroCell value={rowTotals.carbs_g} tone="carbs" subtle />
              <MacroCell value={rowTotals.fat_g} tone="fat" subtle />
              <td className="border-b border-slate-100 px-3 py-1.5"></td>
            </tr>
          );
        })}
      </>
    );
  }

  if (!ingredient) return null;

  return (
    <tr className="hover:bg-slate-50">
      <td className="border-b border-slate-200 px-3 py-2 font-black">{ingredient.name}</td>
      <td className="border-b border-slate-200 px-3 py-2">
        <Input className="h-8 max-w-28 py-1" type="time" defaultValue={entry.intake_time ?? defaultMealTime(entry.meal_type)} onBlur={(event) => updateEntryTime(event.target.value)} />
      </td>
      <td className="border-b border-slate-200 px-3 py-2">
        <Input
          className="ml-auto h-8 max-w-24 py-1 text-right"
          type="number"
          min="0"
          step="0.1"
          defaultValue={Number(entry.quantity ?? ingredient.default_quantity)}
          onBlur={(event) => updateIngredientEntry(Number(event.target.value))}
        />
      </td>
      <td className="border-b border-slate-200 px-3 py-2 text-slate-600">{entry.unit ?? ingredient.unit}</td>
      <MacroCell value={totals.kcal} tone="kcal" />
      <MacroCell value={totals.protein_g} tone="protein" />
      <MacroCell value={totals.carbs_g} tone="carbs" />
      <MacroCell value={totals.fat_g} tone="fat" />
      <td className="border-b border-slate-200 px-3 py-2 text-right">
        <Button type="button" variant="ghost" className="h-8 w-8 px-0 text-red-600" aria-label="Remove entry" icon={<Trash2 size={16} />} onClick={() => onDelete(entry)} />
      </td>
    </tr>
  );
}

function MacroCell({ value, tone, subtle = false }: { value: number; tone: "kcal" | "protein" | "carbs" | "fat"; subtle?: boolean }) {
  const tones = {
    kcal: subtle ? "bg-amber-50/60 text-amber-900" : "bg-amber-100 text-amber-950",
    protein: subtle ? "bg-emerald-50/60 text-emerald-900" : "bg-emerald-100 text-emerald-950",
    carbs: subtle ? "bg-sky-50/60 text-sky-900" : "bg-sky-100 text-sky-950",
    fat: subtle ? "bg-rose-50/60 text-rose-900" : "bg-rose-100 text-rose-950",
  };
  return (
    <td className={`border-b border-slate-100 px-3 py-2 text-right font-black tabular-nums ${tones[tone]}`}>
      {round(value)}
    </td>
  );
}

function LiveEnergyChart({
  entries,
  recipes,
  ingredients,
  activities,
}: {
  entries: DailyFoodEntry[];
  recipes: Recipe[];
  ingredients: Ingredient[];
  activities: Activity[];
}) {
  const events = [
    ...entries.map((entry) => ({
      type: "meal" as const,
      minute: timeToMinutes(entry.intake_time ?? defaultMealTime(entry.meal_type)),
      kcal: calculateFoodEntryTotals(entry, recipes, ingredients).kcal,
      label: entryLabel(entry, recipes, ingredients),
    })),
    ...activities
      .filter((activity) => activity.start_time)
      .map((activity) => ({
        type: "workout" as const,
        minute: timeToMinutes(activity.start_time ?? "12:00"),
        kcal: -estimateWorkoutKcal(activity),
        label: label(activity.activity_type),
      })),
  ].sort((a, b) => a.minute - b.minute);

  const points = [{ minute: 0, value: 0 }];
  let running = 0;
  for (const event of events) {
    points.push({ minute: event.minute, value: running });
    running += event.kcal;
    points.push({ minute: event.minute, value: running });
  }
  points.push({ minute: 1440, value: running });

  const minValue = Math.min(-250, ...points.map((point) => point.value));
  const maxValue = Math.max(500, ...points.map((point) => point.value));
  const range = Math.max(1, maxValue - minValue);
  const width = 960;
  const height = 260;
  const padding = { left: 52, right: 20, top: 24, bottom: 36 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const x = (minute: number) => padding.left + (minute / 1440) * plotWidth;
  const y = (value: number) => padding.top + ((maxValue - value) / range) * plotHeight;
  const path = points.map((point) => `${x(point.minute)},${y(point.value)}`).join(" ");
  const zeroY = y(0);

  return (
    <Card>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-sm font-black uppercase tracking-wide text-mint">Live Energy</div>
          <p className="text-sm font-semibold text-slate-500">Net logged kcal by intake time, with workout estimates deducted.</p>
        </div>
        <div className="text-right text-sm font-black">
          {Math.round(running)} kcal
          <div className="text-xs font-bold text-slate-500">current net</div>
        </div>
      </div>
      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${width} ${height}`} className="min-w-[760px] w-full rounded-lg bg-slate-950">
          {[minValue, 0, maxValue].map((tick) => (
            <g key={tick}>
              <line x1={padding.left} x2={width - padding.right} y1={y(tick)} y2={y(tick)} stroke={tick === 0 ? "#e2e8f0" : "#334155"} strokeDasharray={tick === 0 ? "4 4" : "0"} />
              <text x={padding.left - 10} y={y(tick) + 4} textAnchor="end" fill="#cbd5e1" fontSize="12">{Math.round(tick)}</text>
            </g>
          ))}
          {[0, 360, 720, 1080, 1440].map((minute) => (
            <g key={minute}>
              <line x1={x(minute)} x2={x(minute)} y1={padding.top} y2={height - padding.bottom} stroke="#1e293b" />
              <text x={x(minute)} y={height - 12} textAnchor="middle" fill="#cbd5e1" fontSize="12">{formatHour(minute)}</text>
            </g>
          ))}
          <line x1={padding.left} x2={width - padding.right} y1={zeroY} y2={zeroY} stroke="#cbd5e1" strokeDasharray="4 4" />
          <polyline points={path} fill="none" stroke="#f8fafc" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
          {events.map((event, index) => {
            const valueAfter = [...points].reverse().find((point) => point.minute === event.minute)?.value ?? 0;
            return (
              <g key={`${event.type}-${event.minute}-${index}`}>
                <circle cx={x(event.minute)} cy={y(valueAfter)} r="7" fill={event.type === "meal" ? "#f59e0b" : "#38bdf8"} stroke="#0f172a" strokeWidth="2" />
                <title>{`${formatHour(event.minute)} ${event.label}: ${Math.round(event.kcal)} kcal`}</title>
              </g>
            );
          })}
        </svg>
      </div>
      <div className="mt-2 flex flex-wrap gap-3 text-xs font-bold text-slate-600">
        <span><span className="mr-1 inline-block h-2.5 w-2.5 rounded-full bg-amber-500" />Logged intake</span>
        <span><span className="mr-1 inline-block h-2.5 w-2.5 rounded-full bg-sky-400" />Workout estimate</span>
      </div>
    </Card>
  );
}

function RecipeDetailsModal({ recipe, onClose }: { recipe: Recipe; onClose: () => void }) {
  return (
    <Modal title={recipe.name} onClose={onClose}>
      <div className="space-y-4">
        <MacroBadges totals={recipe.totals} />
        <div className="overflow-x-auto">
          <table className="min-w-[620px] w-full border-collapse bg-white text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="border border-slate-200 px-3 py-2 text-left">Ingredient</th>
                <th className="border border-slate-200 px-3 py-2 text-right">Quantity</th>
                <th className="border border-slate-200 px-3 py-2 text-left">Unit</th>
                <th className="border border-slate-200 px-3 py-2 text-right">kcal</th>
                <th className="border border-slate-200 px-3 py-2 text-right">P</th>
                <th className="border border-slate-200 px-3 py-2 text-right">F</th>
                <th className="border border-slate-200 px-3 py-2 text-right">C</th>
              </tr>
            </thead>
            <tbody>
              {recipe.ingredients.map((item) => {
                const totals = ingredientTotals(item);
                return (
                  <tr key={item.id || item.ingredient_id} className="hover:bg-slate-50">
                    <td className="border border-slate-200 px-3 py-2 font-bold">{item.name ?? "Ingredient"}</td>
                    <td className="border border-slate-200 px-3 py-2 text-right tabular-nums">{round(Number(item.quantity))}</td>
                    <td className="border border-slate-200 px-3 py-2">{item.unit}</td>
                    <td className="border border-slate-200 px-3 py-2 text-right font-black tabular-nums text-amber-900">{round(totals.kcal)}</td>
                    <td className="border border-slate-200 px-3 py-2 text-right font-black tabular-nums text-emerald-900">{round(totals.protein_g)}</td>
                    <td className="border border-slate-200 px-3 py-2 text-right font-black tabular-nums text-rose-900">{round(totals.fat_g)}</td>
                    <td className="border border-slate-200 px-3 py-2 text-right font-black tabular-nums text-sky-900">{round(totals.carbs_g)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {recipe.preparation_notes && <p className="text-sm font-semibold text-slate-600">{recipe.preparation_notes}</p>}
      </div>
    </Modal>
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

function buildAiCoachInput({
  activities,
  dayType,
  dayLabel,
  targetGoal,
  target,
  selections,
  recipes,
}: {
  activities: Activity[];
  dayType: AiCoachDayType;
  dayLabel: string;
  targetGoal: TargetGoal;
  target: MacroTarget;
  selections: DailyMealSelection[];
  recipes: Recipe[];
}): AiNutritionCoachInput {
  const primaryWorkout = activities[0];
  const selectedMeals = selections
    .map((selection) => {
      const recipe = recipes.find((item) => item.id === selection.selected_recipe_id);
      if (!recipe) return null;
      return {
        mealType: selection.meal_type,
        recipeId: recipe.id,
        recipeName: recipe.name,
        kcal: Math.round(recipe.totals.kcal),
        protein: Math.round(recipe.totals.protein_g),
        carbs: Math.round(recipe.totals.carbs_g),
        fat: Math.round(recipe.totals.fat_g),
      };
    })
    .filter((meal): meal is NonNullable<typeof meal> => Boolean(meal));

  return {
    goal: mapGoal(targetGoal),
    dayType: dayLabel === "mixed" ? "mixed" : dayType,
    workout: {
      type: primaryWorkout?.activity_type ?? dayType,
      startTime: primaryWorkout?.start_time ?? null,
      durationMinutes: primaryWorkout?.duration_minutes ?? null,
      intensity: mapIntensity(primaryWorkout?.intensity ?? null),
    },
    currentTargets: {
      calories: target.kcal_max ?? target.kcal_min ?? 0,
      protein: target.protein_min ?? 0,
      carbs: target.carbs_max ?? target.carbs_min ?? 0,
      fat: target.fat_max ?? target.fat_min ?? 0,
    },
    selectedMeals,
    availableRecipes: recipes.slice(0, 40).map((recipe) => ({
      id: recipe.id,
      name: recipe.name,
      mealType: recipe.meal_type,
      kcal: Math.round(recipe.totals.kcal),
      protein: Math.round(recipe.totals.protein_g),
      carbs: Math.round(recipe.totals.carbs_g),
      fat: Math.round(recipe.totals.fat_g),
      tags: recipe.tags ?? [],
    })),
    userPreferences: {
      dietaryRestrictions: [],
      preferredMealComplexity: null,
    },
  };
}

function mapGoal(goal: TargetGoal): AiCoachGoal {
  return goal === "recomp" ? "body_recomp" : goal;
}

function mapIntensity(intensity: Activity["intensity"]): "low" | "moderate" | "high" | null {
  if (intensity === "medium") return "moderate";
  return intensity;
}

function calculateFoodEntryTotals(entry: DailyFoodEntry, recipes: Recipe[], ingredients: Ingredient[]) {
  if (entry.entry_type === "recipe" && entry.recipe_id) {
    const recipe = recipes.find((item) => item.id === entry.recipe_id);
    if (!recipe) return { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 };
    const items = recipe.ingredients.map((item) => {
      const override = entry.ingredient_overrides.find((entryItem) => entryItem.ingredient_id === item.ingredient_id);
      return {
        ...item,
        quantity: Number(override?.quantity ?? item.quantity),
        unit: override?.unit ?? item.unit,
      };
    });
    return formatTotals(calculateRecipeTotals(items, ingredients));
  }

  if (entry.entry_type === "ingredient" && entry.ingredient_id) {
    const ingredient = ingredients.find((item) => item.id === entry.ingredient_id);
    if (!ingredient) return { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 };
    const scale = Number(entry.quantity ?? 0) / Number(ingredient.default_quantity);
    return formatTotals({
      kcal: Number(ingredient.kcal) * scale,
      protein_g: Number(ingredient.protein_g) * scale,
      carbs_g: Number(ingredient.carbs_g) * scale,
      fat_g: Number(ingredient.fat_g) * scale,
    });
  }

  return { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 };
}

function ingredientTotals(item: RecipeIngredient) {
  const scale = Number(item.quantity || 0) / Number(item.default_quantity || item.quantity || 1);
  return {
    kcal: Number(item.kcal || 0) * scale,
    protein_g: Number(item.protein_g || 0) * scale,
    fat_g: Number(item.fat_g || 0) * scale,
    carbs_g: Number(item.carbs_g || 0) * scale,
  };
}

function recipeWeight(entry: DailyFoodEntry, recipe: Recipe) {
  return recipe.ingredients.reduce((total, item) => {
    const override = entry.ingredient_overrides.find((entryItem) => entryItem.ingredient_id === item.ingredient_id);
    return total + Number(override?.quantity ?? item.quantity ?? 0);
  }, 0);
}

function defaultMealTime(mealType: MealType) {
  const defaults: Record<MealType, string> = {
    breakfast: "08:00",
    lunch: "12:30",
    dinner: "19:00",
    snack: "16:00",
  };
  return defaults[mealType];
}

function timeToMinutes(time: string) {
  const [hours, minutes] = time.slice(0, 5).split(":").map(Number);
  return Math.min(1440, Math.max(0, (hours || 0) * 60 + (minutes || 0)));
}

function formatHour(minute: number) {
  const hours = Math.floor(minute / 60);
  const minutes = minute % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function estimateWorkoutKcal(activity: Activity) {
  const minutes = Number(activity.duration_minutes ?? 45);
  const intensityFactor = activity.intensity === "high" ? 11 : activity.intensity === "medium" ? 8 : 5;
  const typeFactor = activity.activity_type === "endurance_bike"
    ? 1.2
    : activity.activity_type === "interval_bike"
      ? 1.35
      : activity.activity_type === "gym"
        ? 0.85
        : 0;
  return Math.round(minutes * intensityFactor * typeFactor);
}

function entryLabel(entry: DailyFoodEntry, recipes: Recipe[], ingredients: Ingredient[]) {
  if (entry.recipe_id) return recipes.find((recipe) => recipe.id === entry.recipe_id)?.name ?? "Recipe";
  if (entry.ingredient_id) return ingredients.find((ingredient) => ingredient.id === entry.ingredient_id)?.name ?? "Ingredient";
  return "Logged food";
}

function round(value: number) {
  return Math.round(Number(value) * 10) / 10;
}

function normalizeEntryDate(date: string) {
  return date.slice(0, 10);
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
