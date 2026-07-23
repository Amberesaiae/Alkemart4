import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useState } from "react"
import { useRegister } from "../lib/auth"
import { Button, Input, Label, Card } from "../components/ui"

export const Route = createFileRoute('/register')({
  component: RegisterPage,
})

function RegisterPage() {
  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    email: "",
    password: "",
  })
  const register = useRegister()
  const navigate = useNavigate()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    register.mutate(formData, {
      onSuccess: () => navigate({ to: "/" })
    })
  }

  return (
    <div className="min-h-[100dvh] flex flex-col bg-[#1a1a1a] items-center justify-center p-4 text-white">
      <div className="w-full max-w-sm flex flex-col items-center">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-black text-white tracking-tight">Claim Your Stall</h1>
          <p className="text-white/60 mt-2 font-medium">Start selling on Alkemart today.</p>
        </div>

        <Card className="w-full bg-card border-none shadow-xl rounded-2xl p-6 sm:p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            {register.isError && (
              <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm font-semibold border border-destructive/20 text-center">
                Could not register. Try a different email.
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="first_name">First Name</Label>
                <Input 
                  id="first_name" 
                  value={formData.first_name}
                  onChange={e => setFormData({ ...formData, first_name: e.target.value })}
                  required 
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="last_name">Last Name</Label>
                <Input 
                  id="last_name" 
                  value={formData.last_name}
                  onChange={e => setFormData({ ...formData, last_name: e.target.value })}
                  required 
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input 
                id="email" 
                type="email" 
                value={formData.email}
                onChange={e => setFormData({ ...formData, email: e.target.value })}
                required 
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input 
                id="password" 
                type="password" 
                value={formData.password}
                onChange={e => setFormData({ ...formData, password: e.target.value })}
                required 
              />
            </div>
            <Button 
              type="submit" 
              className="w-full h-12 text-base" 
              isLoading={register.isPending}
            >
              Open Shop
            </Button>
          </form>

          <div className="mt-6 text-center text-sm font-medium text-muted-foreground">
            Already have a stall?{" "}
            <Button variant="ghost" className="p-0 h-auto font-bold text-foreground hover:bg-transparent hover:text-primary" onClick={() => navigate({ to: "/login" })}>
              Sign in
            </Button>
          </div>
        </Card>
      </div>
    </div>
  )
}