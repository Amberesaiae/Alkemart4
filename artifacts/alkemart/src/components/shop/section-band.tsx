import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface Props {
  children: ReactNode;
  tone?: "primary" | "accent" | "secondary" | "surface" | "surface-strong";
  className?: string;
  innerClassName?: string;
}

const toneMap = {
  primary: "bg-primary text-primary-foreground",
  accent: "bg-accent text-accent-foreground",
  secondary: "bg-secondary text-secondary-foreground",
  surface: "bg-surface text-foreground",
  "surface-strong": "bg-surface-strong text-foreground",
};

export function SectionBand({ children, tone = "surface", className, innerClassName }: Props) {
  return (
    <section className={cn("w-full", toneMap[tone], className)}>
      <div className={cn("mx-auto w-full max-w-[1600px] px-6 py-10", innerClassName)}>
        {children}
      </div>
    </section>
  );
}
