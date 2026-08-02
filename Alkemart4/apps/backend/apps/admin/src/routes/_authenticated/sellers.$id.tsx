import { createFileRoute } from "@tanstack/react-router"
import { useState } from "react"
import { useAdminSellerDetail, useSellerActions } from "../../hooks/use-sellers-admin"
import { Card, CardContent, CardHeader, CardTitle, Badge, Button, Skeleton, Input, Modal, Textarea } from "@workspace/ui"
import { PageShell } from "../../components/page-shell"
import { ArrowLeft, Store, Mail, Phone, MapPin, Calendar, Ban, CheckCircle2, UserX, Percent } from "lucide-react"

export const Route = createFileRoute("/_authenticated/sellers/$id")({
  component: SellerDetailPage,
})

function SellerDetailPage() {
  const { id } = Route.useParams()
  const { data, isLoading, isError } = useAdminSellerDetail(id)
  const actions = useSellerActions(id)

  // Dialog state
  const [suspendDialog, setSuspendDialog] = useState(false)
  const [terminateDialog, setTerminateDialog] = useState(false)
  const [commissionDialog, setCommissionDialog] = useState(false)
  const [suspendReason, setSuspendReason] = useState("")
  const [terminateReason, setTerminateReason] = useState("")
  const [commissionPct, setCommissionPct] = useState("")

  if (isLoading) {
    return (
      <PageShell>
        <Skeleton className="h-8 w-48 mb-2" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2"><Skeleton className="h-64 w-full" /></Card>
          <Card><Skeleton className="h-48 w-full" /></Card>
        </div>
      </PageShell>
    )
  }

  if (isError || !data?.seller) {
    return (
      <PageShell>
        <div className="bg-destructive/10 text-destructive p-4 rounded-md">Failed to load seller details.</div>
      </PageShell>
    )
  }

  const seller = data.seller
  const statusVariant = seller.status === "open" ? "success" : seller.status === "suspended" ? "destructive" : "warning"

  const handleSuspend = async () => {
    if (!suspendReason.trim()) return
    await actions.suspend.mutateAsync(suspendReason)
    setSuspendDialog(false)
    setSuspendReason("")
  }

  const handleTerminate = async () => {
    if (!terminateReason.trim()) return
    await actions.terminate.mutateAsync(terminateReason)
    setTerminateDialog(false)
    setTerminateReason("")
  }

  const handleCommission = async () => {
    const bps = Math.round(parseFloat(commissionPct) * 100)
    if (isNaN(bps) || bps < 0) return
    await actions.setCommission.mutateAsync(bps)
    setCommissionDialog(false)
    setCommissionPct("")
  }

  return (
    <PageShell>
      <Button variant="ghost" size="sm" onClick={() => window.history.back()} className="mb-4 -ml-2">
        <ArrowLeft className="h-4 w-4 mr-2" /> Back
      </Button>

      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <div className="h-16 w-16 rounded-xl bg-muted flex items-center justify-center shrink-0 border">
            <Store className="h-8 w-8 text-muted-foreground" />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold">{seller.name || "Unnamed Shop"}</h1>
              <Badge variant={statusVariant} className="capitalize">{seller.status?.replace("_", " ")}</Badge>
            </div>
            <p className="text-muted-foreground">@{seller.handle}</p>
          </div>
        </div>

        {/* Lifecycle action buttons */}
        <div className="flex gap-2 flex-wrap justify-end">
          {seller.status === "pending_approval" && (
            <Button
              size="sm"
              onClick={() => actions.approve.mutateAsync()}
              isLoading={actions.approve.isPending}
              className="gap-1"
            >
              <CheckCircle2 className="h-4 w-4" />
              Approve
            </Button>
          )}
          {seller.status === "open" && (
            <Button
              size="sm"
              variant="outline"
              className="text-warning border-warning/30 hover:bg-warning/10"
              onClick={() => setSuspendDialog(true)}
            >
              <Ban className="h-4 w-4 mr-1" />
              Suspend
            </Button>
          )}
          {seller.status === "suspended" && (
            <Button
              size="sm"
              variant="outline"
              className="text-success border-success/30 hover:bg-success/10"
              onClick={() => actions.unsuspend.mutateAsync()}
              isLoading={actions.unsuspend.isPending}
            >
              <CheckCircle2 className="h-4 w-4 mr-1" />
              Unsuspend
            </Button>
          )}
          {seller.status !== "terminated" && (
            <Button
              size="sm"
              variant="outline"
              className="text-muted-foreground"
              onClick={() => setCommissionDialog(true)}
            >
              <Percent className="h-4 w-4 mr-1" />
              Commission
            </Button>
          )}
          {seller.status !== "terminated" && (
            <Button
              size="sm"
              variant="destructive"
              onClick={() => setTerminateDialog(true)}
            >
              <UserX className="h-4 w-4 mr-1" />
              Terminate
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Seller Information</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex items-center gap-3">
                <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                <div>
                  <p className="text-sm text-muted-foreground">Email</p>
                  <p className="font-medium">{seller.email || "-"}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                <div>
                  <p className="text-sm text-muted-foreground">Phone</p>
                  <p className="font-medium">{seller.phone || "-"}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                <div>
                  <p className="text-sm text-muted-foreground">Member Since</p>
                  <p className="font-medium">{new Date(seller.created_at).toLocaleDateString()}</p>
                </div>
              </div>
              {seller.approved_at && (
                <div className="flex items-center gap-3">
                  <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div>
                    <p className="text-sm text-muted-foreground">Approved</p>
                    <p className="font-medium">{new Date(seller.approved_at).toLocaleDateString()}</p>
                  </div>
                </div>
              )}
            </div>
            {seller.description && (
              <div className="pt-4 border-t">
                <p className="text-sm text-muted-foreground mb-1">Description</p>
                <p>{seller.description}</p>
              </div>
            )}
            {seller.status_reason && (
              <div className="pt-4 border-t">
                <p className="text-sm text-muted-foreground mb-1">Status Reason</p>
                <p className="text-destructive">{seller.status_reason}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle>Address</CardTitle></CardHeader>
            <CardContent>
              {seller.address ? (
                <div className="space-y-1 text-sm">
                  <div className="flex items-start gap-3">
                    <MapPin className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                    <div>
                      {seller.address.address_1 && <p>{seller.address.address_1}</p>}
                      {seller.address.address_2 && <p>{seller.address.address_2}</p>}
                      <p>{[seller.address.city, seller.address.province].filter(Boolean).join(", ")}</p>
                      {seller.address.country_code && <p className="uppercase">{seller.address.country_code}</p>}
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No address on file</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Team Members</CardTitle></CardHeader>
            <CardContent>
              {seller.members && seller.members.length > 0 ? (
                <ul className="space-y-3">
                  {seller.members.map((m) => (
                    <li key={m.id} className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">
                          {m.member.first_name} {m.member.last_name}
                        </p>
                        <p className="text-xs text-muted-foreground">{m.member.email}</p>
                      </div>
                      {m.is_owner && <Badge variant="success" className="text-xs">Owner</Badge>}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">No members</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Suspend dialog */}
      <Modal isOpen={suspendDialog} onClose={() => setSuspendDialog(false)}>
        <div className="p-6 space-y-4">
          <h3 className="text-lg font-semibold">Suspend Seller</h3>
          <p className="text-sm text-muted-foreground">Seller will be unable to create new orders. Provide a reason.</p>
          <Textarea
            placeholder="Reason for suspension…"
            value={suspendReason}
            onChange={e => setSuspendReason(e.target.value)}
            className="h-24"
            autoFocus
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setSuspendDialog(false)}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={!suspendReason.trim()}
              isLoading={actions.suspend.isPending}
              onClick={handleSuspend}
            >
              Suspend
            </Button>
          </div>
        </div>
      </Modal>

      {/* Terminate dialog */}
      <Modal isOpen={terminateDialog} onClose={() => setTerminateDialog(false)}>
        <div className="p-6 space-y-4">
          <h3 className="text-lg font-semibold text-destructive">Terminate Seller Account</h3>
          <p className="text-sm text-muted-foreground">
            <strong>This is irreversible.</strong> The seller will lose access and their listings will be removed. Provide a reason.
          </p>
          <Textarea
            placeholder="Reason for termination…"
            value={terminateReason}
            onChange={e => setTerminateReason(e.target.value)}
            className="h-24"
            autoFocus
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setTerminateDialog(false)}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={!terminateReason.trim()}
              isLoading={actions.terminate.isPending}
              onClick={handleTerminate}
            >
              Terminate Account
            </Button>
          </div>
        </div>
      </Modal>

      {/* Commission dialog */}
      <Modal isOpen={commissionDialog} onClose={() => setCommissionDialog(false)}>
        <div className="p-6 space-y-4">
          <h3 className="text-lg font-semibold">Set Custom Commission Rate</h3>
          <p className="text-sm text-muted-foreground">Override the platform default commission for this seller (percentage, e.g. 8.5 for 8.5%).</p>
          <div className="relative">
            <Input
              type="number"
              placeholder="e.g. 8.5"
              value={commissionPct}
              onChange={e => setCommissionPct(e.target.value)}
              min="0"
              max="100"
              step="0.1"
              className="pr-10"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-bold text-muted-foreground">%</span>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setCommissionDialog(false)}>Cancel</Button>
            <Button
              disabled={!commissionPct.trim() || isNaN(parseFloat(commissionPct))}
              isLoading={actions.setCommission.isPending}
              onClick={handleCommission}
            >
              Save Rate
            </Button>
          </div>
        </div>
      </Modal>
    </PageShell>
  )
}
