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
    const savedEntry = await api.updateDailyFoodEntry(id, payload);
    setFoodEntries((current) => current.map((entry) => (entry.id === savedEntry.id ? savedEntry : entry)));
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
                      entries={foodEntries.filter((entry) => entry.meal_type === mealType)}
                      recipes={recipes.filter((recipe) => recipe.meal_type === mealType)}
                      ingredients={ingredients}
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
    </div>
  );
}

function MealBlock({
  date,
  mealType,
  timingLabel,
  options,
  selectedIds,
  entries,
  recipes,
  ingredients,
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
  entries: DailyFoodEntry[];
  recipes: Recipe[];
  ingredients: Ingredient[];
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
      recipe_id: null,
      ingredient_id: ingredient.id,
      quantity: Number(ingredientQuantity || ingredient.default_quantity),
      unit: ingredient.unit,
      ingredient_overrides: [],
    });
  };

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
              selected={selectedIds.has(recipe.id)}
              rank={index + 1}
              onSelect={() => onSelect(recipe.id)}
              onSwap={() => onSelect(options[(index + 1) % options.length]?.id ?? recipe.id)}
            />
          ))}
        </div>
      )}
      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <Card className="border-slate-200 shadow-none">
          <div className="mb-2 text-sm font-black uppercase tracking-wide text-slate-500">Add recipe</div>
          <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
            <Select value={recipeId} onChange={(event) => setRecipeId(event.target.value)} disabled={recipes.length === 0}>
              {recipes.map((recipe) => <option key={recipe.id} value={recipe.id}>{recipe.name}</option>)}
            </Select>
            <Button type="button" variant="secondary" icon={<Plus />} onClick={addRecipeFromLibrary} disabled={!recipeId}>
              Recipe
            </Button>
          </div>
        </Card>
        <Card className="border-slate-200 shadow-none">
          <div className="mb-2 text-sm font-black uppercase tracking-wide text-slate-500">Add ingredient</div>
          <div className="grid gap-2 sm:grid-cols-[1fr_7rem_auto]">
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
            <Button type="button" variant="secondary" icon={<ShoppingBasket />} onClick={addIngredientFromLibrary} disabled={!ingredientId}>
              Ingredient
            </Button>
          </div>
        </Card>
      </div>
      {entries.length > 0 && (
        <div className="mt-4 space-y-3">
          <div className="text-sm font-black uppercase tracking-wide text-slate-500">Logged for {label(mealType)}</div>
          {entries.map((entry) => (
            <FoodEntryEditor
              key={entry.id}
              entry={entry}
              recipes={recipes}
              ingredients={ingredients}
              onUpdate={onUpdateEntry}
              onDelete={onDeleteEntry}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function FoodEntryEditor({
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

  const updateIngredientEntry = (quantity: number) => {
    if (!ingredient || !Number.isFinite(quantity) || quantity <= 0) return;
    onUpdate(entry.id, {
      date: normalizeEntryDate(entry.date),
      meal_type: entry.meal_type,
      entry_type: "ingredient",
      recipe_id: null,
      ingredient_id: ingredient.id,
      quantity,
      unit: entry.unit ?? ingredient.unit,
      ingredient_overrides: [],
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
      recipe_id: recipe.id,
      ingredient_id: null,
      quantity: null,
      unit: null,
      ingredient_overrides: overrides,
    });
  };

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div>
          <div className="font-black">{recipe?.name ?? ingredient?.name ?? "Food entry"}</div>
          <div className="text-xs font-bold uppercase tracking-wide text-slate-500">{entry.entry_type}</div>
        </div>
        <Button type="button" variant="ghost" className="h-9 w-9 px-0" aria-label="Remove entry" icon={<Trash2 />} onClick={() => onDelete(entry)} />
      </div>
      {recipe && (
        <div className="grid gap-2 md:grid-cols-2">
          {recipe.ingredients.map((item) => {
            const override = entry.ingredient_overrides.find((entryItem) => entryItem.ingredient_id === item.ingredient_id);
            return (
              <Field key={item.ingredient_id} label={`${item.name ?? "Ingredient"} (${override?.unit ?? item.unit})`}>
                <Input
                  type="number"
                  min="0"
                  step="0.1"
                  defaultValue={Number(override?.quantity ?? item.quantity)}
                  onBlur={(event) => updateRecipeIngredient(item, Number(event.target.value))}
                />
              </Field>
            );
          })}
        </div>
      )}
      {ingredient && (
        <Field label={`${ingredient.name} (${entry.unit ?? ingredient.unit})`}>
          <Input
            type="number"
            min="0"
            step="0.1"
            defaultValue={Number(entry.quantity ?? ingredient.default_quantity)}
            onBlur={(event) => updateIngredientEntry(Number(event.target.value))}
          />
        </Field>
      )}
    </div>
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
