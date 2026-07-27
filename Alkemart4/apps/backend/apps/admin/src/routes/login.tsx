import { createFileRoute } from "@tanstack/react-router"
import { useState } from "react"
import { useAuth } from "../hooks/use-auth"
import { Button, Input, PasswordInput, Label, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui"
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
    try {
      await login({ email, password })
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Login failed")
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md shadow-lg border-none">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto mb-4">
            <span className="text-3xl font-extrabold tracking-tight text-foreground">
              alkemart<span className="text-primary">.</span>
            </span>
          </div>
          <CardTitle className="text-xl font-bold tracking-tight">{t("login.title")}</CardTitle>
          <CardDescription>{t("login.hint")}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4 pt-4">
            {error && (
              <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-md" role="alert">
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
              className="w-full mt-6"
              disabled={isLoggingIn}
            >
              {isLoggingIn ? "Signing in..." : "Sign in"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
