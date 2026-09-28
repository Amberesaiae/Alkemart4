import { useId, useState } from "react"
import { Link, createFileRoute } from "@tanstack/react-router"
import { useMutation } from "@tanstack/react-query"
import { Button } from "@workspace/console-ui/components/button"
import { Input } from "@workspace/console-ui/components/input"
import { Label } from "@workspace/console-ui/components/label"
import { Spinner } from "@workspace/console-ui/components/spinner"
import { AuthLayout } from "@/components/auth/auth-layout"
import { requestResetLink } from "@/lib/shop"
import { workosEnabled, workosBrowser } from "@/lib/workos"
import { WorkosSignIn } from "@workspace/console-ui/components/workos-sign-in"

export const Route = createFileRoute("/forgot-password")({ component: ForgotPasswordPage })

/**
 * Ask for a password-change link. The API answers the same way whether or
 * not the email has an account, so the page never reveals who sells here.
 */
function ForgotPasswordPage() {
  const emailId = useId()
  const [email, setEmail] = useState("")
  const send = useMutation({ mutationFn: () => requestResetLink(email.trim()) })
  if (workosEnabled) return <AuthLayout><WorkosSignIn vendor browser={workosBrowser} /><p className="mt-6 text-sm text-muted-foreground">You don’t need a password any more: sign in with Google or an emailed code. If your old shop account isn’t connected yet and you’ve lost its password, contact support and we’ll help you recover it.</p></AuthLayout>

  return (
    <AuthLayout>
      <h1 className="text-3xl font-extrabold tracking-tight">Forgot your password?</h1>
      {send.isSuccess ? (
        <div role="status" className="mt-6 space-y-4">
          <p className="text-[15px]">
            If <span className="font-semibold">{email.trim()}</span> has a seller account, a link to choose a new password is on its way. It works once, for an hour.
          </p>
          <p className="text-[15px] text-muted-foreground">Nothing after a few minutes? Check spam, or try again.</p>
          <Button variant="outline" size="lg" onClick={() => send.reset()}>
            Send another link
          </Button>
        </div>
      ) : (
        <>
          <p className="mt-2 text-muted-foreground">Enter the email you sign in with. We'll send you a link to choose a new one.</p>
          <form
            className="mt-8 space-y-5"
            onSubmit={(e) => {
              e.preventDefault()
              if (email.trim()) send.mutate()
            }}
          >
            {send.isError ? (
              <p role="alert" className="rounded-xl bg-danger-soft p-3 text-sm font-medium text-destructive">
                {(send.error as { status?: number }).status == null
                  ? "No connection. Check your data or Wi-Fi and try again."
                  : "Couldn't send the link. Try again in a minute."}
              </p>
            ) : null}
            <div className="space-y-2">
              <Label htmlFor={emailId}>Email</Label>
              <Input
                id={emailId}
                type="email"
                autoComplete="email"
                inputMode="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-12 text-base"
              />
            </div>
            <Button type="submit" variant="brand" size="xl" className="w-full" disabled={send.isPending}>
              {send.isPending ? <Spinner /> : null}
              Send me a link
            </Button>
          </form>
        </>
      )}
      <p className="mt-8 text-center text-[15px] text-muted-foreground">
        Remembered it?{" "}
        <Link to="/login" className="font-semibold text-foreground underline underline-offset-4">
          Sign in
        </Link>
      </p>
    </AuthLayout>
  )
}
