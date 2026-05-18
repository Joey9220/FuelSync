import { Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { ErrorState, LoadingState } from "../components/State";
import { useApi } from "../hooks/useApi";
import type { Stats } from "../types";

export function Dashboard() {
  const api = useApi();
  const navigate = useNavigate();
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api.getStats().then(setStats).catch((err) => setError(err.message));
  }, [api]);

  return (
    <div className="space-y-5">
      <header>
        <p className="text-sm font-bold uppercase tracking-wide text-mint">Dashboard</p>
        <h1 className="mt-1 text-3xl font-black tracking-tight">Welcome back</h1>
      </header>

      {error && <ErrorState message={error} />}
      {!stats && !error ? (
        <LoadingState label="Loading dashboard..." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <StatCard label="Recipes" value={stats?.recipes ?? 0} />
          <StatCard label="Ingredients" value={stats?.ingredients ?? 0} />
        </div>
      )}

      <Card>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button icon={<Plus size={18} />} className="sm:w-auto" onClick={() => navigate("/ingredients")}>
            Add ingredient
          </Button>
          <Button variant="secondary" icon={<Plus size={18} />} className="sm:w-auto" onClick={() => navigate("/recipes")}>
            Add recipe
          </Button>
        </div>
      </Card>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <div className="text-sm font-bold text-slate-500">{label}</div>
      <div className="mt-2 text-4xl font-black">{value}</div>
    </Card>
  );
}
