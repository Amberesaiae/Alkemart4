import { useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { HugeiconsIcon } from "@hugeicons/react"
import { ArrowRight01Icon, SparklesIcon } from "@hugeicons/core-free-icons"
import { Button } from "@workspace/console-ui/components/button"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@workspace/console-ui/components/command"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@workspace/console-ui/components/sheet"
import { Skeleton } from "@workspace/console-ui/components/skeleton"
import { flattenCategories, listCategories } from "@/lib/products"
import { categoriesKey, suggestCategories } from "@/lib/product-form"

export function CategoryPicker({ value, onChange, title }: { value: string | null; onChange: (id: string) => void; title: string }) {
  const [open, setOpen] = useState(false)
  const q = useQuery({ queryKey: categoriesKey, queryFn: listCategories, staleTime: 3_600_000 })
  const leaves = useMemo(() => flattenCategories(q.data ?? []), [q.data])
  const current = leaves.find((l) => l.id === value)
  const suggestions = useMemo(() => suggestCategories(title, leaves).filter((s) => s.id !== value), [title, leaves, value])

  return (
    <div className="space-y-2.5">
      <Button type="button" variant="outline" size="lg" className="h-auto min-h-12 w-full justify-between py-2 text-left" onClick={() => setOpen(true)} aria-haspopup="dialog">
        <span className="min-w-0">
          {current ? (
            <>
              <span className="block truncate font-semibold">{current.name}</span>
              <span className="block truncate text-xs font-normal text-muted-foreground">{current.path}</span>
            </>
          ) : (
            <span className="text-muted-foreground">Choose a category</span>
          )}
        </span>
        <HugeiconsIcon icon={ArrowRight01Icon} className="size-4 shrink-0" aria-hidden />
      </Button>

      {suggestions.length ? (
        <div className="flex flex-wrap items-center gap-2" aria-label="Suggested categories">
          <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
            <HugeiconsIcon icon={SparklesIcon} className="size-4" aria-hidden /> Looks like:
          </span>
          {suggestions.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => onChange(s.id)}
              className="inline-flex min-h-9 items-center rounded-full border bg-card px-3 text-sm font-semibold hover:bg-muted"
              title={s.path}
            >
              {s.name}
            </button>
          ))}
        </div>
      ) : null}

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="max-h-[85dvh] sm:mx-auto sm:max-w-xl sm:rounded-t-3xl">
          <SheetHeader>
            <SheetTitle>Choose a category</SheetTitle>
            <SheetDescription>Pick the closest match — buyers browse and filter by it.</SheetDescription>
          </SheetHeader>
          <div className="px-4 pb-6">
            {q.isPending ? (
              <Skeleton className="h-64 rounded-xl" />
            ) : q.isError ? (
              <p role="alert" className="text-sm text-destructive">
                Categories didn't load.{" "}
                <button type="button" className="underline" onClick={() => void q.refetch()}>
                  Try again
                </button>
              </p>
            ) : (
              <Command className="rounded-xl border">
                <CommandInput placeholder="Search, e.g. phones, shoes, rice" autoFocus />
                <CommandList className="max-h-[55dvh]">
                  <CommandEmpty>No category matches. Try a simpler word.</CommandEmpty>
                  <CommandGroup>
                    {leaves.map((l) => (
                      <CommandItem
                        key={l.id}
                        value={`${l.path} ${l.id}`}
                        onSelect={() => {
                          onChange(l.id)
                          setOpen(false)
                        }}
                        className="min-h-11 flex-col items-start gap-0"
                      >
                        <span className="font-medium">{l.name}</span>
                        <span className="text-xs text-muted-foreground">{l.path}</span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
