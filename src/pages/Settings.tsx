import { useAuth0 } from "@auth0/auth0-react";
import { Button } from "../components/Button";
import { Card } from "../components/Card";

export function Settings() {
  const { user, logout } = useAuth0();

  return (
    <div className="space-y-5">
      <header>
        <p className="text-sm font-bold uppercase tracking-wide text-mint">Settings</p>
        <h1 className="mt-1 text-3xl font-black tracking-tight">Account</h1>
      </header>

      <Card>
        <div className="text-sm font-bold text-slate-500">Signed in as</div>
        <div className="mt-2 break-words text-lg font-black">{user?.email || user?.name}</div>
        <div className="mt-1 break-words text-sm text-slate-500">{user?.sub}</div>
        <Button
          className="mt-5"
          variant="secondary"
          onClick={() => logout({ logoutParams: { returnTo: window.location.origin } })}
        >
          Log out
        </Button>
      </Card>
    </div>
  );
}
