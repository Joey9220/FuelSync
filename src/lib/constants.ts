import type { DayType, MealType, TargetGoal, TimingType } from "../types";

export const mealTypes: MealType[] = ["breakfast", "lunch", "dinner", "snack"];
export const dayTypes: DayType[] = ["rest", "gym", "interval_bike", "endurance_bike"];
export const timingTypes: TimingType[] = ["pre_workout", "post_workout", "neutral", "evening_recovery", "carb_support"];
export const intensityTypes = ["low", "medium", "high"] as const;
export const targetGoals: TargetGoal[] = ["recomp", "fat_loss", "maintenance", "cut", "lean_bulk"];

export const label = (value: string) => value.replace(/_/g, " ");
