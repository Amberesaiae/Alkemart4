import { useState } from "react"
import { createFileRoute, Link } from "@tanstack/react-router"
import { useMutation } from "@tanstack/react-query"
import { HugeiconsIcon } from "@hugeicons/react"
import { Mail01Icon } from "@hugeicons/core-free-icons"
import { Button } from "@/components/ui/button"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { PageSeo } from "@/components/seo/page-seo"
import { requestPasswordReset } from "@/lib/account"
import { workosEnabled, workosBrowser } from "@/lib/workos"
import { WorkosSignIn } from "@workspace/console-ui/components/workos-sign-in"

export const Route = createFileRoute("/forgot-password")({ component: ForgotPasswordPage })

function ForgotPasswordPage() {
  const [email, setEmail] = useState("")
  const send = useMutation({ mutationFn: () => requestPasswordReset(email) })
  if (workosEnabled) return <div className="container-page max-w-md py-10"><WorkosSignIn browser={workosBrowser} /><p className="mt-6 text-sm text-muted-foreground">You don’t need a password any more: sign in with Google or an emailed code. If your old account isn’t connected yet and you’ve lost its password, contact support and we’ll help you recover it.</p></div>
  return (
    <div className="container-page flex max-w-md flex-col gap-6 py-10">
      <PageSeo title="Reset your password" noindex />
      {send.isSuccess ? (
        <div className="space-y-4 text-center" role="status">
          <span className="mx-auto grid size-14 place-items-center rounded-full bg-brand">
            <HugeiconsIcon icon={Mail01Icon} className="size-7" aria-hidden />
          </span>
          <h1 className="text-2xl font-extrabold">Check your email</h1>
          <p className="text-muted-foreground">
            If <strong className="text-foreground">{email}</strong> has an alkemart account, a reset link is on its way. It works once and expires in an hour.
          </p>
          <p className="text-sm text-muted-foreground">Nothing after a few minutes? Check spam, or try again.</p>
          <Button variant="outline" size="lg" onClick={() => send.reset()}>
            Use a different email
          </Button>
        </div>
      ) : (
        <>
          <div className="space-y-2">
            <h1 className="text-2xl font-extrabold">Forgot your password?</h1>
            <p className="text-muted-foreground">Enter the email you shop with and we'll send you a link to choose a new one.</p>
          </div>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault()
              if (email.includes("@")) send.mutate()
            }}
          >
            {send.isError ? (
              <p role="alert" className="rounded-2xl bg-destructive/10 p-3 text-sm font-medium text-destructive">
                {(send.error as { status?: number }).status === 429
                  ? "Too many tries. Wait a minute and try again."
                  : (send.error as { status?: number }).status == null
                    ? "No connection. Check your data or Wi-Fi and try again."
                    : "Something went wrong. Please try again."}
              </p>
            ) : null}
            <Field>
              <FieldLabel htmlFor="fp-email">Email</FieldLabel>
              <Input id="fp-email" type="email" autoComplete="email" inputMode="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="h-11" />
            </Field>
            <Button type="submit" size="lg" className="w-full" disabled={send.isPending}>
              {send.isPending ? <Spinner /> : null}
              Send reset link
            </Button>
          </form>
        </>
      )}
      <p className="text-center text-sm text-muted-foreground">
        Remembered it?{" "}
        <Link to="/login" className="font-semibold text-foreground underline underline-offset-4">
          Sign in
        </Link>
      </p>
    </div>
  )
}
