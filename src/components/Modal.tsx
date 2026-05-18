import { X } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "./Button";

export function Modal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-40 flex items-end bg-slate-950/45 p-3 sm:items-center sm:justify-center">
      <div className="max-h-[92vh] w-full overflow-y-auto rounded-lg bg-white p-4 shadow-soft sm:max-w-2xl">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-xl font-black">{title}</h2>
          <Button aria-label="Close" variant="ghost" className="h-10 w-10 px-0" onClick={onClose} icon={<X size={18} />} />
        </div>
        {children}
      </div>
    </div>
  );
}
