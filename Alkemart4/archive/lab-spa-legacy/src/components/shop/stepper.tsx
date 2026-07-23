import { CheckIcon } from "@radix-ui/react-icons";
import { cn } from "@/lib/utils";

interface Props {
  steps: string[];
  current: number;
  className?: string;
}

export function Stepper({ steps, current, className }: Props) {
  return (
    <ol className={cn("flex items-center gap-3", className)}>
      {steps.map((s, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={s} className="flex items-center gap-3">
            <div
              className={cn(
                "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                done && "bg-success text-success-foreground",
                active && "bg-primary text-primary-foreground",
                !done && !active && "bg-muted text-muted-foreground",
              )}
            >
              {done ? <CheckIcon className="h-4 w-4" /> : i + 1}
            </div>
            <span
              className={cn(
                "text-sm font-semibold",
                active ? "text-foreground" : "text-muted-foreground",
              )}
            >
              {s}
            </span>
            {i < steps.length - 1 && <span className="h-px w-8 bg-border" />}
          </li>
        );
      })}
    </ol>
  );
}
