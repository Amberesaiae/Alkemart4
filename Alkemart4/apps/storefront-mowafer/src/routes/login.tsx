import { useState } from "react"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Button, Input, Label } from "@workspace/ui"
import { login, register } from "@/lib/auth"

export const Route = createFileRoute("/login")({
  validateSearch: (search: Record<string, unknown>): { redirect?: string } => ({
    redirect: typeof search.redirect === "string" ? search.redirect : undefined,
  }),
  component: SignInPage,
})

function SignInPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { redirect } = Route.useSearch()
  const [mode, setMode] = useState<"login" | "register">("login")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")

  const auth = useMutation({
    mutationFn: () =>
      mode === "login" ? login(email, password) : register({ email, password }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["store"] })
      const to = redirect && redirect.startsWith("/") ? redirect : "/"
      if (to === "/checkout" || to === "/cart") void navigate({ to })
      else void navigate({ to: "/" })
    },
  })

  return (
    <div className="mx-auto max-w-md space-y-5">
      <h1 className="text-2xl font-bold tracking-tight">{mode === "login" ? "Sign in" : "Create account"}</h1>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault()
          auth.mutate()
        }}
      >
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">Password</Label>
          <Input id="password" type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        {auth.error ? (
          <p className="text-sm text-destructive">
            {auth.error instanceof Error ? auth.error.message : "Auth failed"}
          </p>
        ) : null}
        <Button type="submit" className="w-full rounded-full" isLoading={auth.isPending}>
          {mode === "login" ? "Sign in" : "Create account"}
        </Button>
      </form>
      <Button
        type="button"
        variant="link"
        onClick={() => setMode(mode === "login" ? "register" : "login")}
      >
        {mode === "login" ? "Need an account? Register" : "Have an account? Sign in"}
      </Button>
    </div>
  )
}
