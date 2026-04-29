"use client";

import { type LucideIcon } from "lucide-react";

type PageLoaderProps = {
  icon: LucideIcon;
  label: string;
  as?: "main" | "section" | "div";
  className?: string;
};

export default function PageLoader({
  icon: Icon,
  label,
  as = "main",
  className = "",
}: PageLoaderProps) {
  const Component = as;

  return (
    <Component
      className={`flex min-h-[80vh] items-center justify-center bg-[#f2fbff] ${className}`.trim()}
    >
      <div className="flex flex-col items-center gap-4">
        <Icon size={32} className="animate-pulse text-[#03c7fe]" />
        <h2 className="text-xs font-black uppercase tracking-widest text-[#888]">
          {label}
        </h2>
      </div>
    </Component>
  );
}
