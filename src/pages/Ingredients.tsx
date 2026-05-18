import { Edit2, Plus, Search, Trash2 } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { Field, Input, Textarea } from "../components/FormField";
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

type IngredientSortKey = "name" | "kcal" | "protein_g" | "fat_g" | "carbs_g" | "default_quantity" | "unit";
type SortDirection = "asc" | "desc";

export function Ingredients() {
  const api = useApi();
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<IngredientSortKey>("name");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
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

  const sortedIngredients = useMemo(
    () => sortRows(ingredients, sortKey, sortDirection),
    [ingredients, sortKey, sortDirection],
  );

  function updateSort(key: IngredientSortKey) {
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
            placeholder="Filter ingredients by name"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
      </Card>

      {error && <ErrorState message={error} />}
      {loading ? <LoadingState label="Loading ingredients..." /> : sortedIngredients.length === 0 ? (
        <EmptyState title="No ingredients yet" body="Add your first ingredient to start building recipes." />
      ) : (
        <Card className="p-0">
          <div className="overflow-x-auto">
            <table className="min-w-[840px] w-full border-collapse text-left text-xs">
              <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                <tr>
                  <SortableHeader label="Name" active={sortKey === "name"} direction={sortDirection} onClick={() => updateSort("name")} />
                  <SortableHeader label="kcal" active={sortKey === "kcal"} direction={sortDirection} onClick={() => updateSort("kcal")} align="right" />
                  <SortableHeader label="P" active={sortKey === "protein_g"} direction={sortDirection} onClick={() => updateSort("protein_g")} align="right" />
                  <SortableHeader label="F" active={sortKey === "fat_g"} direction={sortDirection} onClick={() => updateSort("fat_g")} align="right" />
                  <SortableHeader label="C" active={sortKey === "carbs_g"} direction={sortDirection} onClick={() => updateSort("carbs_g")} align="right" />
                  <SortableHeader label="Default qty" active={sortKey === "default_quantity"} direction={sortDirection} onClick={() => updateSort("default_quantity")} align="right" />
                  <SortableHeader label="Unit" active={sortKey === "unit"} direction={sortDirection} onClick={() => updateSort("unit")} />
                  <th className="border border-slate-200 px-3 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sortedIngredients.map((ingredient) => (
                  <tr key={ingredient.id} className="hover:bg-slate-50">
                    <td className="border border-slate-200 px-3 py-2 font-black text-ink">{ingredient.name}</td>
                    <td className="border border-slate-200 px-3 py-2 text-right tabular-nums">{round(ingredient.kcal)}</td>
                    <td className="border border-slate-200 px-3 py-2 text-right tabular-nums">{round(ingredient.protein_g)}</td>
                    <td className="border border-slate-200 px-3 py-2 text-right tabular-nums">{round(ingredient.fat_g)}</td>
                    <td className="border border-slate-200 px-3 py-2 text-right tabular-nums">{round(ingredient.carbs_g)}</td>
                    <td className="border border-slate-200 px-3 py-2 text-right tabular-nums">{round(ingredient.default_quantity)}</td>
                    <td className="border border-slate-200 px-3 py-2">{ingredient.unit}</td>
                    <td className="border border-slate-200 px-3 py-2">
                      <div className="flex justify-end gap-1">
                        <Button aria-label="Edit" variant="ghost" className="h-9 w-9 px-0" icon={<Edit2 size={16} />} onClick={() => setEditing(ingredient)} />
                        <Button
                          aria-label="Delete"
                          variant="ghost"
                          className="h-9 w-9 px-0 text-red-600"
                          icon={<Trash2 size={16} />}
                          onClick={async () => {
                            if (!window.confirm(`Delete ${ingredient.name}?`)) return;
                            await api.deleteIngredient(ingredient.id);
                            load();
                          }}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
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
    <th className={`border border-slate-200 px-3 py-2 ${align === "right" ? "text-right" : "text-left"}`}>
      <button className="inline-flex items-center gap-1 font-black hover:text-ink" onClick={onClick} type="button">
        {label}
        <span className={active ? "text-mint" : "text-slate-300"}>{active ? (direction === "asc" ? "↑" : "↓") : "↕"}</span>
      </button>
    </th>
  );
}

function sortRows(rows: Ingredient[], key: IngredientSortKey, direction: SortDirection) {
  return [...rows].sort((a, b) => {
    const aValue = a[key];
    const bValue = b[key];
    const result = typeof aValue === "string"
      ? aValue.localeCompare(String(bValue))
      : Number(aValue) - Number(bValue);
    return direction === "asc" ? result : -result;
  });
}

function round(value: number) {
  return Math.round(Number(value) * 10) / 10;
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
