import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useState } from "react"
import { useLogin } from "../lib/auth"
import { Button, PasswordInput, Input, Label, Card } from "@workspace/ui"

export const Route = createFileRoute('/login')({
  validateSearch: (search: Record<string, unknown>) => {
    const result: { redirect?: string; registered?: string } = {}
    if (typeof search.redirect === "string") result.redirect = search.redirect
    if (typeof search.registered === "string") result.registered = search.registered
    return result
  },
  component: LoginPage,
})

function LoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const login = useLogin()
  const navigate = useNavigate()
  const { redirect, registered } = Route.useSearch()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    login.mutate({ email, password }, {
      onSuccess: () => navigate({ to: redirect || "/" })
    })
  }

  return (
    <div className="min-h-[100dvh] flex flex-col bg-ink items-center justify-center p-4 text-white">
      <div className="w-full max-w-sm flex flex-col items-center">
        <div className="mb-8 text-center">
          <div className="mb-4">
            <span className="text-3xl font-extrabold tracking-tight text-white">
              alkemart<span className="text-primary">.</span>
            </span>
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">Vendor Portal</h1>
          <p className="text-white/60 mt-2 font-medium">Manage your Alkemart stall</p>
        </div>

        <Card className="w-full bg-card border-none shadow-xl rounded-2xl p-6 sm:p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            {registered && (
              <div className="p-3 rounded-lg bg-success/10 text-success text-sm font-semibold border border-success/20 text-center" role="status">
                Stall created! Sign in to start selling.
              </div>
            )}
            {login.isError && (
              <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm font-semibold border border-destructive/20 text-center" role="alert">
                {login.error instanceof Error ? login.error.message : "Invalid credentials. Please try again."}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input 
                id="email" 
                type="email" 
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com" 
                required 
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <PasswordInput 
                id="password" 
                value={password}
                onChange={e => setPassword(e.target.value)}
                required 
              />
            </div>
            <Button 
              type="submit" 
              className="w-full h-12 text-base" 
              isLoading={login.isPending}
            >
              Sign In
            </Button>
          </form>

          <div className="mt-6 text-center text-sm font-medium text-muted-foreground">
            Don't have a stall?{" "}
            <Button variant="ghost" className="p-0 h-auto font-bold text-foreground hover:bg-transparent hover:text-primary" onClick={() => navigate({ to: "/register" })}>
              Set one up
            </Button>
          </div>
        </Card>
      </div>
    </div>
  )
}