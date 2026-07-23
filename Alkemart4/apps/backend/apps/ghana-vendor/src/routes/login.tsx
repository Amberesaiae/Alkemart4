import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useState } from "react"
import { useLogin } from "../lib/auth"
import { Button, Input, Label, Card } from "../components/ui"

export const Route = createFileRoute('/login')({
  component: LoginPage,
})

function LoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const login = useLogin()
  const navigate = useNavigate()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    login.mutate({ email, password }, {
      onSuccess: () => navigate({ to: "/" })
    })
  }

  return (
    <div className="min-h-[100dvh] flex flex-col bg-[#1a1a1a] items-center justify-center p-4 text-white">
      <div className="w-full max-w-sm flex flex-col items-center">
        <div className="mb-8 text-center">
          <div className="h-16 w-16 bg-primary rounded-2xl mx-auto flex items-center justify-center text-primary-foreground font-black text-3xl mb-4 shadow-lg rotate-3">
            A
          </div>
          <h1 className="text-3xl font-black text-white tracking-tight">Vendor Portal</h1>
          <p className="text-white/60 mt-2 font-medium">Manage your Alkemart stall</p>
        </div>

        <Card className="w-full bg-card border-none shadow-xl rounded-2xl p-6 sm:p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            {login.isError && (
              <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm font-semibold border border-destructive/20 text-center">
                Invalid credentials. Please try again.
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
              <Input 
                id="password" 
                type="password" 
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