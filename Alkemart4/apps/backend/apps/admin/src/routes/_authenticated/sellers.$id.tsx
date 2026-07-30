import { createFileRoute } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { adminSellers } from "../../lib/api"
import { Card, CardContent, CardHeader, CardTitle, Badge, Button, Skeleton } from "@workspace/ui"
import { PageShell } from "../../components/page-shell"
import { ArrowLeft, Store, Mail, Phone, MapPin, Calendar } from "lucide-react"

export const Route = createFileRoute("/_authenticated/sellers/$id")({
  component: SellerDetailPage,
})

function SellerDetailPage() {
  const { id } = Route.useParams()
  const { data, isLoading, isError } = useQuery({
    queryKey: ["seller", id],
    queryFn: () => adminSellers.retrieve(id),
    enabled: !!id,
  })

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

  return (
    <PageShell>
      <Button variant="ghost" size="sm" onClick={() => window.history.back()} className="mb-4 -ml-2">
        <ArrowLeft className="h-4 w-4 mr-2" /> Back
      </Button>

      <div className="flex items-center gap-4 mb-6">
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
    </PageShell>
  )
}
