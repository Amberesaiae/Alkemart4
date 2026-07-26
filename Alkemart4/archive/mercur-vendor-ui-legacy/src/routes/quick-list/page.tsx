import { type RouteConfig } from "@mercurjs/dashboard-sdk"
import { useState } from "react"
import { Sparkles } from "lucide-react"
import {
  AlkPage,
  AlkPageHeader,
  AlkPanel,
  AlkField,
  AlkButton,
  AlkError,
} from "../../components/ui"

export const config: RouteConfig = {
  label: "Quick Sell",
  icon: Sparkles,
  rank: 1,
}

type Form = {
  title: string
  price_ghs: string
  description: string
  image_url: string
}

export default function QuickListPage() {
  const [form, setForm] = useState<Form>({
    title: "",
    price_ghs: "",
    description: "",
    image_url: "",
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{ product_id: string; message: string } | null>(null)

  const canSubmit = form.title.trim().length >= 3 && Number(form.price_ghs) >= 0.5

  const submit = async () => {
    setBusy(true)
    setError(null)
    setResult(null)
    try {
      const res = await fetch("/vendor/alkemart/quick-list", {
        method: "POST",
        credentials: "include",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: form.title.trim(),
          price_ghs: Number(form.price_ghs),
          description: form.description.trim() || undefined,
          image_url: form.image_url.trim() || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || `Failed (${res.status})`)
        return
      }
      setResult(data)
    } catch {
      setError("Network error — check connection and try again.")
    } finally {
      setBusy(false)
    }
  }

  if (result) {
    return (
      <AlkPage>
        <AlkPageHeader
          title="Listed!"
          description={result.message}
        />
        <AlkPanel>
          <p>Your product is submitted for review.</p>
          <div className="alk-panel-footer">
            <AlkButton onClick={() => { window.location.href = "/seller/products" }}>
              View all products
            </AlkButton>
          </div>
        </AlkPanel>
      </AlkPage>
    )
  }

  return (
    <AlkPage>
      <AlkPageHeader
        title="Quick Sell"
        description="Title, price, photo — done."
      />

      <AlkPanel title="Product details">
        <div className="alk-form-grid">
          <AlkField label="Product title *" htmlFor="ql-title">
            <input
              id="ql-title"
              className="alk-input"
              placeholder="e.g. Used iPhone 12, good condition"
              value={form.title}
              autoComplete="off"
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            />
          </AlkField>

          <AlkField label="Price (GH₵) *" htmlFor="ql-price">
            <input
              id="ql-price"
              className="alk-input"
              type="number"
              inputMode="decimal"
              min={0.5}
              step={0.5}
              placeholder="e.g. 45"
              value={form.price_ghs}
              autoComplete="off"
              onChange={(e) => setForm((f) => ({ ...f, price_ghs: e.target.value }))}
            />
          </AlkField>
        </div>

        <AlkField label="Description (optional)" htmlFor="ql-desc">
          <textarea
            id="ql-desc"
            className="alk-input alk-textarea"
            rows={3}
            placeholder="Describe your item — condition, what's included..."
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          />
        </AlkField>

        <AlkField
          label="Photo URL (optional)"
          htmlFor="ql-image"
          hint="Link to a photo hosted online, or leave blank to add later"
        >
          <input
            id="ql-image"
            className="alk-input"
            placeholder="https://example.com/my-photo.jpg"
            value={form.image_url}
            autoComplete="off"
            onChange={(e) => setForm((f) => ({ ...f, image_url: e.target.value }))}
          />
        </AlkField>

        {error ? <AlkError>{error}</AlkError> : null}

        <div className="alk-panel-footer">
          <AlkButton
            disabled={busy || !canSubmit}
            aria-busy={busy}
            onClick={() => void submit()}
          >
            {busy ? "Listing…" : "List for sale"}
          </AlkButton>
        </div>
      </AlkPanel>
    </AlkPage>
  )
}
