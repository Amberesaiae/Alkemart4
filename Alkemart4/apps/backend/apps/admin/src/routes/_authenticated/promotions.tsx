import { createFileRoute } from "@tanstack/react-router"
import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { adminPromotions } from "../../lib/api"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Badge, Button, Modal, Skeleton, EmptyState, Input, Select } from "@workspace/ui"
import { PageShell } from "../../components/page-shell"
import { PageHeader } from "../../components/page-header"
import { Plus, Percent, Coins, Truck } from "lucide-react"
import { toast } from "sonner"

export const Route = createFileRoute("/_authenticated/promotions")({
  component: PromotionsPage,
})

function TypeIcon({ type }: { type: string }) {
  switch (type) {
    case "standard": return <Percent className="h-4 w-4" />
    case "free_shipping": return <Truck className="h-4 w-4" />
    default: return <Coins className="h-4 w-4" />
  }
}

function PromotionsPage() {
  const [showCreate, setShowCreate] = useState(false)
  const [offset, setOffset] = useState(0)
  const limit = 50

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["promotions", offset],
    queryFn: () => adminPromotions.list({ offset, limit }),
  })

  if (isError) {
    return (
      <PageShell>
        <div className="bg-destructive/10 text-destructive p-4 rounded-md flex items-center justify-between">
          <span>Failed to load promotions.</span>
          <Button variant="outline" size="sm" onClick={() => refetch()}>Retry</Button>
        </div>
      </PageShell>
    )
  }

  const promotions = data?.promotions || []

  return (
    <PageShell>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 mb-6">
        <PageHeader title="Promotions" description="Manage discount codes and promotional campaigns." />
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New Promotion
        </Button>
      </div>

      <div className="border rounded-xl bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Discount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Auto</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                </TableRow>
              ))
            ) : promotions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5}>
                  <EmptyState
                    title="No promotions yet"
                    description="Create your first promotion to start offering discounts."
                  />
                </TableCell>
              </TableRow>
            ) : (
              promotions.map((promo) => (
                <TableRow key={promo.id}>
                  <TableCell className="font-mono text-sm font-medium">{promo.code}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <TypeIcon type={promo.type} />
                      <span className="capitalize">{promo.type.replace("_", " ")}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {promo.application_method ? (
                      <span>
                        {promo.application_method.type === "percentage"
                          ? `${promo.application_method.value}%`
                          : `${promo.application_method.value} ${promo.application_method.currency_code || "GHS"}`}
                      </span>
                    ) : "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={promo.status === "active" ? "success" : "secondary"} className="capitalize">
                      {promo.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {promo.is_automatic ? <Badge variant="default">Auto</Badge> : <span className="text-muted-foreground">—</span>}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <CreatePromotionModal isOpen={showCreate} onClose={() => setShowCreate(false)} />

      <div className="flex justify-between items-center mt-4">
        <span className="text-sm text-muted-foreground">
          {promotions.length ? `${offset + 1}–${offset + promotions.length}` : "0"} of {data?.count ?? "…"}
        </span>
        <div className="flex gap-2">
          <Button variant="outline" disabled={offset === 0} onClick={() => setOffset((o) => Math.max(0, o - limit))}>
            Previous
          </Button>
          <Button variant="outline" disabled={!data?.count || offset + limit >= (data?.count || 0)} onClick={() => setOffset((o) => o + limit)}>
            Next
          </Button>
        </div>
      </div>
    </PageShell>
  )
}

function CreatePromotionModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const queryClient = useQueryClient()
  const [code, setCode] = useState("")
  const [type, setType] = useState("standard")
  const [value, setValue] = useState("")
  const [valueType, setValueType] = useState("percentage")

  const createMutation = useMutation({
    mutationFn: () =>
      adminPromotions.create({
        code,
        type,
        value: Number(value),
        value_type: valueType as "fixed" | "percentage",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["promotions"] })
      onClose()
      setCode("")
      setType("standard")
      setValue("")
      setValueType("percentage")
      toast.success("Promotion created")
    },
    onError: () => toast.error("Failed to create promotion"),
  })

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <div className="space-y-4 p-6">
        <h2 className="text-lg font-semibold">Create Promotion</h2>
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium">Code</label>
            <Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="e.g. SUMMER20" />
          </div>
          <div>
            <label className="text-sm font-medium">Type</label>
            <Select value={type} onChange={(e) => setType(e.target.value)}>
              <option value="standard">Standard</option>
              <option value="free_shipping">Free Shipping</option>
            </Select>
          </div>
          <div>
            <label className="text-sm font-medium">Discount Type</label>
            <Select value={valueType} onChange={(e) => setValueType(e.target.value)}>
              <option value="percentage">Percentage</option>
              <option value="fixed">Fixed (GHS)</option>
            </Select>
          </div>
          <div>
            <label className="text-sm font-medium">Value</label>
            <Input type="number" value={value} onChange={(e) => setValue(e.target.value)} placeholder="e.g. 20" />
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => createMutation.mutate()} disabled={!code || !value}>
            Create
          </Button>
        </div>
      </div>
    </Modal>
  )
}
