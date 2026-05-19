import { ChevronLeft, ChevronRight, Edit2, Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { ActivityFormModal } from "../components/ActivityFormModal";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { MacroBadges } from "../components/MacroBadges";
import { ProgressBar } from "../components/ProgressBar";
import { ErrorState, LoadingState } from "../components/State";
import { addMacroTotals } from "../lib/calculations";
import { label } from "../lib/constants";
import { addDays, formatDayName, formatShortDate, normalizeDateKey, toDateKey, weekDays } from "../lib/date";
import { useApi } from "../hooks/useApi";
import { determineDayType } from "../services/dayPriority";
import type { Activity, DailyMealSelection, MacroTarget, MacroTotals, Recipe, TargetGoal } from "../types";

export function Planner() {
  const api = useApi();
  const [anchor, setAnchor] = useState(new Date());
  const [activities, setActivities] = useState<Activity[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [mealSelectionsByDate, setMealSelectionsByDate] = useState<Record<string, DailyMealSelection[]>>({});
  const [targets, setTargets] = useState<MacroTarget[]>([]);
  const [targetGoal, setTargetGoal] = useState<TargetGoal>("maintenance");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<Activity | null | "new">(null);
  const [newDate, setNewDate] = useState<string | undefined>();

  const days = useMemo(() => weekDays(anchor), [anchor]);
  const from = toDateKey(days[0]);
  const to = toDateKey(days[6]);

  const load = () => {
    setLoading(true);
    const dateKeys = days.map(toDateKey);
    Promise.all([
      api.getActivities({ from, to }),
      api.getRecipes(),
      api.getUserPreferences(),
      Promise.all(dateKeys.map((date) => api.getMealSelections(date).then((selections) => [date, selections] as const))),
    ])
      .then(async ([activityRows, recipeRows, preferences, selectionEntries]) => {
        const targetRows = await api.getMacroTargets(preferences.target_goal);
        setActivities(activityRows);
        setRecipes(recipeRows);
        setTargetGoal(preferences.target_goal);
        setTargets(targetRows);
        setMealSelectionsByDate(Object.fromEntries(selectionEntries));
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, [from, to]);

  function addForDate(date: string) {
    setNewDate(date);
    setEditing("new");
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-bold uppercase tracking-wide text-mint">Planner</p>
          <h1 className="mt-1 text-3xl font-black tracking-tight">Training week</h1>
          <p className="mt-1 text-sm text-slate-500">
            {formatShortDate(from)} to {formatShortDate(to)}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            className="h-11 w-11 px-0"
            icon={<ChevronLeft size={18} />}
            onClick={() => setAnchor(addDays(anchor, -7))}
            aria-label="Previous week"
          />
          <Button
            variant="secondary"
            className="h-11 w-11 px-0"
            icon={<ChevronRight size={18} />}
            onClick={() => setAnchor(addDays(anchor, 7))}
            aria-label="Next week"
          />
          <Button icon={<Plus size={18} />} onClick={() => addForDate(toDateKey(new Date()))}>
            Activity
          </Button>
        </div>
      </header>

      {error && <ErrorState message={error} />}
      {loading ? (
        <LoadingState label="Loading planner..." />
      ) : (
        <div className="overflow-x-auto pb-2">
          <div className="grid min-w-[1120px] grid-cols-7 gap-3 md:min-w-0">
            {days.map((day) => {
              const dateKey = toDateKey(day);
              const dayActivities = activities.filter((activity) => normalizeDateKey(activity.date) === dateKey);
              const dayType = determineDayType(dayActivities);
              const selectedRecipes = (mealSelectionsByDate[dateKey] ?? [])
                .map((selection) => recipes.find((recipe) => recipe.id === selection.selected_recipe_id))
                .filter((recipe): recipe is Recipe => Boolean(recipe));
              const ingested = addMacroTotals(selectedRecipes.map((recipe) => recipe.totals));
              const target = targets.find((item) => item.day_type === dayType);
              return (
                <Card key={dateKey} className="flex min-h-[420px] flex-col p-0">
                  <div className="border-b border-slate-100 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="text-xs font-black uppercase tracking-wide text-mint">{formatDayName(day)}</div>
                        <h2 className="mt-1 text-lg font-black">{formatShortDate(dateKey)}</h2>
                      </div>
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-black text-slate-700">
                        {dayActivities.length}
                      </span>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-800">
                        {label(dayType)}
                      </span>
                      <Button
                        variant="secondary"
                        className="min-h-9 px-3 py-1.5 text-xs"
                        icon={<Plus size={14} />}
                        onClick={() => addForDate(dateKey)}
                      >
                        Add
                      </Button>
                    </div>
                  </div>

                  <div className="flex-1 space-y-3 p-4">
                    <MacroPlannerBlock ingested={ingested} target={target} targetGoal={targetGoal} />
                    {dayActivities.length === 0 ? (
                      <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                        Rest day by default. Add a workout to update suggestions.
                      </div>
                    ) : (
                      dayActivities.map((activity) => (
                        <ActivityBlock
                          key={activity.id}
                          activity={activity}
                          onEdit={() => setEditing(activity)}
                          onDelete={async () => {
                            await api.deleteActivity(activity.id);
                            setActivities((current) => current.filter((item) => item.id !== activity.id));
                          }}
                        />
                      ))
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {editing && (
        <ActivityFormModal
          activity={editing === "new" ? null : editing}
          date={newDate}
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

function ActivityBlock({
  activity,
  onEdit,
  onDelete,
}: {
  activity: Activity;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="font-black text-ink">{label(activity.activity_type)}</div>
          <div className="mt-1 text-xs font-semibold text-slate-500">
            {activity.start_time?.slice(0, 5) || "Any time"} · {activity.duration_minutes ?? "-"} min
          </div>
        </div>
        <div className="flex gap-1">
          <Button variant="secondary" className="h-9 w-9 px-0" icon={<Edit2 size={14} />} onClick={onEdit} aria-label="Edit activity" />
          <Button
            variant="secondary"
            className="h-9 w-9 px-0 text-red-600 hover:bg-red-50"
            icon={<Trash2 size={14} />}
            onClick={onDelete}
            aria-label="Delete activity"
          />
        </div>
      </div>
      {(activity.intensity || activity.notes) && (
        <div className="mt-3 space-y-2">
          {activity.intensity && (
            <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-black text-slate-700">
              {label(activity.intensity)}
            </span>
          )}
          {activity.notes && <p className="text-sm text-slate-600">{activity.notes}</p>}
        </div>
      )}
    </article>
  );
}

function MacroPlannerBlock({
  ingested,
  target,
  targetGoal,
}: {
  ingested: MacroTotals;
  target: MacroTarget | undefined;
  targetGoal: TargetGoal;
}) {
  return (
    <div className="rounded-lg border border-emerald-100 bg-emerald-50/40 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div>
          <div className="text-xs font-black uppercase tracking-wide text-slate-500">Macros</div>
          <div className="text-[11px] font-bold text-slate-500">{label(targetGoal)}</div>
        </div>
        <div className="text-right text-xs font-black text-slate-700">
          {Math.round(ingested.kcal)} / {target?.kcal_max ?? "-"} kcal
        </div>
      </div>
      <MacroBadges totals={ingested} />
      <div className="mt-3 space-y-2">
        <ProgressBar label="kcal" value={ingested.kcal} target={target?.kcal_max} />
        <ProgressBar label="P" value={ingested.protein_g} target={target?.protein_min} />
        <ProgressBar label="C" value={ingested.carbs_g} target={target?.carbs_max} />
        <ProgressBar label="F" value={ingested.fat_g} target={target?.fat_max} />
      </div>
    </div>
  );
}
