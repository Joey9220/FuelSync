import { useAuth0 } from "@auth0/auth0-react";
import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import { Landing } from "./pages/Landing";
import { Dashboard } from "./pages/Dashboard";
import { DailySuggestions } from "./pages/DailySuggestions";
import { BodyMetrics } from "./pages/BodyMetrics";
import { Ingredients } from "./pages/Ingredients";
import { Planner } from "./pages/Planner";
import { Recipes } from "./pages/Recipes";
import { Settings } from "./pages/Settings";
import { useEffect } from "react";
import { useApi } from "./hooks/useApi";

export default function App() {
  const { isAuthenticated, isLoading } = useAuth0();

  if (isLoading) {
    return <div className="flex min-h-screen items-center justify-center bg-oat text-ink">Loading FuelSync...</div>;
  }

  if (!isAuthenticated) {
    return <Landing />;
  }

  return (
    <AppShell>
      <WithingsCallbackHandler />
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/body" element={<BodyMetrics />} />
        <Route path="/planner" element={<Planner />} />
        <Route path="/today" element={<DailySuggestions />} />
        <Route path="/ingredients" element={<Ingredients />} />
        <Route path="/recipes" element={<Recipes />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppShell>
  );
}

function WithingsCallbackHandler() {
  const api = useApi();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const state = params.get("state");
    if (!code || !state) return;
    const expectedState = window.localStorage.getItem("withings_oauth_state");
    if (expectedState && expectedState !== state) return;

    api.completeWithingsOAuth(code)
      .then(() => {
        window.localStorage.removeItem("withings_oauth_state");
        window.history.replaceState({}, "", "/body");
        window.location.assign("/body");
      })
      .catch(() => {
        window.history.replaceState({}, "", "/body");
      });
  }, [api]);

  return null;
}
