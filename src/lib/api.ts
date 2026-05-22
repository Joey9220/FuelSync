import type {
  Activity,
  ActivityPayload,
  AiNutritionCoachInput,
  AiNutritionCoachSuggestion,
  BodyMetricsResponse,
  BodyMetric,
  DailyFoodEntry,
  DailyFoodEntryPayload,
  DailyMealSelection,
  Ingredient,
  MacroTarget,
  MacroTargetPayload,
  MealType,
  Recipe,
  Stats,
  TargetGoal,
  UserPreferences,
  WithingsConnectionStatus,
} from "../types";
import { normalizeDateKey } from "./date";

const baseUrl = import.meta.env.VITE_API_BASE_URL || "/api";

export type ApiClient = ReturnType<typeof createApiClient>;

export function createApiClient(getToken: () => Promise<string>) {
  async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const token = await getToken();
    const response = await fetch(`${baseUrl}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...options.headers,
      },
    });

    if (response.status === 204) return undefined as T;

    const data = await parseResponseBody(response);
    if (!response.ok) {
      throw new Error(data.error || "Request failed.");
    }
    return data as T;
  }

  return {
    getStats: () => request<{ stats: Stats }>("/stats").then((data) => data.stats),
    getIngredients: (search = "") =>
      request<{ ingredients: Ingredient[] }>(`/ingredients${search ? `?search=${encodeURIComponent(search)}` : ""}`).then(
        (data) => data.ingredients,
      ),
    createIngredient: (payload: Omit<Ingredient, "id" | "created_at" | "updated_at">) =>
      request<{ ingredient: Ingredient }>("/ingredients", { method: "POST", body: JSON.stringify(payload) }).then(
        (data) => data.ingredient,
      ),
    updateIngredient: (id: string, payload: Omit<Ingredient, "id" | "created_at" | "updated_at">) =>
      request<{ ingredient: Ingredient }>(`/ingredients?id=${id}`, { method: "PUT", body: JSON.stringify(payload) }).then(
        (data) => data.ingredient,
      ),
    deleteIngredient: (id: string) => request<void>(`/ingredients?id=${id}`, { method: "DELETE" }),
    getRecipes: (mealType = "") =>
      request<{ recipes: Recipe[] }>(`/recipes${mealType ? `?meal_type=${mealType}` : ""}`).then((data) => data.recipes),
    createRecipe: (payload: Omit<Recipe, "id" | "created_at" | "updated_at" | "totals">) =>
      request<{ recipe: Recipe }>("/recipes", { method: "POST", body: JSON.stringify(payload) }).then((data) => data.recipe),
    updateRecipe: (id: string, payload: Omit<Recipe, "id" | "created_at" | "updated_at" | "totals">) =>
      request<{ recipe: Recipe }>(`/recipes?id=${id}`, { method: "PUT", body: JSON.stringify(payload) }).then(
        (data) => data.recipe,
      ),
    deleteRecipe: (id: string) => request<void>(`/recipes?id=${id}`, { method: "DELETE" }),
    getActivities: (params: { date?: string; from?: string; to?: string } = {}) => {
      const query = new URLSearchParams();
      if (params.date) query.set("date", params.date);
      if (params.from) query.set("from", params.from);
      if (params.to) query.set("to", params.to);
      return request<{ activities: Activity[] }>(`/activities${query.size ? `?${query}` : ""}`).then((data) =>
        data.activities.map((activity) => ({ ...activity, date: normalizeDateKey(activity.date) })),
      );
    },
    createActivity: (payload: ActivityPayload) =>
      request<{ activity: Activity }>("/activities", { method: "POST", body: JSON.stringify(payload) }).then(
        (data) => data.activity,
      ),
    updateActivity: (id: string, payload: ActivityPayload) =>
      request<{ activity: Activity }>(`/activities?id=${id}`, { method: "PUT", body: JSON.stringify(payload) }).then(
        (data) => data.activity,
      ),
    deleteActivity: (id: string) => request<void>(`/activities?id=${id}`, { method: "DELETE" }),
    getMealSelections: (date: string) =>
      request<{ selections: DailyMealSelection[] }>(`/meal-selections?date=${date}`).then((data) => data.selections),
    saveMealSelection: (payload: { date: string; meal_type: MealType; selected_recipe_id: string | null }) =>
      request<{ selection: DailyMealSelection }>("/meal-selections", { method: "PUT", body: JSON.stringify(payload) }).then(
        (data) => data.selection,
      ),
    getDailyFoodEntries: (date: string) =>
      request<{ entries: DailyFoodEntry[] }>(`/daily-food-entries?date=${date}`).then((data) => data.entries),
    createDailyFoodEntry: (payload: DailyFoodEntryPayload) =>
      request<{ entry: DailyFoodEntry }>("/daily-food-entries", { method: "POST", body: JSON.stringify(payload) }).then(
        (data) => data.entry,
      ),
    updateDailyFoodEntry: (id: string, payload: DailyFoodEntryPayload) =>
      request<{ entry: DailyFoodEntry }>(`/daily-food-entries?id=${id}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      }).then((data) => data.entry),
    deleteDailyFoodEntry: (id: string) => request<void>(`/daily-food-entries?id=${id}`, { method: "DELETE" }),
    getMacroTargets: (goal?: TargetGoal) =>
      request<{ targets: MacroTarget[] }>(`/macro-targets${goal ? `?goal=${goal}` : ""}`).then((data) => data.targets),
    saveMacroTarget: (payload: MacroTargetPayload) =>
      request<{ target: MacroTarget }>("/macro-targets", { method: "PUT", body: JSON.stringify(payload) }).then(
        (data) => data.target,
      ),
    getUserPreferences: () =>
      request<{ preferences: UserPreferences }>("/user-preferences").then((data) => data.preferences),
    saveUserPreferences: (payload: UserPreferences) =>
      request<{ preferences: UserPreferences }>("/user-preferences", {
        method: "PUT",
        body: JSON.stringify(payload),
      }).then((data) => data.preferences),
    getAiNutritionCoachSuggestion: (payload: AiNutritionCoachInput) =>
      request<{ suggestion: AiNutritionCoachSuggestion; model: string }>("/aiNutritionCoach", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    getWithingsAuthUrl: () => request<{ url: string; state: string }>("/withings-auth-url"),
    completeWithingsOAuth: (code: string) =>
      request<WithingsConnectionStatus>("/withings-oauth", { method: "POST", body: JSON.stringify({ code }) }),
    syncWithings: (days = 370) => request<{ synced: number; days: number }>(`/withings-sync?days=${days}`, { method: "POST" }),
    getBodyMetrics: (days = 30) =>
      request<BodyMetricsResponse>(`/body-metrics?days=${days}`).then((data) => ({
        connected: data.connected,
        last_synced_at: data.last_synced_at,
        metrics: data.metrics.map((metric) => ({
          ...metric,
          weight_kg: nullableNumber(metric.weight_kg),
          fat_mass_kg: nullableNumber(metric.fat_mass_kg),
          fat_percentage: nullableNumber(metric.fat_percentage),
          muscle_mass_kg: nullableNumber(metric.muscle_mass_kg),
          bone_mass_kg: nullableNumber(metric.bone_mass_kg),
          fat_free_mass_kg: nullableNumber(metric.fat_free_mass_kg),
        })),
      })),
  };
}

async function parseResponseBody(response: Response) {
  const text = await response.text();
  if (!text) return {};

  try {
    return JSON.parse(text);
  } catch {
    return {
      error: text.slice(0, 500) || `Request failed with status ${response.status}.`,
    };
  }
}

function nullableNumber(value: unknown) {
  if (value === null || value === undefined) return null;
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}
