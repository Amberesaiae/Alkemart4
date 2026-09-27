import { useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Add01Icon, Cancel01Icon } from "@hugeicons/core-free-icons";
import { Button } from "@workspace/console-ui/components/button";
import { Input } from "@workspace/console-ui/components/input";
import { Switch } from "@workspace/console-ui/components/switch";
import { cn } from "@workspace/console-ui/lib/utils";
import {
  MAX_COMBOS,
  MAX_OPTIONS,
  MAX_VALUES,
  VALUE_SUGGESTIONS,
  NAME_SUGGESTIONS,
  combosOf,
  type ComboRow,
  type OptionDef,
} from "@/lib/product-form";

function ValueChips({
  option,
  onChange,
  suggestions,
}: {
  option: OptionDef;
  onChange: (values: string[]) => void;
  suggestions: string[];
}) {
  const [draft, setDraft] = useState("");
  const add = (raw: string) => {
    const vs = raw
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean);
    const next = [...option.values];
    for (const v of vs)
      if (
        !next.some((x) => x.toLowerCase() === v.toLowerCase()) &&
        next.length < MAX_VALUES
      )
        next.push(v.slice(0, 40));
    onChange(next);
    setDraft("");
  };
  const unused = suggestions.filter(
    (s) => !option.values.some((v) => v.toLowerCase() === s.toLowerCase()),
  );
  return (
    <div className="space-y-2">
      <ul
        className="flex flex-wrap gap-2"
        aria-label={`${option.name || "Option"} values`}
      >
        {option.values.map((v) => (
          <li
            key={v}
            className="inline-flex h-9 items-center gap-1 rounded-full bg-foreground pr-1 pl-3 text-sm font-semibold text-background"
          >
            {v}
            <button
              type="button"
              onClick={() => onChange(option.values.filter((x) => x !== v))}
              className="grid size-7 place-items-center rounded-full hover:bg-background/20"
              aria-label={`Remove ${v}`}
            >
              <HugeiconsIcon icon={Cancel01Icon} className="size-3.5" />
            </button>
          </li>
        ))}
      </ul>
      <div className="flex gap-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              add(draft);
            }
          }}
          placeholder={
            option.values.length
              ? "Add another"
              : "Type a value, then press Enter"
          }
          aria-label={`Add a ${option.name || "value"}`}
          className="h-11 text-base"
        />
        <Button
          type="button"
          variant="outline"
          size="lg"
          onClick={() => add(draft)}
          disabled={!draft.trim()}
        >
          Add
        </Button>
      </div>
      {unused.length ? (
        <div className="flex flex-wrap gap-1.5">
          {unused.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => add(s)}
              className="inline-flex min-h-9 items-center rounded-full border border-dashed px-3 text-sm hover:bg-muted"
            >
              + {s}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function OptionsBuilder({
  options,
  onOptions,
  rows,
  onRows,
  currencySymbol,
}: {
  options: OptionDef[];
  onOptions: (o: OptionDef[]) => void;
  rows: ComboRow[];
  onRows: (r: ComboRow[]) => void;
  currencySymbol: string;
}) {
  const total = combosOf(options).length;
  const [bulkPrice, setBulkPrice] = useState("");
  const [bulkQty, setBulkQty] = useState("");
  const setOption = (i: number, patch: Partial<OptionDef>) =>
    onOptions(options.map((o, j) => (j === i ? { ...o, ...patch } : o)));

  return (
    <div className="space-y-5">
      {options.map((o, i) => (
        <fieldset key={i} className="space-y-3 rounded-2xl border p-4">
          <div className="flex items-center justify-between gap-2">
            <legend className="text-sm font-semibold">Option {i + 1}</legend>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onOptions(options.filter((_, j) => j !== i))}
            >
              Remove
            </Button>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor={`opt-name-${i}`}>
              What changes?
            </label>
            <Input
              id={`opt-name-${i}`}
              value={o.name}
              onChange={(e) =>
                setOption(i, { name: e.target.value.slice(0, 40) })
              }
              placeholder="e.g. Size or Colour"
              className="h-11 text-base"
            />
            {!o.name ? (
              <div className="flex flex-wrap gap-1.5">
                {NAME_SUGGESTIONS.filter(
                  (n) => !options.some((x) => x.name === n),
                ).map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setOption(i, { name: n })}
                    className="inline-flex min-h-9 items-center rounded-full border px-3 text-sm font-semibold hover:bg-muted"
                  >
                    {n}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
          {o.name ? (
            <ValueChips
              option={o}
              onChange={(values) => setOption(i, { values })}
              suggestions={VALUE_SUGGESTIONS[o.name.trim().toLowerCase()] ?? []}
            />
          ) : null}
        </fieldset>
      ))}

      {options.length < MAX_OPTIONS ? (
        <Button
          type="button"
          variant="outline"
          size="lg"
          onClick={() => onOptions([...options, { name: "", values: [] }])}
        >
          <HugeiconsIcon icon={Add01Icon} data-icon="inline-start" />
          {options.length ? "Add another option" : "Add an option"}
        </Button>
      ) : null}

      {total > MAX_COMBOS ? (
        <p
          role="alert"
          className="rounded-xl bg-danger-soft p-3 text-sm font-medium text-destructive"
        >
          That makes {total} combinations — the limit is {MAX_COMBOS}. Remove a
          few values.
        </p>
      ) : null}

      {rows.length > 0 && total <= MAX_COMBOS ? (
        <section aria-labelledby="combos-title" className="space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <h3 id="combos-title" className="font-semibold">
              {rows.length} combination{rows.length === 1 ? "" : "s"} — set
              price and stock
            </h3>
          </div>
          <div className="flex flex-wrap items-end gap-2 rounded-xl bg-muted p-3">
            <label className="space-y-1 text-sm">
              <span className="font-medium">
                Price for all ({currencySymbol})
              </span>
              <Input
                inputMode="decimal"
                value={bulkPrice}
                onChange={(e) => setBulkPrice(e.target.value)}
                className="h-10 w-28"
              />
            </label>
            <label className="space-y-1 text-sm">
              <span className="font-medium">Stock for all</span>
              <Input
                inputMode="numeric"
                value={bulkQty}
                onChange={(e) => setBulkQty(e.target.value.replace(/\D/g, ""))}
                className="h-10 w-24"
              />
            </label>
            <Button
              type="button"
              variant="secondary"
              onClick={() =>
                onRows(
                  rows.map((r) => ({
                    ...r,
                    price: bulkPrice || r.price,
                    qty: bulkQty || r.qty,
                  })),
                )
              }
              disabled={!bulkPrice && !bulkQty}
            >
              Apply to all
            </Button>
          </div>
          <ul className="divide-y rounded-2xl border">
            {rows.map((r) => {
              const label = Object.values(r.options).join(" · ");
              return (
                <li
                  key={r.key}
                  className={cn("space-y-2.5 p-3", !r.on && "opacity-55")}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-medium">{label}</span>
                    <Switch
                      checked={r.on}
                      onCheckedChange={(on) =>
                        onRows(
                          rows.map((x) => (x.key === r.key ? { ...x, on } : x)),
                        )
                      }
                      aria-label={`Sell ${label}`}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <label className="flex items-center gap-1.5 text-sm">
                      <span className="text-muted-foreground">
                        {currencySymbol}
                      </span>
                      <Input
                        inputMode="decimal"
                        value={r.price}
                        disabled={!r.on}
                        onChange={(e) =>
                          onRows(
                            rows.map((x) =>
                              x.key === r.key
                                ? { ...x, price: e.target.value }
                                : x,
                            ),
                          )
                        }
                        aria-label={`Price for ${label}`}
                        className="h-10 min-w-0"
                      />
                    </label>
                    <label className="flex items-center gap-1.5 text-sm">
                      <span className="text-muted-foreground">Qty</span>
                      <Input
                        inputMode="numeric"
                        value={r.qty}
                        disabled={!r.on}
                        onChange={(e) =>
                          onRows(
                            rows.map((x) =>
                              x.key === r.key
                                ? {
                                    ...x,
                                    qty: e.target.value.replace(/\D/g, ""),
                                  }
                                : x,
                            ),
                          )
                        }
                        aria-label={`Stock for ${label}`}
                        className="h-10"
                      />
                    </label>
                  </div>
                </li>
              );
            })}
          </ul>
          <p className="text-sm text-muted-foreground">
            Switch off combinations you don't have — buyers won't be able to
            pick them.
          </p>
        </section>
      ) : null}
    </div>
  );
}
