import { Check, RefreshCw } from "lucide-react";
import { Button } from "./Button";
import { Card } from "./Card";
import { MacroBadges } from "./MacroBadges";
import type { RecommendedRecipe } from "../types";

export function RecipeSuggestionCard({
  recipe,
  selected,
  onSelect,
  onSwap,
  rank,
}: {
  recipe: RecommendedRecipe;
  selected: boolean;
  onSelect: () => void;
  onSwap?: () => void;
  rank?: number;
}) {
  return (
    <Card className={`transition ${selected ? "border-mint bg-emerald-50/40 ring-2 ring-emerald-100" : ""}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="mb-1 flex flex-wrap items-center gap-2">
            {rank && <span className="rounded-full bg-ink px-2 py-0.5 text-[11px] font-black text-white">#{rank}</span>}
            {selected && <span className="rounded-full bg-mint px-2 py-0.5 text-[11px] font-black text-white">selected</span>}
          </div>
          <h3 className="font-black leading-tight">{recipe.name}</h3>
          <p className="mt-1 text-xs font-bold text-slate-500">{bestTiming(recipe)}</p>
        </div>
      </div>
      <div className="mt-3">
        <MacroBadges totals={recipe.totals} />
      </div>
      <p className="mt-3 rounded-lg bg-slate-50 p-3 text-sm font-semibold text-slate-600">
        {recommendationExplanation(recipe)}
      </p>
      {recipe.tags?.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {recipe.tags.map((tag) => (
            <span key={tag} className="rounded-full bg-slate-100 px-2 py-1 text-xs font-bold text-slate-600">
              {tag}
            </span>
          ))}
        </div>
      )}
      {recipe.preparation_notes && <p className="mt-3 text-sm text-slate-500">{recipe.preparation_notes}</p>}
      <div className="mt-4 grid grid-cols-2 gap-2">
        <Button type="button" variant={selected ? "primary" : "secondary"} icon={<Check />} onClick={onSelect}>
          {selected ? "Deselect" : "Select"}
        </Button>
        <Button type="button" variant="ghost" icon={<RefreshCw />} onClick={onSwap ?? onSelect}>
          Swap
        </Button>
      </div>
    </Card>
  );
}

function recommendationExplanation(recipe: RecommendedRecipe) {
  const reasons = recipe.recommendationReasons;
  if (reasons.includes("day fit") && reasons.includes("timing fit") && reasons.includes("carb support")) {
    return "Good fit because today's training timing matches this meal and it provides useful carbohydrate support.";
  }
  if (reasons.includes("day fit") && reasons.includes("timing fit")) {
    return "Good fit because it matches today's day type and workout timing.";
  }
  if (reasons.includes("protein support")) {
    return "Good fit because it supports protein intake while staying aligned with today's plan.";
  }
  if (reasons.includes("neutral timing")) {
    return "Good fit as a simple neutral option that can work around your training.";
  }
  return "Recommended based on meal type, macros, and available recipe metadata.";
}

function bestTiming(recipe: RecommendedRecipe) {
  if (!recipe.suitable_timing.length) return "Timing: flexible";
  return `Best timing: ${recipe.suitable_timing.map((item) => item.replace(/_/g, " ")).join(", ")}`;
}
