import type { DayType, MealType, TimingType } from "../types";

export const mealTypes: MealType[] = ["breakfast", "lunch", "dinner", "snack"];
export const dayTypes: DayType[] = ["rest", "gym", "interval_bike", "endurance_bike"];
export const timingTypes: TimingType[] = ["pre_workout", "post_workout", "neutral", "evening_recovery"];

export const label = (value: string) => value.replace(/_/g, " ");
