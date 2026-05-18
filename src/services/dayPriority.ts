import type { Activity, DayType } from "../types";

export function determineDayType(activities: Pick<Activity, "activity_type" | "duration_minutes">[]): DayType {
  if (activities.some((activity) => activity.activity_type === "interval_bike")) return "interval_bike";
  if (
    activities.some(
      (activity) => activity.activity_type === "endurance_bike" && Number(activity.duration_minutes ?? 0) >= 120,
    )
  ) {
    return "endurance_bike";
  }
  if (activities.some((activity) => activity.activity_type === "gym")) return "gym";
  if (activities.some((activity) => activity.activity_type === "endurance_bike")) return "endurance_bike";
  return "rest";
}
