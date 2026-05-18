import { useAuth0 } from "@auth0/auth0-react";
import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import { Landing } from "./pages/Landing";
import { Dashboard } from "./pages/Dashboard";
import { Ingredients } from "./pages/Ingredients";
import { Recipes } from "./pages/Recipes";
import { Settings } from "./pages/Settings";

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
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/ingredients" element={<Ingredients />} />
        <Route path="/recipes" element={<Recipes />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppShell>
  );
}
