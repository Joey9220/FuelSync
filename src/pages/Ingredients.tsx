import { Edit2, Plus, Search, Trash2 } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { Field, Input, Textarea } from "../components/FormField";
import { MacroBadges } from "../components/MacroBadges";
import { Modal } from "../components/Modal";
import { EmptyState, ErrorState, LoadingState } from "../components/State";
import { useApi } from "../hooks/useApi";
import type { Ingredient } from "../types";

const emptyForm = {
  name: "",
  default_quantity: 100,
  unit: "g",
  kcal: 0,
  protein_g: 0,
  carbs_g: 0,
  fat_g: 0,
  notes: "",
};

export function Ingredients() {
  const api = useApi();
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<Ingredient | null | "new">(null);

  const load = () => {
    setLoading(true);
    api.getIngredients(search).then(setIngredients).catch((err) => setError(err.message)).finally(() => setLoading(false));
  };

  useEffect(() => {
    const handle = window.setTimeout(load, 250);
    return () => window.clearTimeout(handle);
  }, [search]);

  return (
    <div className="space-y-5">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-bold uppercase tracking-wide text-mint">Ingredients</p>
          <h1 className="mt-1 text-3xl font-black tracking-tight">Ingredient library</h1>
        </div>
        <Button icon={<Plus size={18} />} onClick={() => setEditing("new")}>Add ingredient</Button>
      </header>

      <Card>
        <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2">
          <Search size={18} className="text-slate-400" />
          <input
            className="w-full outline-none"
            placeholder="Search by name"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
      </Card>

      {error && <ErrorState message={error} />}
      {loading ? <LoadingState label="Loading ingredients..." /> : ingredients.length === 0 ? (
        <EmptyState title="No ingredients yet" body="Add your first ingredient to start building recipes." />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {ingredients.map((ingredient) => (
            <IngredientCard
              key={ingredient.id}
              ingredient={ingredient}
              onEdit={() => setEditing(ingredient)}
              onDelete={async () => {
                if (!window.confirm(`Delete ${ingredient.name}?`)) return;
                await api.deleteIngredient(ingredient.id);
                load();
              }}
            />
          ))}
        </div>
      )}

      {editing && (
        <IngredientModal
          ingredient={editing === "new" ? null : editing}
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

function IngredientCard({ ingredient, onEdit, onDelete }: { ingredient: Ingredient; onEdit: () => void; onDelete: () => void }) {
  const totals = useMemo(
    () => ({
      kcal: Number(ingredient.kcal),
      protein_g: Number(ingredient.protein_g),
      carbs_g: Number(ingredient.carbs_g),
      fat_g: Number(ingredient.fat_g),
    }),
    [ingredient],
  );

  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-black">{ingredient.name}</h2>
          <p className="text-sm text-slate-500">per {ingredient.default_quantity} {ingredient.unit}</p>
        </div>
        <div className="flex gap-1">
          <Button aria-label="Edit" variant="ghost" className="h-9 w-9 px-0" icon={<Edit2 size={16} />} onClick={onEdit} />
          <Button aria-label="Delete" variant="ghost" className="h-9 w-9 px-0 text-red-600" icon={<Trash2 size={16} />} onClick={onDelete} />
        </div>
      </div>
      <div className="mt-3"><MacroBadges totals={totals} /></div>
      {ingredient.notes && <p className="mt-3 text-sm text-slate-500">{ingredient.notes}</p>}
    </Card>
  );
}

function IngredientModal({ ingredient, onClose, onSaved }: { ingredient: Ingredient | null; onClose: () => void; onSaved: () => void }) {
  const api = useApi();
  const [form, setForm] = useState(ingredient ?? emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const update = (key: string, value: string | number) => setForm((current) => ({ ...current, [key]: value }));

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    const payload = {
      name: form.name.trim(),
      default_quantity: Number(form.default_quantity),
      unit: form.unit.trim(),
      kcal: Number(form.kcal),
      protein_g: Number(form.protein_g),
      carbs_g: Number(form.carbs_g),
      fat_g: Number(form.fat_g),
      notes: form.notes?.trim() || null,
    };
    if (!payload.name || !payload.unit || payload.default_quantity <= 0) {
      setError("Name, unit and a positive default quantity are required.");
      setSaving(false);
      return;
    }
    try {
      if (ingredient) await api.updateIngredient(ingredient.id, payload);
      else await api.createIngredient(payload);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save ingredient.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title={ingredient ? "Edit ingredient" : "Add ingredient"} onClose={onClose}>
      <form className="space-y-4" onSubmit={submit}>
        {error && <ErrorState message={error} />}
        <Field label="Name"><Input value={form.name} onChange={(e) => update("name", e.target.value)} required /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Default quantity"><Input type="number" min="0.01" step="0.01" value={form.default_quantity} onChange={(e) => update("default_quantity", e.target.value)} required /></Field>
          <Field label="Unit"><Input value={form.unit} onChange={(e) => update("unit", e.target.value)} required /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Field label="kcal"><Input type="number" min="0" step="0.1" value={form.kcal} onChange={(e) => update("kcal", e.target.value)} required /></Field>
          <Field label="Protein"><Input type="number" min="0" step="0.1" value={form.protein_g} onChange={(e) => update("protein_g", e.target.value)} required /></Field>
          <Field label="Carbs"><Input type="number" min="0" step="0.1" value={form.carbs_g} onChange={(e) => update("carbs_g", e.target.value)} required /></Field>
          <Field label="Fat"><Input type="number" min="0" step="0.1" value={form.fat_g} onChange={(e) => update("fat_g", e.target.value)} required /></Field>
        </div>
        <Field label="Notes"><Textarea rows={3} value={form.notes ?? ""} onChange={(e) => update("notes", e.target.value)} /></Field>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={saving}>{saving ? "Saving..." : "Save"}</Button>
        </div>
      </form>
    </Modal>
  );
}
