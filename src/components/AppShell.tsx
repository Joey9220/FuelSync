import { useAuth0 } from "@auth0/auth0-react";
import { CalendarDays, ChefHat, Home, LogOut, Settings, ShoppingBasket, Sparkles } from "lucide-react";
import { NavLink } from "react-router-dom";
import type { ReactNode } from "react";

const navItems = [
  { to: "/", label: "Dashboard", icon: Home },
  { to: "/planner", label: "Planner", icon: CalendarDays },
  { to: "/today", label: "Today", icon: Sparkles },
  { to: "/ingredients", label: "Ingredients", icon: ShoppingBasket },
  { to: "/recipes", label: "Recipes", icon: ChefHat },
  { to: "/settings", label: "Settings", icon: Settings },
];

export function AppShell({ children }: { children: ReactNode }) {
  const { logout, user } = useAuth0();

  return (
    <div className="min-h-screen bg-oat text-ink transition-colors dark:bg-slate-950 dark:text-slate-50">
      <aside className="fixed inset-y-0 left-0 hidden w-72 border-r border-slate-200 bg-white/85 px-5 py-6 shadow-soft backdrop-blur dark:border-slate-800 dark:bg-slate-950/85 lg:block">
        <div className="mb-8">
          <div className="text-2xl font-black tracking-tight">FuelSync</div>
          <div className="mt-1 text-sm text-slate-500">Performance nutrition</div>
        </div>
        <nav className="space-y-2">
          {navItems.map((item) => (
            <NavItem key={item.to} {...item} />
          ))}
        </nav>
        <div className="absolute bottom-6 left-5 right-5 rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="truncate text-sm font-semibold">{user?.name || user?.email}</div>
          <button
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-ink px-3 py-2 text-sm font-semibold text-white"
            onClick={() => logout({ logoutParams: { returnTo: window.location.origin } })}
          >
            <LogOut size={16} /> Log out
          </button>
        </div>
      </aside>

      <main className="mx-auto min-h-screen max-w-6xl px-4 pb-28 pt-5 sm:px-6 lg:ml-72 lg:px-8 lg:pb-8">
        {children}
      </main>

      <nav className="safe-bottom fixed inset-x-0 bottom-0 border-t border-slate-200 bg-white/95 px-2 py-2 shadow-soft backdrop-blur dark:border-slate-800 dark:bg-slate-950/95 lg:hidden">
        <div className="mx-auto grid max-w-md grid-cols-6 gap-1">
          {navItems.map((item) => (
            <NavItem key={item.to} {...item} mobile />
          ))}
        </div>
      </nav>
    </div>
  );
}

function NavItem({
  to,
  label,
  icon: Icon,
  mobile = false,
}: {
  to: string;
  label: string;
  icon: typeof Home;
  mobile?: boolean;
}) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        [
          "flex items-center rounded-lg font-semibold transition",
          mobile ? "h-14 flex-col justify-center gap-1 text-[11px]" : "gap-3 px-3 py-3 text-sm",
          isActive ? "bg-mint text-white" : "text-slate-600 hover:bg-slate-100 hover:text-ink",
        ].join(" ")
      }
    >
      <Icon size={mobile ? 20 : 18} />
      <span>{label}</span>
    </NavLink>
  );
}
