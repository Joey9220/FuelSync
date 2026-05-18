import type { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "danger" | "ghost";
  icon?: ReactNode;
};

const variants = {
  primary: "bg-mint text-white shadow-sm hover:bg-emerald-700 [&_svg]:text-white",
  secondary: "bg-white text-ink ring-1 ring-slate-400 hover:bg-slate-50 [&_svg]:text-ink",
  danger: "bg-coral text-white hover:bg-red-600",
  ghost: "bg-transparent text-slate-800 hover:bg-slate-100 [&_svg]:text-slate-800",
};

export function Button({ variant = "primary", icon, className = "", children, ...props }: ButtonProps) {
  return (
    <button
      className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-50 [&_svg]:h-5 [&_svg]:w-5 [&_svg]:stroke-[2.6] ${variants[variant]} ${className}`}
      {...props}
    >
      {icon}
      {children}
    </button>
  );
}
