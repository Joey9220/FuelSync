import { FormEvent, useState } from "react";
import { Button } from "./Button";
import { Field, Input, Select, Textarea } from "./FormField";
import { Modal } from "./Modal";
import { ErrorState } from "./State";
import { dayTypes, intensityTypes, label } from "../lib/constants";
import { todayKey } from "../lib/date";
import { useApi } from "../hooks/useApi";
import type { Activity, ActivityPayload, DayType, Intensity } from "../types";

const emptyActivity: ActivityPayload = {
  date: todayKey(),
  activity_type: "gym",
  start_time: "08:00",
  duration_minutes: 60,
  intensity: "medium",
  notes: "",
};

export function ActivityFormModal({
  activity,
  date,
  onClose,
  onSaved,
}: {
  activity: Activity | null;
  date?: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const api = useApi();
  const [form, setForm] = useState<ActivityPayload>(
    activity
      ? {
          date: activity.date,
          activity_type: activity.activity_type,
          start_time: activity.start_time,
          duration_minutes: activity.duration_minutes,
          intensity: activity.intensity,
          notes: activity.notes,
        }
      : { ...emptyActivity, date: date ?? todayKey() },
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const update = (key: keyof ActivityPayload, value: string | number | null) =>
    setForm((current) => ({ ...current, [key]: value }));

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    const payload = {
      ...form,
      duration_minutes: form.duration_minutes ? Number(form.duration_minutes) : null,
      start_time: form.start_time || null,
      intensity: form.intensity || null,
      notes: form.notes?.trim() || null,
    };

    try {
      if (activity) await api.updateActivity(activity.id, payload);
      else await api.createActivity(payload);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save activity.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title={activity ? "Edit activity" : "Add activity"} onClose={onClose}>
      <form className="space-y-4" onSubmit={submit}>
        {error && <ErrorState message={error} />}
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Activity type">
            <Select value={form.activity_type} onChange={(event) => update("activity_type", event.target.value as DayType)}>
              {dayTypes.map((type) => (
                <option key={type} value={type}>
                  {label(type)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Date">
            <Input type="date" value={form.date} onChange={(event) => update("date", event.target.value)} required />
          </Field>
          <Field label="Start time">
            <Input type="time" value={form.start_time ?? ""} onChange={(event) => update("start_time", event.target.value)} />
          </Field>
          <Field label="Duration minutes">
            <Input
              type="number"
              min="1"
              value={form.duration_minutes ?? ""}
              onChange={(event) => update("duration_minutes", event.target.value ? Number(event.target.value) : null)}
            />
          </Field>
          <Field label="Intensity">
            <Select value={form.intensity ?? ""} onChange={(event) => update("intensity", event.target.value as Intensity)}>
              <option value="">Not set</option>
              {intensityTypes.map((type) => (
                <option key={type} value={type}>
                  {label(type)}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label="Notes">
          <Textarea rows={3} value={form.notes ?? ""} onChange={(event) => update("notes", event.target.value)} />
        </Field>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? "Saving..." : "Save"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
