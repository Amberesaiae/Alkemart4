import { StrictMode, useEffect, useMemo, useState } from "react"
import { createRoot } from "react-dom/client"
import {
  API_URL,
  clearSession,
  createProduct,
  flattenLeafCategories,
  getSessionUser,
  ghanaSetup,
  listCategories,
  listOrders,
  listProducts,
  loginVendor,
  onboardingStatus,
  registerVendor,
  type SessionUser,
} from "./api"
import "./styles.css"

type Mode = "login" | "register"

function App() {
  const [user, setUser] = useState<SessionUser | null>(getSessionUser())
  const [mode, setMode] = useState<Mode>("login")
  const [email, setEmail] = useState("vendor@alkemart.test")
  const [password, setPassword] = useState("VendorPass1")
  const [sellerName, setSellerName] = useState("Demo Vendor")
  const [sellerHandle, setSellerHandle] = useState("demo-vendor")
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [ready, setReady] = useState<{ ready: boolean; missing: string[] } | null>(null)
  const [products, setProducts] = useState<Array<Record<string, unknown>>>([])
  const [orders, setOrders] = useState<Array<Record<string, unknown>>>([])
  const [categories, setCategories] = useState<Array<{ id: string; name: string }>>([])
  const [busy, setBusy] = useState(false)
  const [tab, setTab] = useState<"setup" | "products" | "orders">("setup")
  const [product, setProduct] = useState({
    title: "",
    description: "",
    primaryCategoryId: "",
    pricePesewas: "1500",
    onHand: 5,
    sku: "",
  })
  const [setup, setSetup] = useState({
    displayName: "Demo Vendor",
    region: "GH07",
    digitalAddress: "GA-000-0000",
    deliveryFeePesewas: "500",
    provider: "mtn" as const,
    phone: "0551234987",
    accountName: "Demo Vendor",
  })

  const leafCategories = useMemo(() => categories, [categories])

  const refresh = async () => {
    if (!user) return
    setError(null)
    try {
      const [status, cats] = await Promise.all([onboardingStatus(), listCategories()])
      setReady(status)
      setCategories(flattenLeafCategories(cats.categories ?? []))
      if (status.ready) {
        const [p, o] = await Promise.all([listProducts(), listOrders()])
        setProducts(p.items ?? [])
        setOrders(o.items ?? [])
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load workspace")
    }
  }

  useEffect(() => {
    void refresh()
  }, [user])

  const submitAuth = async (event: React.FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const next =
        mode === "register"
          ? await registerVendor({ email, password, sellerName, sellerHandle })
          : await loginVendor(email, password)
      setUser(next)
      setNotice(mode === "register" ? "Seller account created. Complete Ghana setup next." : "Signed in.")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Auth failed")
    } finally {
      setBusy(false)
    }
  }

  const submitSetup = async (event: React.FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const status = await ghanaSetup({
        displayName: setup.displayName,
        region: setup.region,
        digitalAddress: setup.digitalAddress,
        deliveryFeePesewas: setup.deliveryFeePesewas,
        momo: {
          provider: setup.provider,
          phone: setup.phone,
          accountName: setup.accountName,
        },
      })
      setReady(status)
      setNotice(status.ready ? "Ghana setup complete. You can list products." : `Still missing: ${status.missing.join(", ")}`)
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Setup failed")
    } finally {
      setBusy(false)
    }
  }

  const submitProduct = async (event: React.FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await createProduct({
        ...product,
        onHand: Number(product.onHand),
        sku: product.sku || undefined,
        description: product.description || undefined,
      })
      setNotice("Product submitted (pending moderation until admin approves).")
      setProduct((p) => ({ ...p, title: "", sku: "" }))
      const p = await listProducts()
      setProducts(p.items ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create product failed")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="shell">
      <header className="topbar">
        <a className="brand" href="/">
          alkemart<span>.</span> vendor
        </a>
        <div>
          {user ? (
            <>
              <span className="muted" style={{ marginRight: 12 }}>{user.email}</span>
              <button className="button ghost" type="button" onClick={() => { clearSession(); setUser(null); setReady(null) }}>
                Sign out
              </button>
            </>
          ) : null}
        </div>
      </header>
      <main className="content">
        <h1>Seller workspace</h1>
        <p className="lede">
          Workers API at <code>{API_URL}</code>. Register a shop, finish Ghana payout setup, then list products.
        </p>
        {error && <p className="alert error">{error}</p>}
        {notice && <p className="alert success">{notice}</p>}

        {!user ? (
          <section className="panel">
            <div className="tabs">
              <button className={`tab ${mode === "login" ? "active" : ""}`} type="button" onClick={() => setMode("login")}>Sign in</button>
              <button className={`tab ${mode === "register" ? "active" : ""}`} type="button" onClick={() => setMode("register")}>Create seller</button>
            </div>
            <form className="stack" onSubmit={(e) => void submitAuth(e)}>
              {mode === "register" && (
                <div className="grid2">
                  <label>Shop name<input required value={sellerName} onChange={(e) => setSellerName(e.target.value)} /></label>
                  <label>Handle<input required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" value={sellerHandle} onChange={(e) => setSellerHandle(e.target.value)} /></label>
                </div>
              )}
              <label>Email<input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
              <label>Password<input required minLength={8} type="password" value={password} onChange={(e) => setPassword(e.target.value)} /></label>
              <button className="button primary" disabled={busy} type="submit">{busy ? "Working…" : mode === "register" ? "Create seller account" : "Sign in"}</button>
            </form>
          </section>
        ) : (
          <>
            <div className="tabs">
              <button className={`tab ${tab === "setup" ? "active" : ""}`} type="button" onClick={() => setTab("setup")}>Onboarding</button>
              <button className={`tab ${tab === "products" ? "active" : ""}`} type="button" onClick={() => setTab("products")}>Products</button>
              <button className={`tab ${tab === "orders" ? "active" : ""}`} type="button" onClick={() => setTab("orders")}>Orders</button>
            </div>

            {tab === "setup" && (
              <section className="panel">
                <h2>Ghana setup</h2>
                <p className="muted">Status: {ready ? (ready.ready ? "ready" : `missing ${ready.missing.join(", ")}`) : "loading…"}</p>
                <form className="stack" onSubmit={(e) => void submitSetup(e)}>
                  <div className="grid2">
                    <label>Display name<input required value={setup.displayName} onChange={(e) => setSetup({ ...setup, displayName: e.target.value })} /></label>
                    <label>Region id<input required value={setup.region} onChange={(e) => setSetup({ ...setup, region: e.target.value })} placeholder="GH07" /></label>
                    <label>GhanaPostGPS<input value={setup.digitalAddress} onChange={(e) => setSetup({ ...setup, digitalAddress: e.target.value })} /></label>
                    <label>Delivery fee (pesewas)<input required value={setup.deliveryFeePesewas} onChange={(e) => setSetup({ ...setup, deliveryFeePesewas: e.target.value })} /></label>
                    <label>MoMo provider
                      <select
                        value={setup.provider}
                        onChange={(e) =>
                          setSetup({
                            ...setup,
                            provider: e.target.value as "mtn" | "vodafone" | "airteltigo",
                          })
                        }
                      >
                        <option value="mtn">MTN</option>
                        <option value="vodafone">Telecel</option>
                        <option value="airteltigo">AirtelTigo</option>
                      </select>
                    </label>
                    <label>MoMo phone<input required value={setup.phone} onChange={(e) => setSetup({ ...setup, phone: e.target.value })} /></label>
                    <label>Account name<input required value={setup.accountName} onChange={(e) => setSetup({ ...setup, accountName: e.target.value })} /></label>
                  </div>
                  <button className="button primary" disabled={busy} type="submit">{busy ? "Saving…" : "Save Ghana setup"}</button>
                </form>
              </section>
            )}

            {tab === "products" && (
              <section className="panel">
                <h2>List a product</h2>
                {!ready?.ready && <p className="muted">Complete Ghana setup before listing (or admin may still need to approve the seller).</p>}
                <form className="stack" onSubmit={(e) => void submitProduct(e)}>
                  <label>Category
                    <select required value={product.primaryCategoryId} onChange={(e) => setProduct({ ...product, primaryCategoryId: e.target.value })}>
                      <option value="">Select leaf category</option>
                      {leafCategories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </label>
                  <label>Title<input required value={product.title} onChange={(e) => setProduct({ ...product, title: e.target.value })} /></label>
                  <label>Description<textarea value={product.description} onChange={(e) => setProduct({ ...product, description: e.target.value })} /></label>
                  <div className="grid2">
                    <label>Price (pesewas)<input required value={product.pricePesewas} onChange={(e) => setProduct({ ...product, pricePesewas: e.target.value })} /></label>
                    <label>On hand<input required type="number" min={0} value={product.onHand} onChange={(e) => setProduct({ ...product, onHand: Number(e.target.value) })} /></label>
                    <label>SKU<input value={product.sku} onChange={(e) => setProduct({ ...product, sku: e.target.value })} /></label>
                  </div>
                  <button className="button primary" disabled={busy} type="submit">Create product + offer</button>
                </form>
                <div>
                  {products.map((p) => (
                    <article className="record" key={String(p.id)}>
                      <strong>{String(p.title ?? p.id)}</strong>
                      <div className="muted">id: {String(p.id)} · status: {String(p.status ?? "n/a")}</div>
                    </article>
                  ))}
                </div>
              </section>
            )}

            {tab === "orders" && (
              <section className="panel">
                <h2>Seller orders</h2>
                {orders.length === 0 ? <p className="muted">No orders yet.</p> : orders.map((o) => (
                  <article className="record" key={String(o.id)}>
                    <strong>{String(o.id)}</strong>
                    <div className="muted">status: {String(o.status)} · subtotal: {String(o.subtotalPesewas)}p</div>
                  </article>
                ))}
              </section>
            )}
          </>
        )}
      </main>
    </div>
  )
}

const root = document.getElementById("root")
if (!root) throw new Error("missing root")
createRoot(root).render(<StrictMode><App /></StrictMode>)
