import { Checkbox } from "@workspace/console-ui/components/checkbox"
import { Input } from "@workspace/console-ui/components/input"
import { Label } from "@workspace/console-ui/components/label"
import { Switch } from "@workspace/console-ui/components/switch"
import { cn } from "@workspace/console-ui/lib/utils"
import type { AttributeField, AttributeValue } from "@/lib/products"
import { isAnswered, type SpecValues } from "@/lib/product-form"

/** Typed fields from the category's attribute profile. Required ones are marked. */
export function SpecFields({
  fields,
  values,
  onChange,
  showErrors,
}: {
  fields: AttributeField[]
  values: SpecValues
  onChange: (v: SpecValues) => void
  showErrors?: boolean
}) {
  const set = (f: AttributeField, patch: Partial<AttributeValue>) =>
    onChange({ ...values, [f.id]: { ...values[f.id], ...patch, definitionId: f.id } })
  const ordered = [...fields].sort((a, b) => Number(b.required) - Number(a.required))

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {ordered.map((f) => {
        const v = values[f.id]
        const bad = showErrors && f.required && !isAnswered(f, v)
        const id = `spec-${f.id}`
        const label = (
          <Label htmlFor={id} className="text-sm font-medium">
            {f.label}
            {f.required ? <span className="text-destructive"> *</span> : <span className="font-normal text-muted-foreground"> (optional)</span>}
            {f.unitFamily ? <span className="font-normal text-muted-foreground"> · {f.unitFamily}</span> : null}
          </Label>
        )
        return (
          <div key={f.id} className={cn("space-y-1.5", (f.type === "multi_option" || f.type === "text") && "sm:col-span-2")}>
            {f.type === "boolean" ? (
              <div className="flex min-h-11 items-center justify-between gap-3 rounded-xl border px-3">
                {label}
                <Switch id={id} checked={v?.booleanValue ?? false} onCheckedChange={(b) => set(f, { booleanValue: b })} />
              </div>
            ) : f.type === "option" && f.allowedValues?.length ? (
              <>
                {label}
                <select
                  id={id}
                  value={v?.optionValues?.[0] ?? ""}
                  onChange={(e) => set(f, { optionValues: e.target.value ? [e.target.value] : [] })}
                  aria-invalid={bad || undefined}
                  className="h-11 w-full rounded-xl border bg-background px-3 text-base aria-invalid:border-destructive"
                >
                  <option value="">Choose…</option>
                  {f.allowedValues.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              </>
            ) : f.type === "multi_option" && f.allowedValues?.length ? (
              <fieldset className="space-y-2">
                <legend className="text-sm font-medium">
                  {f.label}
                  {f.required ? <span className="text-destructive"> *</span> : <span className="font-normal text-muted-foreground"> (optional)</span>}
                </legend>
                <div className="flex flex-wrap gap-2">
                  {f.allowedValues.map((o) => {
                    const on = v?.optionValues?.includes(o) ?? false
                    return (
                      <label key={o} className={cn("inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-full border px-3 text-sm", on && "border-foreground bg-muted")}>
                        <Checkbox
                          checked={on}
                          onCheckedChange={(c) =>
                            set(f, { optionValues: c ? [...(v?.optionValues ?? []), o] : (v?.optionValues ?? []).filter((x) => x !== o) })
                          }
                        />
                        {o}
                      </label>
                    )
                  })}
                </div>
              </fieldset>
            ) : f.type === "number" ? (
              <>
                {label}
                <Input
                  id={id}
                  inputMode="decimal"
                  value={v?.numberValue ?? ""}
                  onChange={(e) => {
                    const n = e.target.value === "" ? null : Number(e.target.value.replace(",", "."))
                    set(f, { numberValue: n != null && Number.isFinite(n) ? n : null })
                  }}
                  aria-invalid={bad || undefined}
                  className="h-11 text-base"
                />
              </>
            ) : (
              <>
                {label}
                <Input id={id} value={v?.textValue ?? ""} onChange={(e) => set(f, { textValue: e.target.value })} aria-invalid={bad || undefined} className="h-11 text-base" />
              </>
            )}
            {bad ? <p className="text-sm text-destructive">Required for this category.</p> : null}
          </div>
        )
      })}
    </div>
  )
}
