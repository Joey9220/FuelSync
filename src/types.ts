export type MealType = "breakfast" | "lunch" | "dinner" | "snack";
export type DayType = "rest" | "gym" | "interval_bike" | "endurance_bike";
export type TimingType = "pre_workout" | "post_workout" | "neutral" | "evening_recovery";

export type Ingredient = {
  id: string;
  name: string;
  default_quantity: number;
  unit: string;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type RecipeIngredient = {
  id?: string;
  recipe_id?: string;
  ingredient_id: string;
  quantity: number;
  unit: string;
  name?: string;
  default_quantity?: number;
  kcal?: number;
  protein_g?: number;
  carbs_g?: number;
  fat_g?: number;
};

export type Recipe = {
  id: string;
  name: string;
  meal_type: MealType;
  suitable_day_types: DayType[];
  suitable_timing: TimingType[];
  preparation_notes: string | null;
  tags: string[];
  ingredients: RecipeIngredient[];
  totals: MacroTotals;
  created_at: string;
  updated_at: string;
};

export type MacroTotals = {
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
};

export type Stats = {
  ingredients: number;
  recipes: number;
};
