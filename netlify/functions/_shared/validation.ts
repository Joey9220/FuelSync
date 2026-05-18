export const mealTypes = ["breakfast", "lunch", "dinner", "snack"] as const;
export const dayTypes = ["rest", "gym", "interval_bike", "endurance_bike"] as const;
export const timingTypes = ["pre_workout", "post_workout", "neutral", "evening_recovery", "carb_support"] as const;
export const intensityTypes = ["low", "medium", "high"] as const;

type FieldMap = Record<string, unknown>;

export function requireString(fields: FieldMap, key: string): string {
  const value = fields[key];
  if (typeof value !== "string" || !value.trim()) {
    throw Object.assign(new Error(`${key} is required.`), { statusCode: 400 });
  }
  return value.trim();
}

export function optionalString(fields: FieldMap, key: string): string | null {
  const value = fields[key];
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") {
    throw Object.assign(new Error(`${key} must be text.`), { statusCode: 400 });
  }
  return value.trim();
}

export function requirePositiveNumber(fields: FieldMap, key: string): number {
  const value = Number(fields[key]);
  if (!Number.isFinite(value) || value <= 0) {
    throw Object.assign(new Error(`${key} must be greater than zero.`), { statusCode: 400 });
  }
  return value;
}

export function requireNonNegativeNumber(fields: FieldMap, key: string): number {
  const value = Number(fields[key]);
  if (!Number.isFinite(value) || value < 0) {
    throw Object.assign(new Error(`${key} must be zero or greater.`), { statusCode: 400 });
  }
  return value;
}

export function optionalPositiveInteger(fields: FieldMap, key: string): number | null {
  const value = fields[key];
  if (value === undefined || value === null || value === "") return null;
  const numberValue = Number(value);
  if (!Number.isInteger(numberValue) || numberValue <= 0) {
    throw Object.assign(new Error(`${key} must be a positive integer.`), { statusCode: 400 });
  }
  return numberValue;
}

export function optionalNonNegativeInteger(fields: FieldMap, key: string): number | null {
  const value = fields[key];
  if (value === undefined || value === null || value === "") return null;
  const numberValue = Number(value);
  if (!Number.isInteger(numberValue) || numberValue < 0) {
    throw Object.assign(new Error(`${key} must be zero or greater.`), { statusCode: 400 });
  }
  return numberValue;
}

export function optionalEnum<T extends readonly string[]>(fields: FieldMap, key: string, allowed: T): T[number] | null {
  const value = fields[key];
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string" || !allowed.includes(value)) {
    throw Object.assign(new Error(`${key} is invalid.`), { statusCode: 400 });
  }
  return value as T[number];
}

export function requireDate(fields: FieldMap, key: string): string {
  const value = requireString(fields, key);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw Object.assign(new Error(`${key} must be YYYY-MM-DD.`), { statusCode: 400 });
  }
  return value;
}

export function requireEnum<T extends readonly string[]>(fields: FieldMap, key: string, allowed: T): T[number] {
  const value = requireString(fields, key);
  if (!allowed.includes(value)) {
    throw Object.assign(new Error(`${key} is invalid.`), { statusCode: 400 });
  }
  return value as T[number];
}

export function optionalStringArray(fields: FieldMap, key: string, allowed?: readonly string[]): string[] {
  const value = fields[key];
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw Object.assign(new Error(`${key} must be a text array.`), { statusCode: 400 });
  }
  const cleaned = value.map((item) => item.trim()).filter(Boolean);
  if (allowed && cleaned.some((item) => !allowed.includes(item))) {
    throw Object.assign(new Error(`${key} contains an invalid value.`), { statusCode: 400 });
  }
  return cleaned;
}
