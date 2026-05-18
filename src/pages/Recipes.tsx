import { ChevronDown, ChevronRight, Edit2, Plus, Search, Trash2, X } from "lucide-react";
import { Fragment, FormEvent, useEffect, useMemo, useState } from "react";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { Field, Input, Select, Textarea } from "../components/FormField";
import { MacroBadges } from "../components/MacroBadges";
import { Modal } from "../components/Modal";
import { EmptyState, ErrorState, LoadingState } from "../components/State";
import { calculateRecipeTotals, formatTotals } from "../lib/calculations";
import { dayTypes, label, mealTypes, timingTypes } from "../lib/constants";
import { useApi } from "../hooks/useApi";
import type { DayType, Ingredient, MealType, Recipe, RecipeIngredient, TimingType } from "../types";

const emptyRecipe = {
  name: "",
  meal_type: "breakfast" as MealType,
  suitable_day_types: [] as DayType[],
  suitable_timing: [] as TimingType[],
  preparation_notes: "",
  tags: [] as string[],
  ingredients: [] as RecipeIngredient[],
};

type RecipeSortKey = "name" | "day" | "timing" | "tags" | "kcal" | "protein_g" | "fat_g" | "carbs_g" | "weight";
type SortDirection = "asc" | "desc";

export function Recipes() {
  const api = useApi();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [mealFilter, setMealFilter] = useState("");
  const [textFilter, setTextFilter] = useState("");
  const [sortKey, setSortKey] = useState<RecipeSortKey>("name");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<Recipe | null | "new">(null);

  const load = () => {
    setLoading(true);
    Promise.all([api.getRecipes(mealFilter), api.getIngredients()])
      .then(([recipeRows, ingredientRows]) => {
        setRecipes(recipeRows);
        setIngredients(ingredientRows);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, [mealFilter]);

  const visibleRecipes = useMemo(
    () => sortRecipes(filterRecipes(recipes, textFilter), sortKey, sortDirection),
    [recipes, textFilter, sortKey, sortDirection],
  );

  function updateSort(key: RecipeSortKey) {
    if (sortKey === key) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortDirection("asc");
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-bold uppercase tracking-wide text-mint">Recipes</p>
          <h1 className="mt-1 text-3xl font-black tracking-tight">Recipe library</h1>
        </div>
        <Button icon={<Plus size={18} />} onClick={() => setEditing("new")}>Add recipe</Button>
      </header>

      <Card>
        <div className="grid gap-3 lg:grid-cols-[1fr_220px]">
          <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2">
            <Search size={18} className="text-slate-400" />
            <input
              className="w-full outline-none"
              placeholder="Filter recipes, tags, day type, timing"
              value={textFilter}
              onChange={(event) => setTextFilter(event.target.value)}
            />
          </label>
          <Select value={mealFilter} onChange={(event) => setMealFilter(event.target.value)}>
            <option value="">All meal types</option>
            {mealTypes.map((type) => <option key={type} value={type}>{label(type)}</option>)}
          </Select>
        </div>
      </Card>

      {error && <ErrorState message={error} />}
      {loading ? <LoadingState label="Loading recipes..." /> : visibleRecipes.length === 0 ? (
        <EmptyState title="No recipes match" body="Adjust your filters or create a recipe from your ingredient library." />
      ) : (
        <Card className="p-0">
          <div className="overflow-x-auto">
            <table className="min-w-[1180px] w-full border-collapse text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="w-10 px-3 py-3"></th>
                  <SortableHeader label="Name" active={sortKey === "name"} direction={sortDirection} onClick={() => updateSort("name")} />
                  <SortableHeader label="Suitable day type" active={sortKey === "day"} direction={sortDirection} onClick={() => updateSort("day")} />
                  <SortableHeader label="Suitable timing" active={sortKey === "timing"} direction={sortDirection} onClick={() => updateSort("timing")} />
                  <SortableHeader label="Tags" active={sortKey === "tags"} direction={sortDirection} onClick={() => updateSort("tags")} />
                  <SortableHeader label="kcal" active={sortKey === "kcal"} direction={sortDirection} onClick={() => updateSort("kcal")} align="right" />
                  <SortableHeader label="P" active={sortKey === "protein_g"} direction={sortDirection} onClick={() => updateSort("protein_g")} align="right" />
                  <SortableHeader label="F" active={sortKey === "fat_g"} direction={sortDirection} onClick={() => updateSort("fat_g")} align="right" />
                  <SortableHeader label="C" active={sortKey === "carbs_g"} direction={sortDirection} onClick={() => updateSort("carbs_g")} align="right" />
                  <SortableHeader label="Weight" active={sortKey === "weight"} direction={sortDirection} onClick={() => updateSort("weight")} align="right" />
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visibleRecipes.map((recipe) => {
                  const isExpanded = expanded === recipe.id;
                  return (
                    <Fragment key={recipe.id}>
                      <tr className="cursor-pointer hover:bg-slate-50" onClick={() => setExpanded(isExpanded ? null : recipe.id)}>
                        <td className="px-3 py-3">
                          {isExpanded ? <ChevronDown size={16} className="text-mint" /> : <ChevronRight size={16} className="text-slate-400" />}
                        </td>
                        <td className="px-4 py-3 font-black text-ink">{recipe.name}</td>
                        <td className="px-4 py-3">{recipe.suitable_day_types.map(label).join(", ") || "-"}</td>
                        <td className="px-4 py-3">{recipe.suitable_timing.map(label).join(", ") || "-"}</td>
                        <td className="px-4 py-3">{recipe.tags?.join(", ") || "-"}</td>
                        <td className="px-4 py-3 text-right tabular-nums">{round(recipe.totals.kcal)}</td>
                        <td className="px-4 py-3 text-right tabular-nums">{round(recipe.totals.protein_g)}</td>
                        <td className="px-4 py-3 text-right tabular-nums">{round(recipe.totals.fat_g)}</td>
                        <td className="px-4 py-3 text-right tabular-nums">{round(recipe.totals.carbs_g)}</td>
                        <td className="px-4 py-3 text-right tabular-nums">{round(recipeWeight(recipe))}</td>
                        <td className="px-4 py-3" onClick={(event) => event.stopPropagation()}>
                          <div className="flex justify-end gap-1">
                            <Button aria-label="Edit" variant="ghost" className="h-9 w-9 px-0" icon={<Edit2 size={16} />} onClick={() => setEditing(recipe)} />
                            <Button
                              aria-label="Delete"
                              variant="ghost"
                              className="h-9 w-9 px-0 text-red-600"
                              icon={<Trash2 size={16} />}
                              onClick={async () => {
                                if (!window.confirm(`Delete ${recipe.name}?`)) return;
                                await api.deleteRecipe(recipe.id);
                                load();
                              }}
                            />
                          </div>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr className="bg-slate-50">
                          <td></td>
                          <td colSpan={10} className="px-4 py-4">
                            <div className="grid gap-3 lg:grid-cols-[1fr_260px]">
                              <div>
                                <div className="mb-2 text-xs font-black uppercase tracking-wide text-slate-500">Ingredients</div>
                                <div className="flex flex-wrap gap-2">
                                  {recipe.ingredients.map((item) => (
                                    <span key={item.id || item.ingredient_id} className="rounded-full bg-white px-3 py-1 text-sm font-bold text-slate-700 ring-1 ring-slate-200">
                                      {item.name} · {item.quantity} {item.unit}
                                    </span>
                                  ))}
                                </div>
                                {recipe.preparation_notes && <p className="mt-3 text-sm text-slate-600">{recipe.preparation_notes}</p>}
                              </div>
                              <MacroBadges totals={recipe.totals} />
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {editing && (
        <RecipeModal
          recipe={editing === "new" ? null : editing}
          ingredients={ingredients}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
          }}
        />
      )}
    </div>
  );
}

function SortableHeader({
  label,
  active,
  direction,
  align = "left",
  onClick,
}: {
  label: string;
  active: boolean;
  direction: SortDirection;
  align?: "left" | "right";
  onClick: () => void;
}) {
  return (
    <th className={`px-4 py-3 ${align === "right" ? "text-right" : "text-left"}`}>
      <button className="inline-flex items-center gap-1 font-black hover:text-ink" onClick={onClick} type="button">
        {label}
        <span className={active ? "text-mint" : "text-slate-300"}>{active ? (direction === "asc" ? "↑" : "↓") : "↕"}</span>
      </button>
    </th>
  );
}

function RecipeModal({
  recipe,
  ingredients,
  onClose,
  onSaved,
}: {
  recipe: Recipe | null;
  ingredients: Ingredient[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const api = useApi();
  const [form, setForm] = useState(recipe ? normalizeRecipe(recipe) : emptyRecipe);
  const [tagText, setTagText] = useState(recipe?.tags?.join(", ") || "");
  const [ingredientSearch, setIngredientSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const filteredIngredients = useMemo(
    () => ingredients.filter((ingredient) => wildcardMatch(ingredient.name, ingredientSearch)),
    [ingredients, ingredientSearch],
  );

  const totals = useMemo(
    () => formatTotals(calculateRecipeTotals(form.ingredients, ingredients)),
    [form.ingredients, ingredients],
  );

  const update = (key: string, value: unknown) => setForm((current) => ({ ...current, [key]: value }));

  function toggleArray<T extends string>(key: "suitable_day_types" | "suitable_timing", value: T) {
    setForm((current) => {
      const values = current[key] as T[];
      return { ...current, [key]: values.includes(value) ? values.filter((item) => item !== value) : [...values, value] };
    });
  }

  function addRecipeIngredient() {
    const ingredient = filteredIngredients[0] ?? ingredients[0];
    if (!ingredient) {
      setError("Add at least one ingredient before creating recipes.");
      return;
    }
    setForm((current) => ({
      ...current,
      ingredients: [...current.ingredients, { ingredient_id: ingredient.id, quantity: ingredient.default_quantity, unit: ingredient.unit }],
    }));
  }

  function updateRecipeIngredient(index: number, patch: Partial<RecipeIngredient>) {
    setForm((current) => ({
      ...current,
      ingredients: current.ingredients.map((item, itemIndex) => {
        if (itemIndex !== index) return item;
        const next = { ...item, ...patch };
        if (patch.ingredient_id) {
          const ingredient = ingredients.find((candidate) => candidate.id === patch.ingredient_id);
          if (ingredient) next.unit = ingredient.unit;
        }
        return next;
      }),
    }));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    const payload = {
      ...form,
      name: form.name.trim(),
      preparation_notes: form.preparation_notes?.trim() || null,
      tags: tagText.split(",").map((tag) => tag.trim()).filter(Boolean),
      ingredients: form.ingredients.map((item) => ({
        ingredient_id: item.ingredient_id,
        quantity: Number(item.quantity),
        unit: item.unit.trim(),
      })),
    };
    if (!payload.name || payload.ingredients.some((item) => !item.ingredient_id || item.quantity <= 0 || !item.unit)) {
      setError("Recipe name and valid ingredient rows are required.");
      setSaving(false);
      return;
    }
    try {
      if (recipe) await api.updateRecipe(recipe.id, payload);
      else await api.createRecipe(payload);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save recipe.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title={recipe ? "Edit recipe" : "Add recipe"} onClose={onClose}>
      <form className="space-y-4" onSubmit={submit}>
        {error && <ErrorState message={error} />}
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Name"><Input value={form.name} onChange={(e) => update("name", e.target.value)} required /></Field>
          <Field label="Meal type">
            <Select value={form.meal_type} onChange={(e) => update("meal_type", e.target.value as MealType)}>
              {mealTypes.map((type) => <option key={type} value={type}>{label(type)}</option>)}
            </Select>
          </Field>
        </div>

        <CheckboxGroup labelText="Suitable day types" values={dayTypes} selected={form.suitable_day_types} onToggle={(value) => toggleArray("suitable_day_types", value)} />
        <CheckboxGroup labelText="Suitable timing" values={timingTypes} selected={form.suitable_timing} onToggle={(value) => toggleArray("suitable_timing", value)} />

        <Field label="Tags"><Input value={tagText} onChange={(e) => setTagText(e.target.value)} placeholder="quick, meal-prep" /></Field>
        <Field label="Preparation notes"><Textarea rows={3} value={form.preparation_notes ?? ""} onChange={(e) => update("preparation_notes", e.target.value)} /></Field>

        <Card className="shadow-none">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex-1">
              <Field label="Filter ingredients">
                <Input
                  value={ingredientSearch}
                  onChange={(event) => setIngredientSearch(event.target.value)}
                  placeholder="Type oats or *milk"
                />
              </Field>
            </div>
            <Button type="button" variant="secondary" icon={<Plus size={16} />} onClick={addRecipeIngredient}>Add row</Button>
          </div>
          <div className="mt-3 space-y-3">
            {form.ingredients.length === 0 && <p className="text-sm text-slate-500">No ingredients added.</p>}
            {form.ingredients.map((item, index) => (
              <div key={index} className="grid gap-2 rounded-lg bg-slate-50 p-3 sm:grid-cols-[1fr_110px_100px_40px]">
                <Select value={item.ingredient_id} onChange={(e) => updateRecipeIngredient(index, { ingredient_id: e.target.value })}>
                  {ingredients.map((ingredient) => <option key={ingredient.id} value={ingredient.id}>{ingredient.name}</option>)}
                </Select>
                <Input type="number" min="0.01" step="0.01" value={item.quantity} onChange={(e) => updateRecipeIngredient(index, { quantity: Number(e.target.value) })} />
                <Input value={item.unit} onChange={(e) => updateRecipeIngredient(index, { unit: e.target.value })} />
                <Button
                  aria-label="Remove"
                  type="button"
                  variant="ghost"
                  className="h-10 w-10 px-0 text-red-600"
                  icon={<X size={16} />}
                  onClick={() => update("ingredients", form.ingredients.filter((_, itemIndex) => itemIndex !== index))}
                />
              </div>
            ))}
          </div>
          <div className="mt-4"><MacroBadges totals={totals} /></div>
        </Card>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={saving}>{saving ? "Saving..." : "Save"}</Button>
        </div>
      </form>
    </Modal>
  );
}

function CheckboxGroup<T extends string>({
  labelText,
  values,
  selected,
  onToggle,
}: {
  labelText: string;
  values: readonly T[];
  selected: T[];
  onToggle: (value: T) => void;
}) {
  return (
    <div>
      <div className="mb-2 text-sm font-bold text-slate-700">{labelText}</div>
      <div className="flex flex-wrap gap-2">
        {values.map((value) => (
          <label key={value} className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-bold">
            <input type="checkbox" checked={selected.includes(value)} onChange={() => onToggle(value)} />
            {label(value)}
          </label>
        ))}
      </div>
    </div>
  );
}

function normalizeRecipe(recipe: Recipe) {
  return {
    name: recipe.name,
    meal_type: recipe.meal_type,
    suitable_day_types: recipe.suitable_day_types,
    suitable_timing: recipe.suitable_timing,
    preparation_notes: recipe.preparation_notes ?? "",
    tags: recipe.tags ?? [],
    ingredients: recipe.ingredients.map((item) => ({
      ingredient_id: item.ingredient_id,
      quantity: Number(item.quantity),
      unit: item.unit,
    })),
  };
}

function filterRecipes(recipes: Recipe[], filter: string) {
  const query = filter.trim().toLowerCase();
  if (!query) return recipes;
  return recipes.filter((recipe) =>
    [
      recipe.name,
      recipe.suitable_day_types.map(label).join(" "),
      recipe.suitable_timing.map(label).join(" "),
      recipe.tags?.join(" ") ?? "",
      recipe.meal_type,
    ].some((value) => value.toLowerCase().includes(query)),
  );
}

function sortRecipes(recipes: Recipe[], key: RecipeSortKey, direction: SortDirection) {
  return [...recipes].sort((a, b) => {
    const result = recipeSortValue(a, key).localeCompare(recipeSortValue(b, key), undefined, { numeric: true });
    return direction === "asc" ? result : -result;
  });
}

function recipeSortValue(recipe: Recipe, key: RecipeSortKey) {
  if (key === "day") return recipe.suitable_day_types.map(label).join(", ");
  if (key === "timing") return recipe.suitable_timing.map(label).join(", ");
  if (key === "tags") return recipe.tags?.join(", ") ?? "";
  if (key === "weight") return String(recipeWeight(recipe));
  if (key === "kcal") return String(recipe.totals.kcal);
  if (key === "protein_g") return String(recipe.totals.protein_g);
  if (key === "fat_g") return String(recipe.totals.fat_g);
  if (key === "carbs_g") return String(recipe.totals.carbs_g);
  return recipe.name;
}

function recipeWeight(recipe: Recipe) {
  return recipe.ingredients.reduce((total, item) => total + Number(item.quantity || 0), 0);
}

function wildcardMatch(value: string, query: string) {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return true;
  const escaped = trimmed.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
  return new RegExp(escaped).test(value.toLowerCase());
}

function round(value: number) {
  return Math.round(Number(value) * 10) / 10;
}
