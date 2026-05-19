import { AlertTriangle, Brain, Check, RefreshCw, X } from "lucide-react";
import { useState } from "react";
import { Button } from "./Button";
import { Card } from "./Card";
import { ErrorState } from "./State";
import { useApi } from "../hooks/useApi";
import type { AiNutritionCoachInput, AiNutritionCoachSuggestion } from "../types";

export function AiNutritionCoachPanel({
  input,
  canGenerate,
  onApplyTargets,
}: {
  input: AiNutritionCoachInput;
  canGenerate: boolean;
  onApplyTargets: (suggestion: AiNutritionCoachSuggestion) => Promise<void>;
}) {
  const api = useApi();
  const [suggestion, setSuggestion] = useState<AiNutritionCoachSuggestion | null>(null);
  const [model, setModel] = useState("");
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState("");

  async function generate() {
    setLoading(true);
    setError("");
    try {
      const response = await api.getAiNutritionCoachSuggestion(input);
      setSuggestion(response.suggestion);
      setModel(response.model);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not generate AI coach suggestion.");
    } finally {
      setLoading(false);
    }
  }

  async function applyTargets() {
    if (!suggestion) return;
    setApplying(true);
    setError("");
    try {
      await onApplyTargets(suggestion);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not apply suggested targets.");
    } finally {
      setApplying(false);
    }
  }

  return (
    <Card className="border-slate-300 bg-white">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-black uppercase tracking-wide text-slate-700">
            <Brain size={14} /> AI Coach Suggestion
          </div>
          <h2 className="mt-3 text-xl font-black">Advisory nutrition check</h2>
          <p className="mt-1 text-sm font-semibold text-slate-500">
            Gemini can propose adjustments, but FuelSync keeps you in control. Nothing is saved unless you apply it.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" icon={<RefreshCw />} onClick={generate} disabled={!canGenerate || loading}>
            {loading ? "Generating..." : "Generate AI suggestion"}
          </Button>
          {suggestion && (
            <Button variant="ghost" icon={<X />} onClick={() => setSuggestion(null)}>
              Dismiss
            </Button>
          )}
        </div>
      </div>

      {!canGenerate && (
        <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm font-semibold text-amber-800">
          Add macro targets and at least one recipe before asking the AI coach for a useful suggestion.
        </p>
      )}
      {error && <div className="mt-4"><ErrorState message={error} /></div>}

      {suggestion && (
        <div className="mt-5 space-y-4">
          <div className="rounded-lg bg-slate-50 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="font-black">{suggestion.summary}</div>
              <span className="rounded-full bg-white px-3 py-1 text-xs font-black uppercase text-slate-600 ring-1 ring-slate-200">
                {suggestion.confidence} confidence
              </span>
            </div>
            {model && <p className="mt-2 text-xs font-semibold text-slate-500">Model: {model}</p>}
          </div>

          <div className="grid gap-3 sm:grid-cols-4">
            <MacroSuggestion label="Calories" value={suggestion.macroSuggestion.calories} delta={suggestion.macroDelta.calories} unit="kcal" />
            <MacroSuggestion label="Protein" value={suggestion.macroSuggestion.protein} delta={suggestion.macroDelta.protein} unit="g" />
            <MacroSuggestion label="Carbs" value={suggestion.macroSuggestion.carbs} delta={suggestion.macroDelta.carbs} unit="g" />
            <MacroSuggestion label="Fat" value={suggestion.macroSuggestion.fat} delta={suggestion.macroDelta.fat} unit="g" />
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <InfoBlock
              title="Meal timing advice"
              items={[
                ["Pre-workout", suggestion.mealTimingAdvice.preWorkout],
                ["Intra-workout", suggestion.mealTimingAdvice.intraWorkout],
                ["Post-workout", suggestion.mealTimingAdvice.postWorkout],
                ["General", suggestion.mealTimingAdvice.general],
              ]}
            />
            <InfoBlock title="Reasoning" items={suggestion.reasoning.map((item, index) => [`${index + 1}`, item])} />
          </div>

          {suggestion.mealSuggestions.length > 0 && (
            <div>
              <div className="mb-2 font-black">Meal suggestions</div>
              <div className="grid gap-2 sm:grid-cols-2">
                {suggestion.mealSuggestions.map((meal) => (
                  <div key={`${meal.mealType}-${meal.recipeId ?? meal.recipeName}`} className="rounded-lg border border-slate-200 bg-white p-3 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-black capitalize">{meal.mealType}</span>
                      <span className="text-xs font-black text-mint">{Math.round(meal.fitScore)}/100</span>
                    </div>
                    <div className="mt-1 font-semibold">{meal.recipeName}</div>
                    <p className="mt-1 text-slate-500">{meal.reason}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {suggestion.warnings.length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-900">
              <div className="mb-2 flex items-center gap-2 font-black"><AlertTriangle size={16} /> Warnings</div>
              <ul className="space-y-1">
                {suggestion.warnings.map((warning) => <li key={warning}>{warning}</li>)}
              </ul>
            </div>
          )}

          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button variant="secondary" onClick={() => setSuggestion(null)}>Dismiss</Button>
            <Button icon={<Check />} onClick={applyTargets} disabled={applying}>
              {applying ? "Applying..." : "Apply suggested targets"}
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}

function MacroSuggestion({ label, value, delta, unit }: { label: string; value: number; delta: number; unit: string }) {
  const deltaPrefix = delta > 0 ? "+" : "";
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <div className="text-xs font-black uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 text-xl font-black">{Math.round(value)} {unit}</div>
      <div className={`mt-1 text-sm font-bold ${delta === 0 ? "text-slate-500" : delta > 0 ? "text-mint" : "text-coral"}`}>
        {deltaPrefix}{Math.round(delta)} {unit}
      </div>
    </div>
  );
}

function InfoBlock({ title, items }: { title: string; items: Array<[string, string | null]> }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <div className="mb-2 font-black">{title}</div>
      <div className="space-y-2 text-sm">
        {items.filter(([, value]) => value).map(([label, value]) => (
          <div key={`${label}-${value}`}>
            <span className="font-black text-slate-700">{label}: </span>
            <span className="text-slate-600">{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
