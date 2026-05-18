import { ChevronLeft, ChevronRight, Edit2, Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { ActivityFormModal } from "../components/ActivityFormModal";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { ErrorState, LoadingState } from "../components/State";
import { addDays, formatShortDate, toDateKey, weekDays } from "../lib/date";
import { useApi } from "../hooks/useApi";
import { determineDayType } from "../services/dayPriority";
import type { Activity } from "../types";
import { label } from "../lib/constants";
import { formatDayName } from "../lib/date";

export function Planner() {
  const api = useApi();
  const [anchor, setAnchor] = useState(new Date());
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<Activity | null | "new">(null);
  const [newDate, setNewDate] = useState<string | undefined>();

  const days = useMemo(() => weekDays(anchor), [anchor]);
  const from = toDateKey(days[0]);
  const to = toDateKey(days[6]);

  const load = () => {
    setLoading(true);
    api.getActivities({ from, to }).then(setActivities).catch((err) => setError(err.message)).finally(() => setLoading(false));
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
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" className="h-10 w-10 px-0" icon={<ChevronLeft size={18} />} onClick={() => setAnchor(addDays(anchor, -7))} />
          <Button variant="secondary" className="h-10 w-10 px-0" icon={<ChevronRight size={18} />} onClick={() => setAnchor(addDays(anchor, 7))} />
          <Button icon={<Plus size={18} />} onClick={() => addForDate(toDateKey(new Date()))}>Activity</Button>
        </div>
      </header>

      {error && <ErrorState message={error} />}
      {loading ? <LoadingState label="Loading planner..." /> : (
        <div className="grid snap-x gap-3 overflow-x-auto pb-2 md:grid-cols-7 md:overflow-visible">
          {days.map((day) => {
            const dateKey = toDateKey(day);
            const dayActivities = activities.filter((activity) => activity.date === dateKey);
            const dayType = determineDayType(dayActivities);
            return (
              <Card key={dateKey} className="min-w-72 snap-start md:min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-xs font-black uppercase text-mint">{formatDayName(day)}</div>
                    <h2 className="text-lg font-black">{formatShortDate(dateKey)}</h2>
                    <p className="mt-1 text-xs font-bold text-slate-500">{label(dayType)}</p>
                  </div>
                  <Button variant="ghost" className="h-9 w-9 px-0" icon={<Plus size={16} />} onClick={() => addForDate(dateKey)} />
                </div>
                <div className="mt-4 space-y-2">
                  {dayActivities.length === 0 ? (
                    <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-500">Rest day by default.</p>
                  ) : (
                    dayActivities.map((activity) => (
                      <div key={activity.id} className="rounded-lg bg-slate-50 p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="font-black">{label(activity.activity_type)}</div>
                            <div className="text-xs text-slate-500">
                              {activity.start_time?.slice(0, 5) || "Any time"} · {activity.duration_minutes ?? "-"} min
                            </div>
                          </div>
                          <div className="flex gap-1">
                            <Button variant="ghost" className="h-8 w-8 px-0" icon={<Edit2 size={14} />} onClick={() => setEditing(activity)} />
                            <Button
                              variant="ghost"
                              className="h-8 w-8 px-0 text-red-600"
                              icon={<Trash2 size={14} />}
                              onClick={async () => {
                                await api.deleteActivity(activity.id);
                                setActivities((current) => current.filter((item) => item.id !== activity.id));
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
                <p className="mt-4 rounded-lg bg-emerald-50 p-3 text-xs font-bold text-emerald-800">
                  Suggestions use {label(dayType)} day logic.
                </p>
              </Card>
            );
          })}
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
