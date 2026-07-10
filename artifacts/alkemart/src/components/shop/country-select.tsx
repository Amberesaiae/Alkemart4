import { ChevronDownIcon } from "@radix-ui/react-icons";

export function CountrySelect() {
  return (
    <button
      type="button"
      className="flex h-12 w-full items-center justify-between rounded-md border border-input bg-background px-3 text-sm"
    >
      <span className="flex items-center gap-2">
        <span className="flex h-5 w-7 items-center justify-center overflow-hidden rounded-sm bg-muted">
          <span className="flex h-full w-full">
            <span className="h-full flex-1 bg-destructive" />
            <span className="h-full flex-1 bg-accent" />
            <span className="h-full flex-1 bg-success" />
          </span>
        </span>
        <span className="font-semibold">Ghana</span>
        <span className="text-muted-foreground">+233</span>
      </span>
      <ChevronDownIcon />
    </button>
  );
}
