import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useState } from "react"
import { useRegister } from "../lib/auth"
import { Button, PasswordInput, Input, Label, Card } from "@workspace/ui"

export const Route = createFileRoute('/register')({
  component: RegisterPage,
})

function RegisterPage() {
  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    email: "",
    password: "",
    confirm_password: "",
  })
  const register = useRegister()
  const navigate = useNavigate()

  const [passwordError, setPasswordError] = useState("")

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (formData.password !== formData.confirm_password) {
      setPasswordError("Passwords do not match")
      return
    }
    setPasswordError("")
    register.mutate(formData, {
      onSuccess: () => {
        setPasswordError("")
        navigate({ to: "/" })
      }
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
          <h1 className="text-2xl font-black text-white tracking-tight">Claim Your Stall</h1>
          <p className="text-white/60 mt-2 font-medium">Start selling on Alkemart today.</p>
        </div>

        <Card className="w-full bg-card border-none shadow-xl rounded-2xl p-6 sm:p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            {register.isError && (
              <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm font-semibold border border-destructive/20 text-center">
                {register.error instanceof Error ? register.error.message : "Could not register. Try a different email."}
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
              <PasswordInput 
                id="password" 
                value={formData.password}
                onChange={e => setFormData({ ...formData, password: e.target.value })}
                required 
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm_password">Confirm Password</Label>
              <PasswordInput 
                id="confirm_password" 
                value={formData.confirm_password}
                onChange={e => setFormData({ ...formData, confirm_password: e.target.value })}
                required 
              />
              {passwordError && (
                <p className="text-sm text-destructive font-semibold">{passwordError}</p>
              )}
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