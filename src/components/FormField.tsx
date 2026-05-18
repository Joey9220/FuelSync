import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-bold text-slate-700">{label}</span>
      {children}
    </label>
  );
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full rounded-lg border border-slate-400 bg-white px-3 py-2 text-ink outline-none placeholder:text-slate-500 focus:border-mint focus:ring-2 focus:ring-emerald-100 ${props.className || ""}`}
    />
  );
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`w-full rounded-lg border border-slate-400 bg-white px-3 py-2 text-ink outline-none focus:border-mint focus:ring-2 focus:ring-emerald-100 ${props.className || ""}`}
    />
  );
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={`w-full rounded-lg border border-slate-400 bg-white px-3 py-2 text-ink outline-none placeholder:text-slate-500 focus:border-mint focus:ring-2 focus:ring-emerald-100 ${props.className || ""}`}
    />
  );
}
