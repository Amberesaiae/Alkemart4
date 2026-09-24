import { useMemo, useState } from "react"
import { createFileRoute } from "@tanstack/react-router"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { adminAttributes, adminTaxonomy, type AttributeType } from "../../lib/api"
import {
  Badge, Button, Card, Checkbox, EmptyState, Input, Label, Modal, Select,
  SelectContent, SelectItem, SelectTrigger, SelectValue, Skeleton, Table,
  TableBody, TableCell, TableHead, TableHeader, TableRow, Textarea,
} from "@workspace/ui"
import { PageShell } from "../../components/page-shell"
import { PageHeader } from "../../components/page-header"
import { Plus, WarningCircle } from "@phosphor-icons/react"
import { toast } from "sonner"

export const Route = createFileRoute("/_authenticated/attributes")({
  component: AttributesPage,
})

/**
 * Typed-attribute governance.
 *
 * A *definition* describes one fact ("RAM", number, GB). A *profile* binds an
 * ordered set of definitions to a category, and that profile becomes the
 * listing form a seller sees. Vendors write values; nothing here does.
 *
 * The required count is surfaced deliberately. Every required field is friction
 * on a seller holding a phone on mobile data, so the rule is: a field is
 * required only when buyers actually filter on it AND it is answerable by
 * looking at the item. New profiles start at zero required.
 */

const REQUIRED_WARN_AT = 5
const TYPES: AttributeType[] = ["text", "number", "boolean", "option", "multi_option"]

function AttributesPage() {
  const qc = useQueryClient()
  const defsQ = useQuery({ queryKey: ["admin", "attr", "definitions"], queryFn: adminAttributes.definitions })
  const profilesQ = useQuery({ queryKey: ["admin", "attr", "profiles"], queryFn: adminAttributes.profiles })
  const catsQ = useQuery({ queryKey: ["admin", "taxonomy"], queryFn: adminTaxonomy.list })

  const [defOpen, setDefOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)

  const definitions = defsQ.data?.items ?? []
  const profiles = profilesQ.data?.items ?? []

  const createDef = useMutation({
    mutationFn: adminAttributes.createDefinition,
    onSuccess: () => {
      toast.success("Definition created.")
      setDefOpen(false)
      qc.invalidateQueries({ queryKey: ["admin", "attr", "definitions"] })
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not create definition"),
  })

  const createProfile = useMutation({
    mutationFn: adminAttributes.createProfile,
    onSuccess: () => {
      toast.success("Profile created.")
      setProfileOpen(false)
      qc.invalidateQueries({ queryKey: ["admin", "attr", "profiles"] })
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not create profile"),
  })

  return (
    <PageShell>
      <PageHeader
        title="Attributes"
        description="Definitions describe a fact. Profiles bind them to a category and become the seller's listing form."
      />

      <Card className="p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-foreground">
            Definitions{" "}
            <span className="text-xs font-normal text-muted-foreground tabular-nums">
              ({definitions.length})
            </span>
          </h2>
          <Button size="sm" onClick={() => setDefOpen(true)} className="gap-1.5">
            <Plus className="h-3.5 w-3.5" /> New definition
          </Button>
        </div>

        {defsQ.isLoading ? (
          <Skeleton className="h-24 w-full" />
        ) : definitions.length === 0 ? (
          <EmptyState
            title="No definitions yet"
            description="Until a category has definitions, buyers see no filters and sellers are asked for nothing."
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Label</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Scope</TableHead>
                <TableHead>Flags</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {definitions.map((d) => (
                <TableRow key={d.id}>
                  <TableCell className="font-mono text-xs">{d.code}</TableCell>
                  <TableCell className="font-medium">{d.label}</TableCell>
                  <TableCell className="text-xs">
                    {d.type}
                    {d.allowedValues?.length ? (
                      <span className="text-muted-foreground"> · {d.allowedValues.length} values</span>
                    ) : null}
                  </TableCell>
                  <TableCell>
                    <Badge variant={d.scope === "universal" ? "default" : "secondary"}>
                      {d.scope}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {[d.filterable && "filter", d.searchable && "search", d.variantAxis && "variant"]
                      .filter(Boolean)
                      .join(" · ") || "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      <Card className="p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-foreground">
            Profiles{" "}
            <span className="text-xs font-normal text-muted-foreground tabular-nums">
              ({profiles.length})
            </span>
          </h2>
          <Button
            size="sm"
            variant="outline"
            disabled={definitions.length === 0}
            onClick={() => setProfileOpen(true)}
            className="gap-1.5"
          >
            <Plus className="h-3.5 w-3.5" /> New profile
          </Button>
        </div>

        {profilesQ.isLoading ? (
          <Skeleton className="h-20 w-full" />
        ) : profiles.length === 0 ? (
          <EmptyState
            title="No profiles yet"
            description="A profile is what turns a category into a listing form."
          />
        ) : (
          <ul className="space-y-2">
            {profiles.map((p) => {
              const requiredCount = p.definitions?.filter((d) => d.required).length ?? 0
              return (
                <li
                  key={p.id}
                  className="flex items-center gap-3 rounded-lg border border-border px-3 py-2 text-sm"
                >
                  <span className="font-bold text-foreground">{p.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {p.categoryId ?? "unassigned"} · v{p.version}
                  </span>
                  <span className="ms-auto text-xs tabular-nums text-muted-foreground">
                    {p.definitions?.length ?? 0} fields · {requiredCount} required
                  </span>
                  {requiredCount > REQUIRED_WARN_AT ? (
                    <Badge variant="destructive" className="gap-1">
                      <WarningCircle className="h-3 w-3" /> heavy
                    </Badge>
                  ) : null}
                </li>
              )
            })}
          </ul>
        )}
      </Card>

      {defOpen ? (
        <DefinitionModal
          onClose={() => setDefOpen(false)}
          pending={createDef.isPending}
          onSubmit={(v) => createDef.mutate(v)}
        />
      ) : null}
      {profileOpen ? (
        <ProfileModal
          onClose={() => setProfileOpen(false)}
          pending={createProfile.isPending}
          definitions={definitions}
          categories={(catsQ.data?.items ?? []).map((c) => ({
            id: c.id,
            name: c.displayName ?? c.canonicalName,
          }))}
          onSubmit={(v) => createProfile.mutate(v)}
        />
      ) : null}
    </PageShell>
  )
}

function DefinitionModal({
  onClose, pending, onSubmit,
}: {
  onClose: () => void
  pending: boolean
  onSubmit: (v: Parameters<typeof adminAttributes.createDefinition>[0]) => void
}) {
  const [code, setCode] = useState("")
  const [label, setLabel] = useState("")
  const [type, setType] = useState<AttributeType>("text")
  const [values, setValues] = useState("")
  const [unit, setUnit] = useState("")
  const [scope, setScope] = useState<"universal" | "profile">("profile")
  const [filterable, setFilterable] = useState(true)

  const needsValues = type === "option" || type === "multi_option"
  const parsedValues = values.split("\n").map((v) => v.trim()).filter(Boolean)
  const valid = code.trim() && label.trim() && (!needsValues || parsedValues.length > 0)

  return (
    <Modal isOpen onClose={onClose} title="New attribute definition">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="attr-code">Code</Label>
            <Input
              id="attr-code"
              value={code}
              placeholder="phone.ram_gb"
              onChange={(e) => setCode(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">Stable machine key. Never shown to buyers.</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="attr-label">Label</Label>
            <Input id="attr-label" value={label} placeholder="RAM" onChange={(e) => setLabel(e.target.value)} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="attr-type">Type</Label>
            <Select value={type} onValueChange={(v) => setType(v as AttributeType)}>
              <SelectTrigger id="attr-type"><SelectValue /></SelectTrigger>
              <SelectContent>
                {TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="attr-scope">Scope</Label>
            <Select value={scope} onValueChange={(v) => setScope(v as "universal" | "profile")}>
              <SelectTrigger id="attr-scope"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="profile">profile — dropped where undeclared</SelectItem>
                <SelectItem value="universal">universal — survives navigation</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {needsValues ? (
          <div className="space-y-1.5">
            <Label htmlFor="attr-values">Allowed values — one per line</Label>
            <Textarea
              id="attr-values"
              rows={5}
              value={values}
              placeholder={"Lenovo\nHP\nDell"}
              onChange={(e) => setValues(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              {parsedValues.length} values. These are the exact spellings facets will show.
            </p>
          </div>
        ) : null}

        {type === "number" ? (
          <div className="space-y-1.5">
            <Label htmlFor="attr-unit">Unit family</Label>
            <Input id="attr-unit" value={unit} placeholder="memory" onChange={(e) => setUnit(e.target.value)} />
          </div>
        ) : null}

        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={filterable} onCheckedChange={(v) => setFilterable(Boolean(v))} />
          <span>Show as a buyer filter</span>
        </label>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            disabled={!valid || pending}
            isLoading={pending}
            onClick={() =>
              onSubmit({
                code: code.trim(),
                label: label.trim(),
                type,
                scope,
                filterable,
                ...(needsValues ? { allowedValues: parsedValues } : {}),
                ...(unit.trim() ? { unitFamily: unit.trim() } : {}),
              })
            }
          >
            Create
          </Button>
        </div>
      </div>
    </Modal>
  )
}

function ProfileModal({
  onClose, pending, definitions, categories, onSubmit,
}: {
  onClose: () => void
  pending: boolean
  definitions: { id: string; code: string; label: string }[]
  categories: { id: string; name: string }[]
  onSubmit: (v: Parameters<typeof adminAttributes.createProfile>[0]) => void
}) {
  const [name, setName] = useState("")
  const [categoryId, setCategoryId] = useState<string>("")
  const [picked, setPicked] = useState<Record<string, boolean>>({})
  const [required, setRequired] = useState<Record<string, boolean>>({})

  const chosen = useMemo(() => definitions.filter((d) => picked[d.id]), [definitions, picked])
  const requiredCount = chosen.filter((d) => required[d.id]).length
  const heavy = requiredCount > REQUIRED_WARN_AT

  return (
    <Modal isOpen onClose={onClose} title="New attribute profile">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="prof-name">Name</Label>
            <Input id="prof-name" value={name} placeholder="phones-v1" onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="prof-cat">Category</Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger id="prof-cat"><SelectValue placeholder="Unassigned" /></SelectTrigger>
              <SelectContent>
                {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Fields</Label>
            <span
              className={`text-xs font-bold tabular-nums ${heavy ? "text-destructive" : "text-muted-foreground"}`}
            >
              {chosen.length} fields · {requiredCount} required
            </span>
          </div>
          {heavy ? (
            <p className="flex items-start gap-1.5 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs text-destructive">
              <WarningCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                More than {REQUIRED_WARN_AT} required fields. Every one is friction on a seller with a
                phone and mobile data — require a field only when buyers filter on it
                <em> and </em> it is answerable by looking at the item.
              </span>
            </p>
          ) : null}
          <ul className="max-h-64 space-y-1 overflow-y-auto rounded-lg border border-border p-2">
            {definitions.map((d) => (
              <li key={d.id} className="flex items-center gap-2 rounded px-1.5 py-1 text-sm hover:bg-muted/50">
                <Checkbox
                  checked={Boolean(picked[d.id])}
                  onCheckedChange={(v) => setPicked((p) => ({ ...p, [d.id]: Boolean(v) }))}
                />
                <span className="flex-1">{d.label}</span>
                <span className="font-mono text-xs text-muted-foreground">{d.code}</span>
                <label className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Checkbox
                    disabled={!picked[d.id]}
                    checked={Boolean(required[d.id])}
                    onCheckedChange={(v) => setRequired((p) => ({ ...p, [d.id]: Boolean(v) }))}
                  />
                  required
                </label>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            disabled={!name.trim() || chosen.length === 0 || pending}
            isLoading={pending}
            onClick={() =>
              onSubmit({
                name: name.trim(),
                ...(categoryId ? { categoryId } : {}),
                definitions: chosen.map((d, i) => ({
                  definitionId: d.id,
                  position: i,
                  required: Boolean(required[d.id]),
                })),
              })
            }
          >
            Create profile
          </Button>
        </div>
      </div>
    </Modal>
  )
}
