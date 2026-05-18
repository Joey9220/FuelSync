import type { Ingredient, Recipe, Stats } from "../types";

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

    const data = await response.json();
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
  };
}
