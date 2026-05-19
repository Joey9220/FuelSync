export type MealType = "breakfast" | "lunch" | "dinner" | "snack";
export type DayType = "rest" | "gym" | "interval_bike" | "endurance_bike";
export type TimingType = "pre_workout" | "post_workout" | "neutral" | "evening_recovery" | "carb_support";
export type Intensity = "low" | "medium" | "high";
export type TargetGoal = "recomp" | "fat_loss" | "maintenance" | "cut" | "lean_bulk";

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

export type Activity = {
  id: string;
  user_id?: string;
  date: string;
  activity_type: DayType;
  start_time: string | null;
  duration_minutes: number | null;
  intensity: Intensity | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type ActivityPayload = Omit<Activity, "id" | "user_id" | "created_at" | "updated_at">;

export type DailyMealSelection = {
  id: string;
  date: string;
  meal_type: MealType;
  selected_recipe_id: string | null;
  recipe_name?: string | null;
  created_at: string;
};

export type MacroTarget = {
  id: string;
  target_goal: TargetGoal;
  day_type: DayType;
  kcal_min: number | null;
  kcal_max: number | null;
  protein_min: number | null;
  carbs_min: number | null;
  carbs_max: number | null;
  fat_min: number | null;
  fat_max: number | null;
  created_at: string;
  updated_at: string;
};

export type MacroTargetPayload = Omit<MacroTarget, "id" | "created_at" | "updated_at">;

export type UserPreferences = {
  target_goal: TargetGoal;
  height_cm?: number | null;
};

export type MealTimingContext = Record<MealType, TimingType>;

export type RecommendedRecipe = Recipe & {
  recommendationScore: number;
  recommendationReasons: string[];
};

export type BodyMetric = {
  id: string;
  measured_at: string;
  weight_kg: number | null;
  fat_mass_kg: number | null;
  fat_percentage: number | null;
  muscle_mass_kg: number | null;
  bone_mass_kg: number | null;
  fat_free_mass_kg: number | null;
  source: string;
};

export type WithingsConnectionStatus = {
  connected: boolean;
};

export type BodyMetricsResponse = {
  metrics: BodyMetric[];
  connected: boolean;
  last_synced_at: string | null;
};

export type AiCoachGoal = "body_recomp" | "fat_loss" | "maintenance" | "cut" | "lean_bulk";
export type AiCoachDayType = DayType | "mixed";

export type AiNutritionCoachInput = {
  goal: AiCoachGoal;
  dayType: AiCoachDayType;
  workout: {
    type: string;
    startTime: string | null;
    durationMinutes: number | null;
    intensity: "low" | "moderate" | "high" | null;
  };
  currentTargets: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  };
  selectedMeals: Array<{
    mealType: MealType;
    recipeId: string | null;
    recipeName: string;
    kcal: number;
    protein: number;
    carbs: number;
    fat: number;
  }>;
  availableRecipes: Array<{
    id: string;
    name: string;
    mealType: MealType;
    kcal: number;
    protein: number;
    carbs: number;
    fat: number;
    tags: string[];
  }>;
  userPreferences: {
    dietaryRestrictions: string[];
    preferredMealComplexity: "low" | "medium" | "high" | null;
  };
};

export type AiNutritionCoachSuggestion = {
  summary: string;
  macroSuggestion: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  };
  macroDelta: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  };
  mealTimingAdvice: {
    preWorkout: string | null;
    intraWorkout: string | null;
    postWorkout: string | null;
    general: string;
  };
  mealSuggestions: Array<{
    mealType: MealType;
    recipeId: string | null;
    recipeName: string;
    reason: string;
    fitScore: number;
  }>;
  warnings: string[];
  reasoning: string[];
  confidence: "low" | "medium" | "high";
};
