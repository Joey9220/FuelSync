import type { Activity, MealTimingContext } from "../types";

const neutralContext: MealTimingContext = {
  breakfast: "neutral",
  lunch: "neutral",
  dinner: "neutral",
  snack: "neutral",
};

export function determineTimingContext(activities: Pick<Activity, "start_time" | "activity_type">[]): MealTimingContext {
  const training = activities
    .filter((activity) => activity.activity_type !== "rest" && activity.start_time)
    .sort((a, b) => String(a.start_time).localeCompare(String(b.start_time)))[0];

  if (!training?.start_time) return neutralContext;

  const hour = Number(training.start_time.slice(0, 2));
  if (hour < 12) {
    return { breakfast: "pre_workout", lunch: "post_workout", dinner: "neutral", snack: "neutral" };
  }
  if (hour < 17) {
    return { breakfast: "neutral", lunch: "pre_workout", dinner: "post_workout", snack: "neutral" };
  }
  return { breakfast: "neutral", lunch: "carb_support", snack: "pre_workout", dinner: "post_workout" };
}
