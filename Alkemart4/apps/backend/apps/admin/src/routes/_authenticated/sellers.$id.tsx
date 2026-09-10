import { createFileRoute, Link } from "@tanstack/react-router"
import { useState } from "react"
import { useAdminSellerDetail, useAdminSellerProducts, useSellerActions } from "../../hooks/use-sellers-admin"
import { Card, CardContent, CardHeader, CardTitle, Badge, Button, Skeleton, Input, Modal, Textarea, Tabs, TabsList, TabsTrigger, TabsContent, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, EmptyState } from "@workspace/ui"
import { PageShell } from "../../components/page-shell"
import { ArrowLeft, Storefront, Envelope, Phone, MapPin, CalendarBlank, Prohibit, CheckCircle, UserMinus, Percent, Wallet } from "@phosphor-icons/react"

export const Route = createFileRoute("/_authenticated/sellers/$id")({
  component: SellerDetailPage,
})

function SellerDetailPage() {
  const { id } = Route.useParams()
  const { data, isLoading, isError } = useAdminSellerDetail(id)
  const { products, specialisations, isLoading: productsLoading } = useAdminSellerProducts(id)
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
        <Skeleton className="h-44 w-full rounded-xl mb-6" />
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
  const counts = (data as { counts?: { products: Record<string, number>; orders: Record<string, number>; members: number } }).counts
  const recentOrders = (data as { recentOrders?: { id: string; status: string; subtotalPesewas: string }[] }).recentOrders ?? []
  const momo = (seller as { momo?: { provider: string | null; phone: string | null; recipient: boolean } | null }).momo
  const productTotal = counts ? Object.values(counts.products).reduce((a, b) => a + b, 0) : null
  const orderTotal = counts ? Object.values(counts.orders).reduce((a, b) => a + b, 0) : null
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

      {/* Hero: cover + identity + lifecycle actions */}
      <div className="rounded-xl border bg-card overflow-hidden mb-6">
        <div className="h-36 sm:h-44 bg-muted relative">
          {seller.banner ? (
            <img src={seller.banner} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="h-full w-full bg-ink" aria-hidden />
          )}
        </div>
        <div className="px-6 pb-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex items-end gap-4">
              <div className="h-16 w-16 rounded-xl bg-card border shadow-sm flex items-center justify-center shrink-0 overflow-hidden -mt-8 relative">
                {seller.logo ? (
                  <img src={seller.logo} alt={`${seller.name || "Shop"} logo`} className="h-full w-full object-cover" />
                ) : (
                  <Storefront className="h-8 w-8 text-muted-foreground" />
                )}
              </div>
              <div className="pb-1">
                <div className="flex items-center gap-3 flex-wrap">
                  <h1 className="text-2xl font-bold">{seller.name || "Unnamed Shop"}</h1>
                  <Badge variant={statusVariant} className="capitalize">{seller.status?.replace("_", " ")}</Badge>
                </div>
                <p className="text-muted-foreground">@{seller.handle}</p>
                {counts ? (
                  <p className="text-sm text-muted-foreground mt-1">
                    {productTotal} product{productTotal === 1 ? "" : "s"} · {orderTotal} order{orderTotal === 1 ? "" : "s"} · {counts.members} member{counts.members === 1 ? "" : "s"}
                  </p>
                ) : null}
              </div>
            </div>

            {/* Lifecycle action buttons */}
            <div className="flex gap-2 flex-wrap">
              {seller.status === "pending_approval" && (
                <Button
                  size="sm"
                  onClick={() => actions.approve.mutateAsync()}
                  isLoading={actions.approve.isPending}
                  className="gap-1"
                >
                  <CheckCircle className="h-4 w-4" />
                  Approve
                </Button>
              )}
              {seller.status === "open" && (
                <Button
                  size="sm"
                  className="bg-warning text-warning-foreground hover:bg-warning/90 gap-1"
                  onClick={() => setSuspendDialog(true)}
                >
                  <Prohibit className="h-4 w-4 mr-1" />
                  Suspend
                </Button>
              )}
              {seller.status === "suspended" && (
                <Button
                  size="sm"
                  className="bg-success text-success-foreground hover:bg-success/90 gap-1"
                  onClick={() => actions.unsuspend.mutateAsync()}
                  isLoading={actions.unsuspend.isPending}
                >
                  <CheckCircle className="h-4 w-4 mr-1" />
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
                  <UserMinus className="h-4 w-4 mr-1" />
                  Terminate
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      <Tabs defaultValue="overview">
        <TabsList className="mb-6">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="products">Products{productTotal != null ? ` (${productTotal})` : ""}</TabsTrigger>
          <TabsTrigger value="orders">Orders{orderTotal != null ? ` (${orderTotal})` : ""}</TabsTrigger>
          <TabsTrigger value="team">Team</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2">
              <CardHeader><CardTitle>About</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                {seller.description ? (
                  <p>{seller.description}</p>
                ) : (
                  <p className="text-sm text-muted-foreground">No shop description yet.</p>
                )}
                <div className="pt-4 border-t">
                  <p className="text-sm text-muted-foreground mb-2">Specialisations</p>
                  {productsLoading ? (
                    <Skeleton className="h-6 w-48" />
                  ) : specialisations.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {specialisations.map(s => (
                        <Badge key={s.id} variant="secondary">{s.name} · {s.count}</Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No products listed yet.</p>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t">
                  <div className="flex items-center gap-3">
                    <Envelope className="h-4 w-4 text-muted-foreground shrink-0" />
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
                  {seller.created_at && (
                    <div className="flex items-center gap-3">
                      <CalendarBlank className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div>
                        <p className="text-sm text-muted-foreground">Member Since</p>
                        <p className="font-medium">
                          {new Date(seller.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  )}
                  {typeof seller.commissionBps === "number" && (
                    <div className="flex items-center gap-3">
                      <Percent className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div>
                        <p className="text-sm text-muted-foreground">Commission</p>
                        <p className="font-medium">{(seller.commissionBps / 100).toFixed(2)}%</p>
                      </div>
                    </div>
                  )}
                </div>
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
                <CardHeader><CardTitle>Dispatch</CardTitle></CardHeader>
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
                <CardHeader><CardTitle>Payouts</CardTitle></CardHeader>
                <CardContent>
                  {momo?.phone ? (
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-3">
                        <Wallet className="h-4 w-4 text-muted-foreground shrink-0" />
                        <div>
                          <p className="text-sm text-muted-foreground">MoMo</p>
                          <p className="font-medium">{momo.phone} <span className="text-muted-foreground font-normal uppercase">· {momo.provider}</span></p>
                        </div>
                      </div>
                      <Badge variant={momo.recipient ? "success" : "warning"}>
                        {momo.recipient ? "Payout-ready" : "No Paystack recipient"}
                      </Badge>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No MoMo details on file</p>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="products">
          <Card className="overflow-hidden">
            <Table>
              <caption className="sr-only">Products by {seller.name || "this seller"}</caption>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {productsLoading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                    </TableRow>
                  ))
                ) : products.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3}>
                      <EmptyState title="No products" description="This seller hasn't listed anything yet." />
                    </TableCell>
                  </TableRow>
                ) : (
                  products.map(p => (
                    <TableRow key={p.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          {p.imageUrl ? (
                            <img src={p.imageUrl} alt="" className="h-10 w-10 rounded-md object-cover shrink-0" />
                          ) : (
                            <div className="h-10 w-10 rounded-md bg-muted shrink-0" />
                          )}
                          <span className="font-medium">{p.title || "Untitled"}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {specialisations.find(s => s.id === p.primaryCategoryId)?.name ?? p.primaryCategoryId}
                      </TableCell>
                      <TableCell>
                        <Badge variant={p.status === "published" ? "success" : p.status === "rejected" ? "destructive" : "warning"} className="capitalize">
                          {p.status.replace("_", " ")}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="orders">
          <Card className="overflow-hidden">
            <Table>
              <caption className="sr-only">Recent orders for {seller.name || "this seller"}</caption>
              <TableHeader>
                <TableRow>
                  <TableHead>Order</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Subtotal</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentOrders.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3}>
                      <EmptyState title="No orders" description="No orders for this seller yet." />
                    </TableCell>
                  </TableRow>
                ) : (
                  recentOrders.map(o => (
                    <TableRow key={o.id}>
                      <TableCell className="font-mono text-sm">#{o.id.slice(-8)}</TableCell>
                      <TableCell>
                        <Badge variant={o.status === "delivered" ? "success" : o.status === "cancelled" ? "destructive" : "warning"} className="capitalize">
                          {o.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium tabular-nums">
                        GH₵{(Number(o.subtotalPesewas) / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
          <div className="mt-4">
            <Link to="/orders">
              <Button variant="outline" size="sm">View all orders</Button>
            </Link>
          </div>
        </TabsContent>

        <TabsContent value="team">
          <Card>
            <CardHeader><CardTitle>Team Members</CardTitle></CardHeader>
            <CardContent>
              {seller.members && seller.members.length > 0 ? (
                <ul className="space-y-3">
                  {seller.members.map((m) => (
                    <li key={m.id} className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">
                          {[m.member.first_name, m.member.last_name].filter(Boolean).join(" ") || m.member.email}
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
        </TabsContent>
      </Tabs>

      {/* Suspend dialog */}
      <Modal
        isOpen={suspendDialog}
        onClose={() => setSuspendDialog(false)}
        title="Suspend Seller"
        className="max-w-md"
        footer={
          <>
            <Button variant="outline" onClick={() => setSuspendDialog(false)}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={!suspendReason.trim()}
              isLoading={actions.suspend.isPending}
              onClick={handleSuspend}
            >
              Suspend
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">Seller will be unable to create new orders. Provide a reason.</p>
          <Textarea
            placeholder="Reason for suspension…"
            value={suspendReason}
            onChange={e => setSuspendReason(e.target.value)}
            className="h-24"
            autoFocus
          />
        </div>
      </Modal>

      {/* Terminate dialog */}
      <Modal
        isOpen={terminateDialog}
        onClose={() => setTerminateDialog(false)}
        title="Terminate Seller Account"
        className="max-w-md"
        footer={
          <>
            <Button variant="outline" onClick={() => setTerminateDialog(false)}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={!terminateReason.trim()}
              isLoading={actions.terminate.isPending}
              onClick={handleTerminate}
            >
              Terminate Account
            </Button>
          </>
        }
      >
        <div className="space-y-4">
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
        </div>
      </Modal>

      {/* Commission dialog */}
      <Modal
        isOpen={commissionDialog}
        onClose={() => setCommissionDialog(false)}
        title="Set Custom Commission Rate"
        className="max-w-md"
        footer={
          <>
            <Button variant="outline" onClick={() => setCommissionDialog(false)}>Cancel</Button>
            <Button
              disabled={!commissionPct.trim() || isNaN(parseFloat(commissionPct))}
              isLoading={actions.setCommission.isPending}
              onClick={handleCommission}
            >
              Save Rate
            </Button>
          </>
        }
      >
        <div className="space-y-4">
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
        </div>
      </Modal>
    </PageShell>
  )
}
