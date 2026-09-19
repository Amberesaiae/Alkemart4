import { Button, Input, Label, Textarea } from "@workspace/ui"
import type { CheckoutAddress } from "@/lib/checkout"

type Props = {
  address: CheckoutAddress
  email: string
  onEmail: (v: string) => void
  onChange: (next: CheckoutAddress) => void
  onNext: () => void
}

export function AddressStep({ address, email, onEmail, onChange, onNext }: Props) {
  function set<K extends keyof CheckoutAddress>(key: K, value: CheckoutAddress[K]) {
    onChange({ ...address, [key]: value })
  }

  const ready =
    email.includes("@") &&
    address.first_name.trim() &&
    address.phone.trim() &&
    address.address_1.trim() &&
    address.city.trim()

  return (
    <form
      className="space-y-4"
      data-testid="step-panel-address"
      onSubmit={(e) => {
        e.preventDefault()
        if (ready) onNext()
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="First name" value={address.first_name} onChange={(v) => set("first_name", v)} required />
        <Field label="Last name" value={address.last_name} onChange={(v) => set("last_name", v)} />
        <Field label="Email" type="email" value={email} onChange={onEmail} required />
        <Field label="Phone" value={address.phone} onChange={(v) => set("phone", v)} required />
        <Field label="City" value={address.city} onChange={(v) => set("city", v)} required />
        <Field label="Region" value={address.province ?? ""} onChange={(v) => set("province", v)} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="address_1">Address</Label>
        <Textarea
          id="address_1"
          required
          value={address.address_1}
          onChange={(e) => set("address_1", e.target.value)}
        />
      </div>
      <Field label="Landmark (optional)" value={address.address_2 ?? ""} onChange={(v) => set("address_2", v)} />
      <Button type="submit" className="rounded-full" disabled={!ready}>
        Continue to delivery
      </Button>
    </form>
  )
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  required,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  type?: string
  required?: boolean
}) {
  const id = label.toLowerCase().replace(/\s+/g, "-")
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} type={type} required={required} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  )
}
