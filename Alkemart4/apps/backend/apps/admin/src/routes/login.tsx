import { createFileRoute } from "@tanstack/react-router"
import { useState } from "react"
import { useAuth } from "../hooks/use-auth"
import { Button, Input, PasswordInput, Label, Card } from "@workspace/ui"
import { useTranslation } from "react-i18next"

export const Route = createFileRoute("/login")({
  component: LoginPage,
})

function LoginPage() {
  const { t } = useTranslation()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const { login, isLoggingIn } = useAuth()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    if (!email || !password) {
      setError("Please enter both email and password.")
      return
    }
    try {
      await login({ email, password })
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Login failed")
    }
  }

  return (
    <div className="min-h-[100dvh] flex flex-col bg-ink items-center justify-center p-4 text-ink-foreground">
      <div className="w-full max-w-sm flex flex-col items-center">
        <div className="mb-8 text-center">
          <div className="mb-4">
            <span className="text-3xl font-extrabold tracking-tight text-ink-foreground">
              alkemart<span className="text-primary">.</span>
            </span>
          </div>
          <h1 className="text-2xl font-black text-ink-foreground tracking-tight">{t("login.title")}</h1>
          <p className="text-ink-foreground/60 mt-2 font-medium">{t("login.hint")}</p>
        </div>

        <Card className="w-full bg-card border-none shadow-xl rounded-2xl p-6 sm:p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm font-semibold border border-destructive/20 text-center" role="alert">
                {error}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="admin-email">{t("login.email")}</Label>
              <Input
                id="admin-email"
                type="email"
                placeholder="admin@alkemart.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="admin-password">{t("login.password")}</Label>
              <PasswordInput
                id="admin-password"
                name="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </div>
            <Button
              type="submit"
              className="w-full h-12 text-base"
              isLoading={isLoggingIn}
            >
              Sign in
            </Button>
          </form>
        </Card>
      </div>
    </div>
  )
}
