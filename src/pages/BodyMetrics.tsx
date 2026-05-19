import { Activity, Clock3, Database, RefreshCw, Scale } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { MetricChart } from "../components/MetricChart";
import { ErrorState, LoadingState } from "../components/State";
import { useApi } from "../hooks/useApi";
import type { BodyMetric } from "../types";

const ranges = [
  { label: "1w", days: 7 },
  { label: "2w", days: 14 },
  { label: "1m", days: 30 },
  { label: "3m", days: 90 },
  { label: "6m", days: 180 },
  { label: "1y", days: 365 },
];

export function BodyMetrics() {
  const api = useApi();
  const [range, setRange] = useState(30);
  const [metrics, setMetrics] = useState<BodyMetric[]>([]);
  const [connected, setConnected] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [historySyncing, setHistorySyncing] = useState(false);
  const [error, setError] = useState("");

  const latest = metrics.at(-1);

  const load = (selectedRange = range) => {
    setLoading(true);
    api.getBodyMetrics(selectedRange)
      .then((data) => {
        setMetrics(data.metrics);
        setConnected(data.connected);
        setLastSyncedAt(data.last_synced_at);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, [range]);

  async function connect() {
    const { url, state } = await api.getWithingsAuthUrl();
    window.localStorage.setItem("withings_oauth_state", state);
    window.location.assign(url);
  }

  async function sync(days = 370) {
    setSyncing(true);
    setError("");
    try {
      await api.syncWithings(days);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not sync Withings.");
    } finally {
      setSyncing(false);
    }
  }

  async function syncAllHistory() {
    setHistorySyncing(true);
    setError("");
    try {
      await api.syncWithings(3650);
      setRange(3650);
      load(3650);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not sync Withings history.");
    } finally {
      setHistorySyncing(false);
    }
  }

  const metricRows = useMemo(() => [...metrics].reverse(), [metrics]);

  return (
    <div className="space-y-5">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-bold uppercase tracking-wide text-mint">Body metrics</p>
          <h1 className="mt-1 text-3xl font-black tracking-tight">Withings scale</h1>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" icon={<Scale />} onClick={connect}>
            {connected ? "Reconnect" : "Connect"}
          </Button>
          <Button icon={<RefreshCw />} onClick={() => sync()} disabled={!connected || syncing || historySyncing}>
            {syncing ? "Syncing..." : "Sync"}
          </Button>
          <Button
            variant="secondary"
            icon={<Database />}
            onClick={syncAllHistory}
            disabled={!connected || syncing || historySyncing}
          >
            {historySyncing ? "Syncing..." : "Sync all history"}
          </Button>
        </div>
      </header>

      {error && <ErrorState message={error} />}
      {loading ? <LoadingState label="Loading body metrics..." /> : (
        <>
          <div className="grid gap-3 md:grid-cols-4">
            <MetricTile label="Weight" value={latest?.weight_kg} unit="kg" />
            <MetricTile label="Fat mass" value={latest?.fat_mass_kg} unit="kg" />
            <MetricTile label="Fat" value={latest?.fat_percentage} unit="%" />
            <MetricTile label="Muscle" value={latest?.muscle_mass_kg} unit="kg" />
          </div>

          <Card className="border-emerald-100 bg-emerald-50/60">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-white p-2 text-mint shadow-sm"><Clock3 size={20} /></div>
                <div>
                  <div className="text-sm font-black text-slate-900">Withings sync status</div>
                  <div className="text-sm font-semibold text-slate-600">
                    {lastSyncedAt ? `Last synced ${formatDateTime(lastSyncedAt)}` : connected ? "Connected, not synced yet." : "Connect Withings to import measurements."}
                  </div>
                </div>
              </div>
              {connected && (
                <div className="text-sm font-bold text-slate-600">
                  {metrics.length} measurements in current range
                </div>
              )}
            </div>
          </Card>

          <Card>
            <div className="mb-4 flex flex-wrap gap-2">
              {ranges.map((item) => (
                <Button
                  key={item.days}
                  type="button"
                  variant={range === item.days ? "primary" : "secondary"}
                  className="min-h-9 px-3 py-1.5"
                  onClick={() => setRange(item.days)}
                >
                  {item.label}
                </Button>
              ))}
              <Button
                type="button"
                variant={range === 3650 ? "primary" : "secondary"}
                className="min-h-9 px-3 py-1.5"
                onClick={() => setRange(3650)}
              >
                All
              </Button>
            </div>
            <div className="grid gap-5 xl:grid-cols-2">
              <MetricChart metrics={metrics} metricKey="weight_kg" />
              <MetricChart metrics={metrics} metricKey="fat_mass_kg" />
              <MetricChart metrics={metrics} metricKey="fat_percentage" />
              <MetricChart metrics={metrics} metricKey="muscle_mass_kg" />
            </div>
          </Card>

          <Card className="p-0">
            <div className="overflow-x-auto">
              <table className="min-w-[900px] w-full border-collapse text-left text-xs">
                <thead className="bg-slate-100 text-[11px] uppercase tracking-wide text-slate-700">
                  <tr>
                    <th className="border border-slate-300 px-3 py-2">Date</th>
                    <th className="border border-slate-300 px-3 py-2 text-right">Weight</th>
                    <th className="border border-slate-300 px-3 py-2 text-right">Fat mass</th>
                    <th className="border border-slate-300 px-3 py-2 text-right">Fat %</th>
                    <th className="border border-slate-300 px-3 py-2 text-right">Muscle</th>
                    <th className="border border-slate-300 px-3 py-2 text-right">Bone</th>
                    <th className="border border-slate-300 px-3 py-2 text-right">Fat-free mass</th>
                  </tr>
                </thead>
                <tbody>
                  {metricRows.map((metric) => (
                    <tr key={metric.id} className="hover:bg-slate-50">
                      <td className="border border-slate-300 px-3 py-2 font-bold">{formatDate(metric.measured_at)}</td>
                      <MetricValue value={metric.weight_kg} unit="kg" />
                      <MetricValue value={metric.fat_mass_kg} unit="kg" />
                      <MetricValue value={metric.fat_percentage} unit="%" />
                      <MetricValue value={metric.muscle_mass_kg} unit="kg" />
                      <MetricValue value={metric.bone_mass_kg} unit="kg" />
                      <MetricValue value={metric.fat_free_mass_kg} unit="kg" />
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}

function MetricTile({ label, value, unit }: { label: string; value: number | null | undefined; unit: string }) {
  return (
    <Card>
      <div className="flex items-center gap-3">
        <div className="rounded-lg bg-emerald-50 p-3 text-mint"><Activity /></div>
        <div>
          <div className="text-sm font-bold text-slate-500">{label}</div>
          <div className="text-2xl font-black">{value == null ? "-" : `${round(value)} ${unit}`}</div>
        </div>
      </div>
    </Card>
  );
}

function MetricValue({ value, unit }: { value: number | null; unit: string }) {
  return <td className="border border-slate-300 px-3 py-2 text-right tabular-nums">{value == null ? "-" : `${round(value)} ${unit}`}</td>;
}

function round(value: number) {
  return Math.round(value * 10) / 10;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(value));
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}
