import { StrictMode, useEffect, useState } from "react"
import { createRoot } from "react-dom/client"
import {
  API_URL,
  approveProduct,
  approveSeller,
  clearSession,
  getSessionUser,
  listSellers,
  loginAdmin,
  suspendSeller,
  type Seller,
  type SessionUser,
} from "./api"
import "./styles.css"

function App() {
  const [user, setUser] = useState<SessionUser | null>(getSessionUser())
  const [email, setEmail] = useState("admin@alkemart.test")
  const [password, setPassword] = useState("AdminPass1")
  const [sellers, setSellers] = useState<Seller[]>([])
  const [productId, setProductId] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const refresh = async () => {
    if (!user) return
    setError(null)
    try {
      const res = await listSellers()
      setSellers(res.items ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load sellers")
    }
  }

  useEffect(() => {
    void refresh()
  }, [user])

  const submitLogin = async (event: React.FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const next = await loginAdmin(email, password)
      setUser(next)
      setNotice("Signed in as admin.")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed")
    } finally {
      setBusy(false)
    }
  }

  const onApprove = async (id: string) => {
    setBusy(true)
    setError(null)
    try {
      await approveSeller(id)
      setNotice(`Approved seller ${id}`)
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Approve failed")
    } finally {
      setBusy(false)
    }
  }

  const onSuspend = async (id: string) => {
    setBusy(true)
    setError(null)
    try {
      await suspendSeller(id)
      setNotice(`Suspended seller ${id}`)
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Suspend failed")
    } finally {
      setBusy(false)
    }
  }

  const onApproveProduct = async (event: React.FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await approveProduct(productId.trim())
      setNotice(`Approved product ${productId}`)
      setProductId("")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Product approve failed")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="shell">
      <header className="topbar">
        <a className="brand" href="/">
          alkemart<span>.</span> admin
        </a>
        <div>
          {user ? (
            <>
              <span className="muted" style={{ marginRight: 12 }}>{user.email}</span>
              <button className="button ghost" type="button" onClick={() => { clearSession(); setUser(null); setSellers([]) }}>
                Sign out
              </button>
            </>
          ) : null}
        </div>
      </header>
      <main className="content">
        <h1>Operations</h1>
        <p className="lede">
          Workers API at <code>{API_URL}</code>. Admin accounts are provisioned (no public sign-up).
        </p>
        {error && <p className="alert error">{error}</p>}
        {notice && <p className="alert success">{notice}</p>}

        {!user ? (
          <section className="panel">
            <h2>Admin sign in</h2>
            <form className="stack" onSubmit={(e) => void submitLogin(e)}>
              <label>Email<input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
              <label>Password<input required minLength={8} type="password" value={password} onChange={(e) => setPassword(e.target.value)} /></label>
              <button className="button primary" disabled={busy} type="submit">{busy ? "Signing in…" : "Sign in"}</button>
            </form>
          </section>
        ) : (
          <>
            <section className="panel">
              <h2>Sellers</h2>
              {sellers.length === 0 ? <p className="muted">No sellers yet.</p> : sellers.map((s) => (
                <article className="record" key={s.id}>
                  <div>
                    <strong>{s.name}</strong>
                    <div className="muted">@{s.handle} · {s.id}</div>
                    <span className={`status ${s.status === "open" ? "open" : ""}`}>{s.status}</span>
                  </div>
                  <div className="actions">
                    {s.status !== "open" && (
                      <button className="button primary" type="button" disabled={busy} onClick={() => void onApprove(s.id)}>
                        Approve
                      </button>
                    )}
                    {s.status === "open" && (
                      <button className="button danger" type="button" disabled={busy} onClick={() => void onSuspend(s.id)}>
                        Suspend
                      </button>
                    )}
                  </div>
                </article>
              ))}
            </section>
            <section className="panel">
              <h2>Approve product by id</h2>
              <p className="muted">Paste a product id from the vendor workspace after create.</p>
              <form className="stack" onSubmit={(e) => void onApproveProduct(e)}>
                <label>Product id<input required value={productId} onChange={(e) => setProductId(e.target.value)} placeholder="prod-…" /></label>
                <button className="button primary" disabled={busy} type="submit">Approve product</button>
              </form>
            </section>
          </>
        )}
      </main>
    </div>
  )
}

const root = document.getElementById("root")
if (!root) throw new Error("missing root")
createRoot(root).render(<StrictMode><App /></StrictMode>)
