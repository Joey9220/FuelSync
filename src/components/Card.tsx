import type { ReactNode } from "react";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-lg border border-slate-200 bg-white p-4 shadow-soft transition dark:border-slate-800 dark:bg-slate-900 ${className}`}>{children}</section>;
}
