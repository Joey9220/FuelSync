import type { Ingredient, MacroTotals, RecipeIngredient } from "../types";

export function calculateRecipeTotals(items: RecipeIngredient[], ingredients: Ingredient[]): MacroTotals {
  return items.reduce(
    (totals, item) => {
      const ingredient = ingredients.find((candidate) => candidate.id === item.ingredient_id);
      if (!ingredient) return totals;
      const scale = Number(item.quantity) / Number(ingredient.default_quantity);
      totals.kcal += Number(ingredient.kcal) * scale;
      totals.protein_g += Number(ingredient.protein_g) * scale;
      totals.carbs_g += Number(ingredient.carbs_g) * scale;
      totals.fat_g += Number(ingredient.fat_g) * scale;
      return totals;
    },
    { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 },
  );
}

export function formatTotals(totals: MacroTotals): MacroTotals {
  return {
    kcal: Math.round(totals.kcal),
    protein_g: Math.round(totals.protein_g * 10) / 10,
    carbs_g: Math.round(totals.carbs_g * 10) / 10,
    fat_g: Math.round(totals.fat_g * 10) / 10,
  };
}
