import { Check } from "lucide-react";
import { Button } from "./Button";
import { Card } from "./Card";
import { MacroBadges } from "./MacroBadges";
import type { RecommendedRecipe } from "../types";

export function RecipeSuggestionCard({
  recipe,
  selected,
  onSelect,
}: {
  recipe: RecommendedRecipe;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <Card className={`transition ${selected ? "border-mint ring-2 ring-emerald-100" : ""}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-black">{recipe.name}</h3>
          <p className="mt-1 text-xs font-bold text-slate-500">Score {Math.round(recipe.recommendationScore)}</p>
        </div>
        <Button
          type="button"
          variant={selected ? "primary" : "secondary"}
          className="h-10 w-10 px-0"
          aria-label="Select recipe"
          icon={<Check size={16} />}
          onClick={onSelect}
        />
      </div>
      <div className="mt-3">
        <MacroBadges totals={recipe.totals} />
      </div>
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
    </Card>
  );
}
