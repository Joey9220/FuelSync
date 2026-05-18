import { useAuth0 } from "@auth0/auth0-react";
import { LogIn } from "lucide-react";
import { Button } from "../components/Button";
import fuelSyncLogo from "../assets/fuelsync-logo.svg";

export function Landing() {
  const { loginWithRedirect } = useAuth0();

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10 text-ink">
      <section className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-6 text-center shadow-soft">
        <div className="mb-8">
          <img src={fuelSyncLogo} alt="FuelSync" className="mx-auto h-40 w-40 object-contain" />
          <div className="mt-4 text-4xl font-black tracking-tight">FuelSync</div>
          <p className="mt-3 text-slate-600">Fuel your training. Nourish your goals.</p>
        </div>
        <Button className="w-full" icon={<LogIn size={18} />} onClick={() => loginWithRedirect()}>
          Log in with Auth0
        </Button>
      </section>
    </main>
  );
}
