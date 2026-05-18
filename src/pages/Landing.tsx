import { useAuth0 } from "@auth0/auth0-react";
import { LogIn } from "lucide-react";
import { Button } from "../components/Button";

export function Landing() {
  const { loginWithRedirect } = useAuth0();

  return (
    <main className="flex min-h-screen items-center justify-center bg-oat px-4 py-10 text-ink">
      <section className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-6 shadow-soft">
        <div className="mb-8">
          <div className="text-4xl font-black tracking-tight">FuelSync</div>
          <p className="mt-3 text-slate-600">A clean foundation for managing ingredients and recipes before planning begins.</p>
        </div>
        <Button className="w-full" icon={<LogIn size={18} />} onClick={() => loginWithRedirect()}>
          Log in with Auth0
        </Button>
      </section>
    </main>
  );
}
