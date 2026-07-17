import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type Width = "default" | "narrow" | "wide" | "full";

const widthClass: Record<Width, string> = {
  default: "max-w-[1600px]",
  wide: "max-w-[1600px]",
  narrow: "max-w-[1200px]",
  full: "max-w-none",
};

interface ShopPageProps {
  children: ReactNode;
  className?: string;
  /** Horizontal + vertical page padding and max width */
  width?: Width;
  /** Extra vertical spacing between blocks */
  dense?: boolean;
}

/**
 * Canonical buyer-page shell. Prefer this over ad-hoc max-w-[N] wrappers.
 */
export function ShopPage({
  children,
  className,
  width = "default",
  dense = false,
}: ShopPageProps) {
  return (
    <div
      className={cn(
        "mx-auto w-full px-4 md:px-6",
        widthClass[width],
        dense ? "space-y-6 py-6 md:py-8" : "space-y-8 py-8 md:py-10",
        className,
      )}
    >
      {children}
    </div>
  );
}
