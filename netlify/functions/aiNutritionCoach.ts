// @ts-nocheck
import { requireAuth } from "./_shared/auth";
import { db } from "./_shared/db";
import { fail, ok } from "./_shared/http";

const model = "gemini-2.5-flash";
const geminiApiVersion = "v1beta";
const Type = {
  OBJECT: "OBJECT",
  ARRAY: "ARRAY",
  STRING: "STRING",
  NUMBER: "NUMBER",
};
const goals = ["body_recomp", "fat_loss", "maintenance", "cut", "lean_bulk"];
const dayTypes = ["rest", "gym", "endurance_bike", "interval_bike", "mixed"];
const mealTypes = ["breakfast", "lunch", "dinner", "snack"];
const confidences = ["low", "medium", "high"];
const maxBodyBytes = 24000;
const maxOutputTokens = 4096;

const responseSchema = {
  type: Type.OBJECT,
  properties: {
    summary: { type: Type.STRING },
    macroSuggestion: {
      type: Type.OBJECT,
      properties: {
        calories: { type: Type.NUMBER },
        protein: { type: Type.NUMBER },
        carbs: { type: Type.NUMBER },
        fat: { type: Type.NUMBER },
      },
      required: ["calories", "protein", "carbs", "fat"],
    },
    macroDelta: {
      type: Type.OBJECT,
      properties: {
        calories: { type: Type.NUMBER },
        protein: { type: Type.NUMBER },
        carbs: { type: Type.NUMBER },
        fat: { type: Type.NUMBER },
      },
      required: ["calories", "protein", "carbs", "fat"],
    },
    mealTimingAdvice: {
      type: Type.OBJECT,
      properties: {
        preWorkout: { type: Type.STRING, nullable: true },
        intraWorkout: { type: Type.STRING, nullable: true },
        postWorkout: { type: Type.STRING, nullable: true },
        general: { type: Type.STRING },
      },
      required: ["preWorkout", "intraWorkout", "postWorkout", "general"],
    },
    mealSuggestions: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          mealType: { type: Type.STRING, enum: mealTypes },
          recipeId: { type: Type.STRING, nullable: true },
          recipeName: { type: Type.STRING },
          reason: { type: Type.STRING },
          fitScore: { type: Type.NUMBER },
        },
        required: ["mealType", "recipeId", "recipeName", "reason", "fitScore"],
      },
    },
    warnings: { type: Type.ARRAY, items: { type: Type.STRING } },
    reasoning: { type: Type.ARRAY, items: { type: Type.STRING } },
    confidence: { type: Type.STRING, enum: confidences },
  },
  required: [
    "summary",
    "macroSuggestion",
    "macroDelta",
    "mealTimingAdvice",
    "mealSuggestions",
    "warnings",
    "reasoning",
    "confidence",
  ],
};

export const handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") return ok({ error: "Method not allowed." }, 405);
    if (!event.body) throw Object.assign(new Error("Request body is required."), { statusCode: 400 });
    if (Buffer.byteLength(event.body, "utf8") > maxBodyBytes) {
      throw Object.assign(new Error("AI request is too large. Reduce recipe context."), { statusCode: 413 });
    }

    const { userId } = await requireAuth(event);
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw Object.assign(new Error("Gemini API key is not configured."), { statusCode: 500 });

    const input = validateInput(JSON.parse(event.body));
    const response = await callGemini(apiKey, input);
    const geminiResponse = await parseGeminiResponse(response);
    if (!response.ok) {
      const message = geminiResponse.error?.message || geminiResponse.error || "Gemini request failed.";
      throw Object.assign(new Error(`Gemini request failed: ${message}`), { statusCode: 502 });
    }

    const responseText = geminiResponse.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!responseText) throw Object.assign(new Error("Gemini returned an empty response."), { statusCode: 502 });
    const finishReason = geminiResponse.candidates?.[0]?.finishReason;
    if (finishReason === "MAX_TOKENS") {
      throw Object.assign(new Error("Gemini response was truncated. Try again with fewer available recipes."), { statusCode: 502 });
    }

    const rawOutput = parseAiOutput(responseText);
    const output = validateAiNutritionResponse(rawOutput, input);

    await saveSnapshot({ userId, input, output }).catch(() => {
      // Snapshot persistence is non-critical; AI advice should still return if the migration is not applied yet.
    });

    return ok({ suggestion: output, model });
  } catch (error) {
    console.error("aiNutritionCoach failed", {
      message: error instanceof Error ? error.message : String(error),
      statusCode: typeof error === "object" && error && "statusCode" in error ? error.statusCode : undefined,
    });
    return fail(error);
  }
};

async function callGemini(apiKey, input) {
  try {
    return await fetch(
      `https://generativelanguage.googleapis.com/${geminiApiVersion}/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: buildPrompt(input) }] }],
          generationConfig: {
            responseMimeType: "application/json",
            responseSchema,
            temperature: 0.25,
            maxOutputTokens,
          },
        }),
      },
    );
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown network error.";
    throw Object.assign(new Error(`Could not connect to Gemini: ${detail}`), { statusCode: 502 });
  }
}

async function parseGeminiResponse(response) {
  const text = await response.text();
  if (!text) return {};

  try {
    return JSON.parse(text);
  } catch {
    return { error: text.slice(0, 500) };
  }
}

function parseAiOutput(text) {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  const candidates = [cleaned];
  const objectStart = cleaned.indexOf("{");
  const objectEnd = cleaned.lastIndexOf("}");
  if (objectStart >= 0 && objectEnd > objectStart) {
    candidates.push(cleaned.slice(objectStart, objectEnd + 1));
  }

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate);
    } catch {
      // Try the next normalized candidate.
    }
  }

  throw Object.assign(
    new Error(`Gemini returned malformed JSON: ${cleaned.slice(0, 240)}`),
    { statusCode: 502 },
  );
}

function validateInput(fields) {
  const goal = requireEnum(fields.goal, goals, "goal");
  const dayType = requireEnum(fields.dayType, dayTypes, "dayType");
  const currentTargets = validateTargets(fields.currentTargets);
  const workout = isObject(fields.workout)
    ? {
        type: stringOrDefault(fields.workout.type, dayType),
        startTime: nullableString(fields.workout.startTime),
        durationMinutes: nullableNumber(fields.workout.durationMinutes),
        intensity: fields.workout.intensity === "moderate" ? "moderate" : nullableEnum(fields.workout.intensity, ["low", "high"]),
      }
    : { type: dayType, startTime: null, durationMinutes: null, intensity: null };

  return {
    goal,
    dayType,
    workout,
    currentTargets,
    selectedMeals: sanitizeMeals(fields.selectedMeals),
    availableRecipes: sanitizeRecipes(fields.availableRecipes).slice(0, 24),
    userPreferences: sanitizePreferences(fields.userPreferences),
  };
}

function validateTargets(value) {
  if (!isObject(value)) throw Object.assign(new Error("currentTargets is required."), { statusCode: 400 });
  return {
    calories: requireFiniteNumber(value.calories, "currentTargets.calories"),
    protein: requireFiniteNumber(value.protein, "currentTargets.protein"),
    carbs: requireFiniteNumber(value.carbs, "currentTargets.carbs"),
    fat: requireFiniteNumber(value.fat, "currentTargets.fat"),
  };
}

function sanitizeRecipes(value) {
  if (!Array.isArray(value)) return [];
  return value.map((recipe) => ({
    id: nullableString(recipe?.id),
    name: stringOrDefault(recipe?.name, "Unnamed recipe").slice(0, 120),
    mealType: mealTypes.includes(recipe?.mealType) ? recipe.mealType : null,
    kcal: safeNumber(recipe?.kcal, 0),
    protein: safeNumber(recipe?.protein, 0),
    carbs: safeNumber(recipe?.carbs, 0),
    fat: safeNumber(recipe?.fat, 0),
    tags: Array.isArray(recipe?.tags) ? recipe.tags.filter((tag) => typeof tag === "string").slice(0, 8) : [],
  }));
}

function sanitizeMeals(value) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 8).map((meal) => ({
    mealType: mealTypes.includes(meal?.mealType) ? meal.mealType : "snack",
    recipeId: nullableString(meal?.recipeId),
    recipeName: stringOrDefault(meal?.recipeName, "Selected meal").slice(0, 120),
    kcal: safeNumber(meal?.kcal, 0),
    protein: safeNumber(meal?.protein, 0),
    carbs: safeNumber(meal?.carbs, 0),
    fat: safeNumber(meal?.fat, 0),
  }));
}

function sanitizePreferences(value) {
  const preferences = isObject(value) ? value : {};
  return {
    dietaryRestrictions: Array.isArray(preferences.dietaryRestrictions)
      ? preferences.dietaryRestrictions.filter((item) => typeof item === "string").slice(0, 8)
      : [],
    preferredMealComplexity: nullableEnum(preferences.preferredMealComplexity, ["low", "medium", "high"]),
  };
}

function validateAiNutritionResponse(rawResponse, input) {
  const warnings = stringArray(rawResponse.warnings);
  const confidence = confidences.includes(rawResponse.confidence) ? rawResponse.confidence : "low";
  const macroSuggestion = {
    calories: clampMacro(rawResponse.macroSuggestion?.calories, input.currentTargets.calories, "calories", confidence, warnings),
    protein: clampMacro(rawResponse.macroSuggestion?.protein, input.currentTargets.protein, "protein", confidence, warnings),
    carbs: Math.max(0, clampMacro(rawResponse.macroSuggestion?.carbs, input.currentTargets.carbs, "carbs", confidence, warnings)),
    fat: Math.max(0, clampMacro(rawResponse.macroSuggestion?.fat, input.currentTargets.fat, "fat", confidence, warnings)),
  };

  return {
    summary: stringOrDefault(rawResponse.summary, "AI reviewed the current plan and returned a conservative suggestion.").slice(0, 600),
    macroSuggestion,
    macroDelta: {
      calories: round(macroSuggestion.calories - input.currentTargets.calories),
      protein: round(macroSuggestion.protein - input.currentTargets.protein),
      carbs: round(macroSuggestion.carbs - input.currentTargets.carbs),
      fat: round(macroSuggestion.fat - input.currentTargets.fat),
    },
    mealTimingAdvice: {
      preWorkout: nullableString(rawResponse.mealTimingAdvice?.preWorkout),
      intraWorkout: nullableString(rawResponse.mealTimingAdvice?.intraWorkout),
      postWorkout: nullableString(rawResponse.mealTimingAdvice?.postWorkout),
      general: stringOrDefault(rawResponse.mealTimingAdvice?.general, "Keep meals aligned with your planned training timing.").slice(0, 500),
    },
    mealSuggestions: Array.isArray(rawResponse.mealSuggestions)
      ? rawResponse.mealSuggestions.slice(0, 8).map((item) => ({
          mealType: mealTypes.includes(item?.mealType) ? item.mealType : "snack",
          recipeId: nullableString(item?.recipeId),
          recipeName: stringOrDefault(item?.recipeName, "Suggested meal").slice(0, 140),
          reason: stringOrDefault(item?.reason, "Fits the current day context.").slice(0, 320),
          fitScore: clamp(safeNumber(item?.fitScore, 50), 0, 100),
        }))
      : [],
    warnings,
    reasoning: stringArray(rawResponse.reasoning).slice(0, 6),
    confidence,
  };
}

function clampMacro(value, currentValue, label, confidence, warnings) {
  const proposed = safeNumber(value, currentValue);
  const lower = currentValue * 0.8;
  const upper = currentValue * 1.2;
  const outsideRange = proposed < lower || proposed > upper;
  const hasAggressiveWarning = warnings.some((warning) => warning.toLowerCase().includes("aggressive"));
  if (outsideRange && !(confidence === "high" && hasAggressiveWarning)) {
    warnings.push(`${label} change was limited to within 20% of current targets.`);
    return clamp(proposed, lower, upper);
  }
  return proposed;
}

function buildPrompt(input) {
  return [
    "You are an AI nutrition assistant inside FuelSync.",
    "You provide training-aware macro and meal timing suggestions.",
    "You are not a doctor.",
    "You do not provide medical advice.",
    "You do not prescribe supplements.",
    "You must stay within reasonable sports nutrition guidance.",
    "You must return only valid JSON matching the provided schema.",
    "You must explain reasoning briefly.",
    "You must include warnings when the plan is aggressive, uncertain, or based on incomplete data.",
    "You must not invent missing user data.",
    "Do not mention diseases, treatments, medication, or supplements.",
    "Use available recipes when possible; if data is insufficient, say so clearly.",
    "",
    `FuelSync input JSON: ${JSON.stringify(input)}`,
  ].join("\n");
}

async function saveSnapshot({ userId, input, output }) {
  const sql = db();
  await sql`
    insert into ai_recommendation_snapshots (user_id, input_json, output_json, model, confidence)
    values (${userId}, ${sql.json(input)}, ${sql.json(output)}, ${model}, ${output.confidence})
  `;
}

function requireEnum(value, allowed, key) {
  if (typeof value !== "string" || !allowed.includes(value)) {
    throw Object.assign(new Error(`${key} is invalid.`), { statusCode: 400 });
  }
  return value;
}

function requireFiniteNumber(value, key) {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue) || numberValue < 0) {
    throw Object.assign(new Error(`${key} must be a non-negative number.`), { statusCode: 400 });
  }
  return numberValue;
}

function nullableString(value) {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, 500) : null;
}

function stringOrDefault(value, fallback) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function nullableNumber(value) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

function safeNumber(value, fallback) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : fallback;
}

function nullableEnum(value, allowed) {
  return typeof value === "string" && allowed.includes(value) ? value : null;
}

function stringArray(value) {
  return Array.isArray(value) ? value.filter((item) => typeof item === "string").map((item) => item.slice(0, 500)) : [];
}

function isObject(value) {
  return typeof value === "object" && value !== null;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function round(value) {
  return Math.round(value);
}
