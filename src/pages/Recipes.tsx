import { Edit2, Plus, Trash2, X } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
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

export function Recipes() {
  const api = useApi();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [filter, setFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<Recipe | null | "new">(null);

  const load = () => {
    setLoading(true);
    Promise.all([api.getRecipes(filter), api.getIngredients()])
      .then(([recipeRows, ingredientRows]) => {
        setRecipes(recipeRows);
        setIngredients(ingredientRows);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, [filter]);

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
        <Field label="Filter by meal type">
          <Select value={filter} onChange={(event) => setFilter(event.target.value)}>
            <option value="">All meals</option>
            {mealTypes.map((type) => <option key={type} value={type}>{label(type)}</option>)}
          </Select>
        </Field>
      </Card>

      {error && <ErrorState message={error} />}
      {loading ? <LoadingState label="Loading recipes..." /> : recipes.length === 0 ? (
        <EmptyState title="No recipes yet" body="Create recipes from your ingredient library." />
      ) : (
        <div className="grid gap-3">
          {recipes.map((recipe) => (
            <RecipeCard
              key={recipe.id}
              recipe={recipe}
              onEdit={() => setEditing(recipe)}
              onDelete={async () => {
                if (!window.confirm(`Delete ${recipe.name}?`)) return;
                await api.deleteRecipe(recipe.id);
                load();
              }}
            />
          ))}
        </div>
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

function RecipeCard({ recipe, onEdit, onDelete }: { recipe: Recipe; onEdit: () => void; onDelete: () => void }) {
  return (
    <Card>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="text-xs font-black uppercase tracking-wide text-mint">{label(recipe.meal_type)}</div>
          <h2 className="mt-1 text-xl font-black">{recipe.name}</h2>
          <div className="mt-2 flex flex-wrap gap-2">
            {recipe.tags?.map((tag) => <span key={tag} className="rounded-full bg-slate-100 px-2 py-1 text-xs font-bold text-slate-600">{tag}</span>)}
          </div>
        </div>
        <div className="flex gap-1">
          <Button aria-label="Edit" variant="ghost" className="h-9 w-9 px-0" icon={<Edit2 size={16} />} onClick={onEdit} />
          <Button aria-label="Delete" variant="ghost" className="h-9 w-9 px-0 text-red-600" icon={<Trash2 size={16} />} onClick={onDelete} />
        </div>
      </div>
      <div className="mt-4"><MacroBadges totals={recipe.totals} /></div>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {recipe.ingredients.map((item) => (
          <div key={item.id || item.ingredient_id} className="rounded-lg bg-slate-50 px-3 py-2 text-sm">
            <span className="font-bold">{item.name}</span> · {item.quantity} {item.unit}
          </div>
        ))}
      </div>
      {recipe.preparation_notes && <p className="mt-3 text-sm text-slate-500">{recipe.preparation_notes}</p>}
    </Card>
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
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

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
    if (!ingredients[0]) {
      setError("Add at least one ingredient before creating recipes.");
      return;
    }
    setForm((current) => ({
      ...current,
      ingredients: [...current.ingredients, { ingredient_id: ingredients[0].id, quantity: ingredients[0].default_quantity, unit: ingredients[0].unit }],
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
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-black">Recipe ingredients</h3>
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
