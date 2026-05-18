import type { DayType, MealType, Recipe, RecommendedRecipe, TimingType } from "../types";

type RecommendationInput = {
  dayType: DayType;
  timing: TimingType;
  mealType: MealType;
  recipes: Recipe[];
};

export function recommendRecipes({ dayType, timing, mealType, recipes }: RecommendationInput): RecommendedRecipe[] {
  return recipes
    .filter((recipe) => recipe.meal_type === mealType)
    .map((recipe) => scoreRecipe(recipe, dayType, timing))
    .filter((recipe) => recipe.recommendationScore > 0)
    .sort((a, b) => b.recommendationScore - a.recommendationScore)
    .slice(0, 3);
}

function scoreRecipe(recipe: Recipe, dayType: DayType, timing: TimingType): RecommendedRecipe {
  let score = 0;
  const reasons: string[] = [];
  const carbs = Number(recipe.totals.carbs_g);
  const fat = Number(recipe.totals.fat_g);
  const protein = Number(recipe.totals.protein_g);
  const kcal = Number(recipe.totals.kcal);
  const timingCandidates = timing === "carb_support" ? ["carb_support", "pre_workout", "neutral"] : [timing];

  if (recipe.suitable_day_types.includes(dayType)) {
    score += 35;
    reasons.push("day fit");
  }

  if (recipe.suitable_timing.some((item) => timingCandidates.includes(item))) {
    score += 30;
    reasons.push("timing fit");
  } else if (recipe.suitable_timing.includes("neutral")) {
    score += 12;
    reasons.push("neutral timing");
  }

  if (dayType === "rest") {
    if (carbs <= 55) score += 18;
    if (protein >= 20) score += 10;
    if (carbs > 95) score -= 18;
  }

  if (dayType === "gym") {
    if (protein >= 25) score += 20;
    if (carbs >= 35 && carbs <= 95) score += 14;
  }

  if (dayType === "interval_bike") {
    if (carbs >= 60) score += 24;
    if ((timing === "pre_workout" || timing === "post_workout") && fat <= 18) score += 14;
    if (timing === "pre_workout" || timing === "post_workout") score += 8;
  }

  if (dayType === "endurance_bike") {
    if (carbs >= 75) score += 26;
    if (kcal >= 450) score += 12;
    if (recipe.suitable_timing.includes("post_workout") || recipe.suitable_timing.includes("evening_recovery")) score += 8;
  }

  if (fat > 28 && (timing === "pre_workout" || timing === "carb_support")) score -= 8;
  if (protein >= 20) reasons.push("protein support");
  if (carbs >= 60) reasons.push("carb support");

  return { ...recipe, recommendationScore: score, recommendationReasons: reasons };
}
