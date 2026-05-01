"use client";

import { AlertCircle, CheckCircle2, Info } from "lucide-react";

export type DashboardToast = {
  id: number;
  message: string;
  type: "success" | "error" | "info";
};

export default function ToastStack({ toasts }: { toasts: DashboardToast[] }) {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`flex items-center gap-2 rounded-2xl px-5 py-3 text-xs font-black text-white shadow-[0_10px_25px_rgba(0,0,0,0.1)] transition-all animate-in slide-in-from-right-8 pointer-events-auto ${
            toast.type === "success"
              ? "bg-emerald-500"
              : toast.type === "error"
              ? "bg-red-500"
              : "bg-[#111]"
          }`}
        >
          {toast.type === "success" && <CheckCircle2 size={16} />}
          {toast.type === "error" && <AlertCircle size={16} />}
          {toast.type === "info" && <Info size={16} />}
          {toast.message}
        </div>
      ))}
    </div>
  );
}
