import { createFileRoute } from "@tanstack/react-router"
import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { commissionRates } from "../../lib/api"
import type { CommissionRate } from "../../lib/api"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Badge, Button, Modal, Skeleton, EmptyState, Input, Switch, Select } from "@workspace/ui"
import { PageShell } from "../../components/page-shell"
import { PageHeader } from "../../components/page-header"
import { Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"

export const Route = createFileRoute("/_authenticated/commission-rates")({
  component: CommissionRatesPage,
})

function TypeBadge({ type }: { type: string }) {
  return (
    <Badge variant={type === "percentage" ? "success" : "default"} className="capitalize">
      {type === "percentage" ? "%" : "¢"}
    </Badge>
  )
}

function CommissionRatesPage() {
  const queryClient = useQueryClient()
  const [showCreate, setShowCreate] = useState(false)
  const [offset, setOffset] = useState(0)
  const limit = 50

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["commission-rates", offset],
    queryFn: () => commissionRates.list({ offset, limit }),
  })

  const toggleMutation = useMutation({
    mutationFn: (rate: CommissionRate) =>
      commissionRates.update(rate.id, { is_enabled: !rate.is_enabled }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["commission-rates"] })
      toast.success("Rate updated")
    },
    onError: () => toast.error("Failed to update rate"),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => commissionRates.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["commission-rates"] })
      toast.success("Rate deleted")
    },
    onError: () => toast.error("Failed to delete rate"),
  })

  if (isError) {
    return (
      <PageShell>
        <div className="bg-destructive/10 text-destructive p-4 rounded-md flex items-center justify-between">
          <span>Failed to load commission rates.</span>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            Retry
          </Button>
        </div>
      </PageShell>
    )
  }

  const rates = data?.commission_rates || []

  return (
    <PageShell>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 mb-6">
        <PageHeader
          title="Commission Rates"
          description="Set the platform commission charged on each order."
        />
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New Rate
        </Button>
      </div>

      <div className="border rounded-xl bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Code</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Value</TableHead>
              <TableHead>Default</TableHead>
              <TableHead>Enabled</TableHead>
              <TableHead className="w-20" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                </TableRow>
              ))
            ) : rates.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7}>
                  <EmptyState title="No commission rates" description="Create your first rate to start collecting commission." />
                </TableCell>
              </TableRow>
            ) : (
              rates.map((rate) => (
                <TableRow key={rate.id}>
                  <TableCell className="font-medium">{rate.name}</TableCell>
                  <TableCell className="font-mono text-xs">{rate.code}</TableCell>
                  <TableCell><TypeBadge type={rate.type} /></TableCell>
                  <TableCell>
                    {rate.type === "percentage" ? `${rate.value}%` : `${rate.value} ${rate.currency_code || "GHS"}`}
                  </TableCell>
                  <TableCell>{rate.is_default ? <Badge variant="success">Default</Badge> : <span className="text-muted-foreground">—</span>}</TableCell>
                  <TableCell>
                    <Switch
                      checked={rate.is_enabled}
                      onCheckedChange={() => toggleMutation.mutate(rate)}
                    />
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteMutation.mutate(rate.id)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <CreateRateModal isOpen={showCreate} onClose={() => setShowCreate(false)} />

      <div className="flex justify-between items-center mt-4">
        <span className="text-sm text-muted-foreground">
          {rates.length ? `${offset + 1}–${offset + rates.length}` : "0"} of {data?.count ?? "…"}
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

function CreateRateModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const queryClient = useQueryClient()
  const [name, setName] = useState("")
  const [code, setCode] = useState("")
  const [type, setType] = useState("percentage")
  const [value, setValue] = useState("")
  const [isDefault, setIsDefault] = useState(false)

  const createMutation = useMutation({
    mutationFn: () =>
      commissionRates.create({
        name,
        code,
        type: type as "percentage" | "fixed",
        value: Number(value),
        is_enabled: true,
        is_default: isDefault,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["commission-rates"] })
      onClose()
      setName("")
      setCode("")
      setType("percentage")
      setValue("")
      setIsDefault(false)
      toast.success("Commission rate created")
    },
    onError: () => toast.error("Failed to create rate"),
  })

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <div className="space-y-4 p-6">
        <h2 className="text-lg font-semibold">Create Commission Rate</h2>
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium">Name</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Standard Commission" />
          </div>
          <div>
            <label className="text-sm font-medium">Code</label>
            <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="e.g. standard" />
          </div>
          <div>
            <label className="text-sm font-medium">Type</label>
            <Select value={type} onChange={(e) => setType(e.target.value)}>
              <option value="percentage">Percentage</option>
              <option value="fixed">Fixed (GHS)</option>
            </Select>
          </div>
          <div>
            <label className="text-sm font-medium">Value</label>
            <Input
              type="number"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={type === "percentage" ? "e.g. 10" : "e.g. 5.00"}
            />
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={isDefault} onCheckedChange={setIsDefault} />
            <label className="text-sm">Set as default rate</label>
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => createMutation.mutate()} disabled={!name || !code || !value}>
            Create
          </Button>
        </div>
      </div>
    </Modal>
  )
}
