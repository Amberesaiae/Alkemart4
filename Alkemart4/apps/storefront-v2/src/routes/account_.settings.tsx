import { useState } from "react"
import { createFileRoute, Link } from "@tanstack/react-router"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { ErrorState } from "@/components/feedback/states"
import { PageSeo } from "@/components/seo/page-seo"
import { changePassword, getAccount, updateAccount, type Account } from "@/lib/account"
import { useMarket } from "@/lib/market"
import { requireAuth } from "@/lib/route-guards"

export const Route = createFileRoute("/account_/settings")({
  beforeLoad: () => requireAuth(),
  component: SettingsPage,
})

const accountKey = ["store", "account"] as const

function message(err: unknown, fallback: string) {
  const e = err as { status?: number; message?: string }
  return e.status == null ? "No connection — nothing changed. Try again." : e.message || fallback
}

function SettingsPage() {
  const q = useQuery({ queryKey: accountKey, queryFn: getAccount })
  return (
    <div className="container-page max-w-2xl space-y-6 pt-4 sm:pt-6">
      <PageSeo title="Profile & security" noindex />
      <div>
        <Link to="/account" className="inline-flex min-h-11 items-center text-sm font-semibold text-muted-foreground hover:text-foreground">
          ← Account
        </Link>
        <h1 className="text-2xl font-extrabold sm:text-3xl">Profile & security</h1>
      </div>
      {q.isPending ? (
        <Skeleton className="h-72 rounded-3xl" />
      ) : q.isError ? (
        <ErrorState title="Your profile didn't load" error={q.error} onRetry={() => void q.refetch()} />
      ) : (
        <>
          <ProfileForm key={q.data.email} account={q.data} />
          <PasswordForm />
        </>
      )}
    </div>
  )
}

function ProfileForm({ account }: { account: Account }) {
  const qc = useQueryClient()
  const market = useMarket()
  const [v, setV] = useState({ firstName: account.firstName ?? "", lastName: account.lastName ?? "", phone: account.phone ?? "" })
  const dirty = v.firstName !== (account.firstName ?? "") || v.lastName !== (account.lastName ?? "") || v.phone !== (account.phone ?? "")
  const save = useMutation({
    mutationFn: () =>
      updateAccount({ firstName: v.firstName.trim() || null, lastName: v.lastName.trim() || null, phone: v.phone.trim() || null }),
    onSuccess: (a) => {
      qc.setQueryData(accountKey, a)
      toast.success("Profile saved")
    },
  })
  return (
    <section aria-labelledby="profile-title" className="space-y-4 rounded-3xl border border-border p-4 sm:p-6">
      <div>
        <h2 id="profile-title" className="text-lg font-bold">
          Profile
        </h2>
        <p className="text-sm text-muted-foreground">Fills in checkout for you. Your email is {account.email}.</p>
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          save.mutate()
        }}
        className="space-y-4"
      >
        {save.isError ? (
          <p role="alert" className="rounded-2xl bg-destructive/10 p-3 text-sm font-medium text-destructive">
            {message(save.error, "Couldn't save your profile.")}
          </p>
        ) : null}
        <FieldGroup className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="p-first">First name</FieldLabel>
            <Input id="p-first" autoComplete="given-name" value={v.firstName} onChange={(e) => setV({ ...v, firstName: e.target.value })} />
          </Field>
          <Field>
            <FieldLabel htmlFor="p-last">Last name</FieldLabel>
            <Input id="p-last" autoComplete="family-name" value={v.lastName} onChange={(e) => setV({ ...v, lastName: e.target.value })} />
          </Field>
          <Field className="sm:col-span-2">
            <FieldLabel htmlFor="p-phone">Phone</FieldLabel>
            <Input
              id="p-phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder={market.phone.example}
              value={v.phone}
              onChange={(e) => setV({ ...v, phone: e.target.value })}
            />
            <FieldDescription>Used for delivery updates. We never show it publicly.</FieldDescription>
          </Field>
        </FieldGroup>
        <Button type="submit" size="lg" disabled={!dirty || save.isPending}>
          {save.isPending ? <Spinner /> : null}
          Save profile
        </Button>
      </form>
    </section>
  )
}

function PasswordForm() {
  const [current, setCurrent] = useState("")
  const [next, setNext] = useState("")
  const [confirm, setConfirm] = useState("")
  const [tried, setTried] = useState(false)
  const tooShort = next.length > 0 && next.length < 8
  const mismatch = confirm.length > 0 && next !== confirm
  const change = useMutation({
    mutationFn: () => changePassword(current, next),
    onSuccess: () => {
      setCurrent("")
      setNext("")
      setConfirm("")
      setTried(false)
      toast.success("Password changed. Other devices will need to sign in again.")
    },
  })
  return (
    <section aria-labelledby="password-title" className="space-y-4 rounded-3xl border border-border p-4 sm:p-6">
      <div>
        <h2 id="password-title" className="text-lg font-bold">
          Password
        </h2>
        <p className="text-sm text-muted-foreground">Changing it signs you out everywhere else.</p>
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          setTried(true)
          if (!current || next.length < 8 || next !== confirm) return
          change.mutate()
        }}
        className="space-y-4"
        noValidate
      >
        {change.isError ? (
          <p role="alert" className="rounded-2xl bg-destructive/10 p-3 text-sm font-medium text-destructive">
            {message(change.error, "Couldn't change your password.")}
          </p>
        ) : null}
        <FieldGroup className="gap-4">
          <Field data-invalid={(tried && !current) || undefined}>
            <FieldLabel htmlFor="pw-current">Current password</FieldLabel>
            <Input id="pw-current" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} aria-invalid={tried && !current} />
          </Field>
          <Field data-invalid={((tried || tooShort) && next.length < 8) || undefined}>
            <FieldLabel htmlFor="pw-new">New password</FieldLabel>
            <Input id="pw-new" type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} aria-describedby="pw-new-hint" aria-invalid={tried && next.length < 8} />
            <FieldDescription id="pw-new-hint">{tooShort ? "Use at least 8 characters." : "At least 8 characters."}</FieldDescription>
          </Field>
          <Field data-invalid={(tried || mismatch) && next !== confirm ? true : undefined}>
            <FieldLabel htmlFor="pw-confirm">Type it again</FieldLabel>
            <Input id="pw-confirm" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} aria-invalid={mismatch} />
            {mismatch ? <FieldDescription className="text-destructive">The two passwords don't match.</FieldDescription> : null}
          </Field>
        </FieldGroup>
        <Button type="submit" size="lg" disabled={change.isPending}>
          {change.isPending ? <Spinner /> : null}
          Change password
        </Button>
      </form>
    </section>
  )
}
