import { useId, useState } from "react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { Spinner } from "@/components/ui/spinner"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import type { AddressDraft, SavedAddress } from "@/lib/account"
import { useMarket } from "@/lib/market"

const LABELS = ["Home", "Work", "Other"] as const

type Values = {
  label: string
  firstName: string
  lastName: string
  phone: string
  address1: string
  address2: string
  city: string
  province: string
  postalCode: string
  isDefault: boolean
}

function initial(a?: Partial<SavedAddress> | null, prefill?: { firstName?: string | null; lastName?: string | null; phone?: string | null }): Values {
  return {
    label: a?.label ?? "Home",
    firstName: a?.firstName ?? prefill?.firstName ?? "",
    lastName: a?.lastName ?? prefill?.lastName ?? "",
    phone: a?.phone ?? prefill?.phone ?? "",
    address1: a?.address1 ?? "",
    address2: a?.address2 ?? "",
    city: a?.city ?? "",
    province: a?.province ?? "",
    postalCode: a?.postalCode ?? "",
    isDefault: a?.isDefault ?? false,
  }
}

/**
 * One address form for the account book (and anywhere else an address is
 * edited). Fields, labels, regions and phone hints come from the market
 * config, so a new country is data, not code.
 */
export function AddressForm({
  address,
  prefill,
  submitLabel = "Save address",
  showDefault = true,
  pending,
  error,
  onSubmit,
  onCancel,
}: {
  address?: Partial<SavedAddress> | null
  prefill?: { firstName?: string | null; lastName?: string | null; phone?: string | null }
  submitLabel?: string
  showDefault?: boolean
  pending?: boolean
  error?: string | null
  onSubmit: (draft: AddressDraft) => void
  onCancel?: () => void
}) {
  const market = useMarket()
  const uid = useId()
  const id = (k: string) => `${uid}-${k}`
  const [v, setV] = useState<Values>(() => initial(address, prefill))
  const [tried, setTried] = useState(false)
  const set = (k: keyof Values) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setV((x) => ({ ...x, [k]: e.target.value }))

  const field = (k: string) => market.address.fields.find((f) => f.key === k)
  const regionField = field("province")
  const requiredKeys: (keyof Values)[] = ["firstName", "lastName", "phone", "address1", "city", ...(regionField?.required ? (["province"] as const) : [])]
  const phoneShort = v.phone.replace(/\D/g, "").length > 0 && v.phone.replace(/\D/g, "").length < 9
  const missing = requiredKeys.filter((k) => !String(v[k]).trim())
  const bad = (k: keyof Values) => tried && (missing.includes(k) || (k === "phone" && phoneShort))

  function submit(e: React.FormEvent) {
    e.preventDefault()
    setTried(true)
    if (missing.length || phoneShort) {
      document.getElementById(id(missing[0] ?? "phone"))?.focus()
      return
    }
    onSubmit({
      label: v.label.trim() || null,
      firstName: v.firstName.trim(),
      lastName: v.lastName.trim(),
      phone: v.phone.trim(),
      address1: v.address1.trim(),
      address2: v.address2.trim() || null,
      city: v.city.trim(),
      province: v.province.trim() || null,
      postalCode: v.postalCode.trim() || null,
      countryCode: market.countryCode,
      isDefault: v.isDefault,
    })
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-5">
      {error ? (
        <p role="alert" className="rounded-2xl bg-destructive/10 p-3 text-sm font-medium text-destructive">
          {error}
        </p>
      ) : null}
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Save as</legend>
        <ToggleGroup
          type="single"
          variant="outline"
          value={LABELS.includes(v.label as (typeof LABELS)[number]) ? v.label : "Other"}
          onValueChange={(x) => x && setV((s) => ({ ...s, label: x }))}
          className="justify-start"
        >
          {LABELS.map((l) => (
            <ToggleGroupItem key={l} value={l} className="px-4">
              {l}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </fieldset>

      <FieldGroup className="grid gap-4 sm:grid-cols-2">
        <Field data-invalid={bad("firstName") || undefined}>
          <FieldLabel htmlFor={id("firstName")}>First name</FieldLabel>
          <Input id={id("firstName")} autoComplete="given-name" value={v.firstName} onChange={set("firstName")} aria-invalid={bad("firstName")} />
        </Field>
        <Field data-invalid={bad("lastName") || undefined}>
          <FieldLabel htmlFor={id("lastName")}>Last name</FieldLabel>
          <Input id={id("lastName")} autoComplete="family-name" value={v.lastName} onChange={set("lastName")} aria-invalid={bad("lastName")} />
        </Field>
        <Field className="sm:col-span-2" data-invalid={bad("phone") || undefined}>
          <FieldLabel htmlFor={id("phone")}>Phone for the rider</FieldLabel>
          <Input
            id={id("phone")}
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder={market.phone.example}
            value={v.phone}
            onChange={set("phone")}
            aria-invalid={bad("phone")}
            aria-describedby={`${id("phone")}-hint`}
          />
          {bad("phone") && phoneShort ? (
            <FieldError>That number looks too short.</FieldError>
          ) : (
            <FieldDescription id={`${id("phone")}-hint`}>{market.phone.hint}</FieldDescription>
          )}
        </Field>
        <Field className="sm:col-span-2" data-invalid={bad("address1") || undefined}>
          <FieldLabel htmlFor={id("address1")}>{field("address_1")?.label ?? "Street address"}</FieldLabel>
          <Input
            id={id("address1")}
            autoComplete="street-address"
            placeholder={field("address_1")?.placeholder}
            value={v.address1}
            onChange={set("address1")}
            aria-invalid={bad("address1")}
          />
        </Field>
        <Field className="sm:col-span-2">
          <FieldLabel htmlFor={id("address2")}>
            {field("address_2")?.label ?? "Apartment, landmark"} <span className="font-normal text-muted-foreground">(optional)</span>
          </FieldLabel>
          <Input id={id("address2")} placeholder={field("address_2")?.placeholder} value={v.address2} onChange={set("address2")} />
        </Field>
        <Field data-invalid={bad("city") || undefined}>
          <FieldLabel htmlFor={id("city")}>{field("city")?.label ?? "City"}</FieldLabel>
          <Input id={id("city")} autoComplete="address-level2" placeholder={field("city")?.placeholder} value={v.city} onChange={set("city")} aria-invalid={bad("city")} />
        </Field>
        {regionField ? (
          <Field data-invalid={bad("province") || undefined}>
            <FieldLabel htmlFor={id("province")}>{regionField.label}</FieldLabel>
            <NativeSelect id={id("province")} value={v.province} onChange={set("province")} aria-invalid={bad("province")} className="w-full">
              <NativeSelectOption value="">Choose…</NativeSelectOption>
              {regionField.options?.map((o) => (
                <NativeSelectOption key={o.value} value={o.value}>
                  {o.label}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>
        ) : null}
        {field("postal_code") ? (
          <Field className="sm:col-span-2">
            <FieldLabel htmlFor={id("postalCode")}>{field("postal_code")!.label}</FieldLabel>
            <Input
              id={id("postalCode")}
              autoComplete="postal-code"
              placeholder={field("postal_code")!.placeholder}
              value={v.postalCode}
              onChange={set("postalCode")}
            />
          </Field>
        ) : null}
      </FieldGroup>

      {tried && missing.length ? (
        <p role="alert" className="text-sm font-medium text-destructive">
          Fill in the highlighted fields.
        </p>
      ) : null}

      {showDefault ? (
        <label className="flex items-center gap-2.5 text-[length:var(--text-legacy-15)]">
          <Checkbox checked={v.isDefault} onCheckedChange={(x) => setV((s) => ({ ...s, isDefault: Boolean(x) }))} />
          Use as my default delivery address
        </label>
      ) : null}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        {onCancel ? (
          <Button type="button" variant="outline" size="lg" onClick={onCancel}>
            Cancel
          </Button>
        ) : null}
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? <Spinner /> : null}
          {submitLabel}
        </Button>
      </div>
    </form>
  )
}
