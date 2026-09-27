import { useState } from "react"
import { createFileRoute, Link } from "@tanstack/react-router"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { HugeiconsIcon } from "@hugeicons/react"
import { Add01Icon, Call02Icon, Delete02Icon, Edit02Icon, Location01Icon, StarIcon } from "@hugeicons/core-free-icons"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { AddressForm } from "@/components/account/address-form"
import { EmptyState, ErrorState } from "@/components/feedback/states"
import { PageSeo } from "@/components/seo/page-seo"
import { useMediaQuery } from "@/hooks/use-media-query"
import {
  addressSummary,
  createAddress,
  deleteAddress,
  getAccount,
  listAddresses,
  setDefaultAddress,
  updateAddress,
  type AddressDraft,
  type SavedAddress,
} from "@/lib/account"
import { requireAuth } from "@/lib/route-guards"

export const Route = createFileRoute("/account_/addresses")({
  beforeLoad: () => requireAuth(),
  component: AddressesPage,
})

export const addressesKey = ["store", "account", "addresses"] as const

function errorText(err: unknown) {
  const e = err as { status?: number; message?: string }
  return e.status == null ? "No connection — nothing was saved. Try again." : e.message || "Couldn't save the address."
}

function AddressesPage() {
  const qc = useQueryClient()
  const desktop = useMediaQuery("(min-width: 768px)")
  const q = useQuery({ queryKey: addressesKey, queryFn: listAddresses })
  const account = useQuery({ queryKey: ["store", "account"], queryFn: getAccount, staleTime: 60_000 })
  const [editing, setEditing] = useState<SavedAddress | "new" | null>(null)
  const [deleting, setDeleting] = useState<SavedAddress | null>(null)
  const done = () => void qc.invalidateQueries({ queryKey: addressesKey })

  const save = useMutation({
    mutationFn: (d: AddressDraft) => (editing && editing !== "new" ? updateAddress(editing.id, d) : createAddress(d)),
    onSuccess: () => {
      toast.success(editing === "new" ? "Address saved" : "Address updated")
      setEditing(null)
      done()
    },
  })
  const makeDefault = useMutation({
    mutationFn: (a: SavedAddress) => setDefaultAddress(a.id),
    onSuccess: () => {
      toast.success("Default address updated")
      done()
    },
    onError: (e) => toast.error(errorText(e)),
  })
  const remove = useMutation({
    mutationFn: (a: SavedAddress) => deleteAddress(a.id),
    onSuccess: () => {
      toast.success("Address removed")
      setDeleting(null)
      done()
    },
    onError: (e) => toast.error(errorText(e)),
  })

  const list = q.data ?? []

  return (
    <div className="container-page max-w-3xl space-y-5 pt-4 sm:pt-6">
      <PageSeo title="Addresses" noindex />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link to="/account" className="inline-flex min-h-11 items-center text-sm font-semibold text-muted-foreground hover:text-foreground">
            ← Account
          </Link>
          <h1 className="text-2xl font-extrabold sm:text-3xl">Addresses</h1>
          <p className="text-muted-foreground">Pick one at checkout in a tap. Riders see the phone number.</p>
        </div>
        {list.length ? (
          <Button size="lg" onClick={() => setEditing("new")}>
            <HugeiconsIcon icon={Add01Icon} data-icon="inline-start" /> Add address
          </Button>
        ) : null}
      </div>

      {q.isPending ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {[0, 1].map((i) => (
            <Skeleton key={i} className="h-40 rounded-3xl" />
          ))}
        </div>
      ) : q.isError ? (
        <ErrorState title="Your addresses didn't load" error={q.error} onRetry={() => void q.refetch()} />
      ) : list.length === 0 ? (
        <EmptyState
          title="No saved addresses yet"
          description="Save your home or work address once and checkout fills itself in."
        >
          <Button size="lg" onClick={() => setEditing("new")}>
            <HugeiconsIcon icon={Add01Icon} data-icon="inline-start" /> Add an address
          </Button>
        </EmptyState>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {list.map((a) => (
            <li key={a.id} className={`flex flex-col rounded-3xl border p-4 sm:p-5 ${a.isDefault ? "border-foreground" : "border-border"}`}>
              <div className="flex items-center justify-between gap-2">
                <p className="flex items-center gap-2 font-bold">
                  <HugeiconsIcon icon={Location01Icon} className="size-5" aria-hidden />
                  {a.label ?? "Address"}
                </p>
                {a.isDefault ? <Badge>Default</Badge> : null}
              </div>
              <address className="mt-2 flex-1 text-[15px] not-italic">
                <span className="block font-medium">
                  {a.firstName} {a.lastName}
                </span>
                <span className="block text-muted-foreground">{a.address1}</span>
                {a.address2 ? <span className="block text-muted-foreground">{a.address2}</span> : null}
                <span className="block text-muted-foreground">{[a.city, a.province].filter(Boolean).join(", ")}</span>
                <span className="mt-1 inline-flex items-center gap-1.5 text-muted-foreground">
                  <HugeiconsIcon icon={Call02Icon} className="size-4" aria-hidden /> {a.phone}
                </span>
              </address>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={() => setEditing(a)} aria-label={`Edit ${addressSummary(a)}`}>
                  <HugeiconsIcon icon={Edit02Icon} data-icon="inline-start" /> Edit
                </Button>
                {!a.isDefault ? (
                  <Button variant="outline" size="sm" onClick={() => makeDefault.mutate(a)} disabled={makeDefault.isPending}>
                    <HugeiconsIcon icon={StarIcon} data-icon="inline-start" /> Make default
                  </Button>
                ) : null}
                <Button variant="ghost" size="sm" onClick={() => setDeleting(a)} aria-label={`Remove ${addressSummary(a)}`} className="text-destructive">
                  <HugeiconsIcon icon={Delete02Icon} data-icon="inline-start" /> Remove
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Sheet open={editing !== null} onOpenChange={(o) => !o && !save.isPending && setEditing(null)}>
        <SheetContent side={desktop ? "right" : "bottom"} className="max-h-[92dvh] overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>{editing === "new" ? "Add an address" : "Edit address"}</SheetTitle>
            <SheetDescription>Riders call this number before they arrive.</SheetDescription>
          </SheetHeader>
          <div className="px-4 pb-6">
            {editing !== null ? (
              <AddressForm
                key={editing === "new" ? "new" : editing.id}
                address={editing === "new" ? null : editing}
                prefill={account.data}
                pending={save.isPending}
                error={save.isError ? errorText(save.error) : null}
                onSubmit={(d) => save.mutate(d)}
                onCancel={() => setEditing(null)}
              />
            ) : null}
          </div>
        </SheetContent>
      </Sheet>

      <Dialog open={deleting !== null} onOpenChange={(o) => !o && setDeleting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove this address?</DialogTitle>
            <DialogDescription>{deleting ? addressSummary(deleting) : null}. Past orders keep their address.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(null)}>
              Keep it
            </Button>
            <Button variant="destructive" disabled={remove.isPending} onClick={() => deleting && remove.mutate(deleting)}>
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
