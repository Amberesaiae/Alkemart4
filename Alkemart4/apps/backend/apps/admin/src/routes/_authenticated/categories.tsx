import { createFileRoute, redirect } from "@tanstack/react-router"
import { isWorkersApi } from "../../lib/config"
import { useMemo, useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { adminCategories } from "../../lib/api"
import type { AdminCategory } from "../../lib/api"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Badge, Button, Modal, Skeleton, EmptyState, Input, Switch, Select, Textarea, Checkbox } from "@workspace/ui"
import { PageShell } from "../../components/page-shell"
import { PageHeader } from "../../components/page-header"
import { Plus, Trash, PencilSimple, Link } from "@phosphor-icons/react"
import { toast } from "sonner"

export const Route = createFileRoute("/_authenticated/categories")({
  beforeLoad: () => {
    if (isWorkersApi) {
      throw redirect({ to: "/unavailable", search: { title: "Categories" } })
    }
  },
  component: CategoriesPage,
})

function internalBadge(cat: AdminCategory) {
  return cat.is_internal ? (
    <Badge variant="secondary">Internal</Badge>
  ) : (
    <Badge variant="success">Public</Badge>
  )
}

function CategoriesPage() {
  const queryClient = useQueryClient()
  const [showCreate, setShowCreate] = useState(false)
  const [editCat, setEditCat] = useState<AdminCategory | null>(null)
  const [deleteCat, setDeleteCat] = useState<AdminCategory | null>(null)
  const [manageCat, setManageCat] = useState<AdminCategory | null>(null)

  const cats = useQuery({
    queryKey: ["admin-categories"],
    queryFn: () => adminCategories.list(),
  })

  const products = useQuery({
    queryKey: ["admin-products-with-categories"],
    queryFn: () => adminCategories.productsWithCategories(),
  })

  const counts = useMemo(() => {
    const m = new Map<string, number>()
    for (const p of products.data?.products ?? []) {
      for (const c of p.categories ?? []) {
        m.set(c.id, (m.get(c.id) ?? 0) + 1)
      }
    }
    return m
  }, [products.data])

  const toggleActive = useMutation({
    mutationFn: (cat: AdminCategory) =>
      adminCategories.update(cat.id, { is_active: !cat.is_active }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-categories"] })
      toast.success("Category updated")
    },
    onError: () => toast.error("Failed to update category"),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => adminCategories.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-categories"] })
      queryClient.invalidateQueries({ queryKey: ["admin-products-with-categories"] })
      setDeleteCat(null)
      toast.success("Category deleted")
    },
    onError: () => toast.error("Failed to delete category"),
  })

  const isError = cats.isError || products.isError
  if (isError) {
    return (
      <PageShell>
        <div className="bg-destructive/10 text-destructive p-4 rounded-md flex items-center justify-between">
          <span>Failed to load categories.</span>
          <Button variant="outline" size="sm" onClick={() => { cats.refetch(); products.refetch() }}>
            Retry
          </Button>
        </div>
      </PageShell>
    )
  }

  const byId = new Map((cats.data?.product_categories ?? []).map((c) => [c.id, c]))
  const parents = (cats.data?.product_categories ?? []).filter((c) => !c.parent_category_id)
    .sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99))
  const children = (cats.data?.product_categories ?? []).filter((c) => c.parent_category_id)

  return (
    <PageShell>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 mb-6">
        <PageHeader
          title="Categories"
          description="Manage the marketplace taxonomy. Public categories surface in the storefront; internal ones are hidden from shoppers and vendors."
        />
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New Category
        </Button>
      </div>

      <div className="border rounded-xl bg-card">
        <Table label="Product categories">
          <caption className="sr-only">Product categories list</caption>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Handle</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="text-right">Rank</TableHead>
              <TableHead>Parent</TableHead>
              <TableHead className="text-right">Products</TableHead>
              <TableHead>Active</TableHead>
              <TableHead className="w-24"><span className="sr-only">Actions</span></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {cats.isLoading || products.isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                </TableRow>
              ))
            ) : parents.length === 0 && children.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8}>
                  <EmptyState title="No categories yet" description="Create your first category to build the marketplace taxonomy." />
                </TableCell>
              </TableRow>
            ) : (
              <>
                {parents.map((cat) => (
                  <CategoryRow
                    key={cat.id}
                    cat={cat}
                    depth={0}
                    counts={counts}
                    onEdit={setEditCat}
                    onDelete={setDeleteCat}
                    onManage={setManageCat}
                    onToggleActive={(c) => toggleActive.mutate(c)}
                  />
                ))}
                {children.map((cat) => {
                  const parent = byId.get(cat.parent_category_id!)
                  return (
                    <CategoryRow
                      key={cat.id}
                      cat={cat}
                      depth={1}
                      parentLabel={parent?.name}
                      counts={counts}
                      onEdit={setEditCat}
                      onDelete={setDeleteCat}
                      onManage={setManageCat}
                      onToggleActive={(c) => toggleActive.mutate(c)}
                    />
                  )
                })}
              </>
            )}
          </TableBody>
        </Table>
      </div>

      <CreateCategoryModal isOpen={showCreate} onClose={() => setShowCreate(false)} categories={cats.data?.product_categories ?? []} />
      {editCat && <EditCategoryModal cat={editCat} onClose={() => setEditCat(null)} categories={cats.data?.product_categories ?? []} />}
      {manageCat && <ManageProductsModal cat={manageCat} onClose={() => setManageCat(null)} products={products.data?.products ?? []} />}

      <Modal isOpen={Boolean(deleteCat)} onClose={() => setDeleteCat(null)} title="Delete Category">
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Delete <span className="font-medium text-foreground">{deleteCat?.name}</span>? Products currently in this category are <span className="font-medium text-foreground">not deleted</span> — they are unlinked.
          </p>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setDeleteCat(null)} disabled={deleteMutation.isPending}>Cancel</Button>
            <Button variant="destructive" onClick={() => deleteCat && deleteMutation.mutate(deleteCat.id)} disabled={deleteMutation.isPending}>
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </Button>
          </div>
        </div>
      </Modal>
    </PageShell>
  )
}

function CategoryRow({ cat, depth, parentLabel, counts, onEdit, onDelete, onManage, onToggleActive }: {
  cat: AdminCategory
  depth: 0 | 1
  parentLabel?: string
  counts: Map<string, number>
  onEdit: (c: AdminCategory) => void
  onDelete: (c: AdminCategory) => void
  onManage: (c: AdminCategory) => void
  onToggleActive: (c: AdminCategory) => void
}) {
  const count = counts.get(cat.id) ?? 0
  return (
    <TableRow>
      <TableCell>
        <div className="flex items-center gap-2" style={{ paddingLeft: depth * 20 }}>
          {depth === 1 && <span className="text-muted-foreground" aria-hidden="true">└</span>}
          <span className="font-medium">{cat.name}</span>
          {!cat.is_active && <Badge variant="warning">Inactive</Badge>}
        </div>
      </TableCell>
      <TableCell className="font-mono text-xs">{cat.handle ?? "—"}</TableCell>
      <TableCell>{internalBadge(cat)}</TableCell>
      <TableCell className="text-right tabular-nums">{cat.rank ?? "—"}</TableCell>
      <TableCell className="text-muted-foreground">{parentLabel ?? "—"}</TableCell>
      <TableCell className="text-right tabular-nums">{count}</TableCell>
      <TableCell>
        <Switch checked={cat.is_active} onCheckedChange={() => onToggleActive(cat)} />
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={() => onManage(cat)} className="text-muted-foreground hover:text-foreground" title="Manage products" aria-label={`Manage products in ${cat.name}`}>
            <Link className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => onEdit(cat)} className="text-muted-foreground hover:text-foreground" title="Edit category" aria-label={`Edit ${cat.name}`}>
            <PencilSimple className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => onDelete(cat)} className="text-destructive hover:text-destructive" title="Delete category" aria-label={`Delete ${cat.name}`}>
            <Trash className="h-4 w-4" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  )
}

type CategoryFormValues = {
  name: string
  handle: string
  description: string
  rank: string
  parentId: string
  isInternal: boolean
  isActive: boolean
}

const EMPTY_FORM: CategoryFormValues = {
  name: "",
  handle: "",
  description: "",
  rank: "",
  parentId: "",
  isInternal: false,
  isActive: true,
}

function CategoryFields({ form, setForm, categories, hideParent }: {
  form: CategoryFormValues
  setForm: (updater: (f: CategoryFormValues) => CategoryFormValues) => void
  categories: AdminCategory[]
  hideParent?: boolean
}) {
  const parents = categories.filter((c) => !c.parent_category_id && !c.is_internal)
  const set = (patch: Partial<CategoryFormValues>) =>
    setForm((f) => ({ ...f, ...patch }))

  return (
    <div className="space-y-3">
      <div>
        <label className="text-sm font-medium">Name</label>
        <Input value={form.name} onChange={(e) => set({ name: e.target.value })} placeholder="e.g. Fresh Produce" />
      </div>
      <div>
        <label className="text-sm font-medium">Handle</label>
        <Input value={form.handle} onChange={(e) => set({ handle: e.target.value })} placeholder="e.g. fresh-produce" />
      </div>
      <div>
        <label className="text-sm font-medium">Description</label>
        <Textarea value={form.description} onChange={(e) => set({ description: e.target.value })} placeholder="Short description of the category" className="h-20" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-sm font-medium">Rank</label>
          <Input type="number" min={0} value={form.rank} onChange={(e) => set({ rank: e.target.value })} placeholder="e.g. 0" />
        </div>
        {!hideParent && (
          <div>
            <label className="text-sm font-medium">Parent</label>
            <Select value={form.parentId} onChange={(e) => set({ parentId: e.target.value })}>
              <option value="">— Top level —</option>
              {parents.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </Select>
          </div>
        )}
      </div>
      <div className="flex items-center gap-2">
        <Switch checked={form.isActive} onCheckedChange={(v) => set({ isActive: v })} />
        <label className="text-sm">Active</label>
      </div>
      <div className="flex items-center gap-2">
        <Switch checked={form.isInternal} onCheckedChange={(v) => set({ isInternal: v })} />
        <label className="text-sm">Internal (hidden from storefront and vendors)</label>
      </div>
    </div>
  )
}

function CreateCategoryModal({ isOpen, onClose, categories }: { isOpen: boolean; onClose: () => void; categories: AdminCategory[] }) {
  const queryClient = useQueryClient()
  const [form, setForm] = useState<CategoryFormValues>(EMPTY_FORM)

  const createMutation = useMutation({
    mutationFn: () =>
      adminCategories.create({
        name: form.name,
        handle: form.handle || undefined,
        description: form.description || undefined,
        rank: form.rank !== "" ? Number(form.rank) : undefined,
        parent_category_id: form.parentId || null,
        is_active: form.isActive,
        is_internal: form.isInternal,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-categories"] })
      queryClient.invalidateQueries({ queryKey: ["admin-products-with-categories"] })
      setForm(EMPTY_FORM)
      onClose()
      toast.success("Category created")
    },
    onError: () => toast.error("Failed to create category"),
  })

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="New Category">
      <div className="space-y-4">
        <CategoryFields form={form} setForm={setForm} categories={categories} />
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => createMutation.mutate()} disabled={!form.name || createMutation.isPending} isLoading={createMutation.isPending}>
            Create
          </Button>
        </div>
      </div>
    </Modal>
  )
}

function EditCategoryModal({ cat, onClose, categories }: { cat: AdminCategory; onClose: () => void; categories: AdminCategory[] }) {
  const queryClient = useQueryClient()
  const [form, setForm] = useState<CategoryFormValues>({
    name: cat.name,
    handle: cat.handle ?? "",
    description: cat.description ?? "",
    rank: cat.rank != null ? String(cat.rank) : "",
    parentId: cat.parent_category_id ?? "",
    isInternal: cat.is_internal,
    isActive: cat.is_active,
  })

  const editMutation = useMutation({
    mutationFn: () =>
      adminCategories.update(cat.id, {
        name: form.name,
        handle: form.handle || undefined,
        description: form.description || undefined,
        rank: form.rank !== "" ? Number(form.rank) : undefined,
        parent_category_id: form.parentId || null,
        is_active: form.isActive,
        is_internal: form.isInternal,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-categories"] })
      queryClient.invalidateQueries({ queryKey: ["admin-products-with-categories"] })
      onClose()
      toast.success("Category updated")
    },
    onError: () => toast.error("Failed to update category"),
  })

  return (
    <Modal isOpen onClose={onClose} title="Edit Category">
      <div className="space-y-4">
        <CategoryFields form={form} setForm={setForm} categories={categories} hideParent={cat.is_internal} />
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => editMutation.mutate()} disabled={!form.name || editMutation.isPending} isLoading={editMutation.isPending}>
            Save Changes
          </Button>
        </div>
      </div>
    </Modal>
  )
}

function ManageProductsModal({ cat, onClose, products }: {
  cat: AdminCategory
  onClose: () => void
  products: Array<{ id: string; title: string; thumbnail?: string | null; categories?: Array<{ id: string }> }>
}) {
  const queryClient = useQueryClient()
  const [selected, setSelected] = useState<string[]>([])

  const assigned = products.filter((p) => p.categories?.some((c) => c.id === cat.id))
  const available = products.filter((p) => !p.categories?.some((c) => c.id === cat.id))

  const linkMutation = useMutation({
    mutationFn: () => adminCategories.linkProducts(cat.id, selected, []),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-products-with-categories"] })
      setSelected([])
      toast.success("Products linked")
    },
    onError: () => toast.error("Failed to link products"),
  })

  const unlinkMutation = useMutation({
    mutationFn: (productIds: string[]) => adminCategories.linkProducts(cat.id, [], productIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-products-with-categories"] })
      toast.success("Products unlinked")
    },
    onError: () => toast.error("Failed to unlink products"),
  })

  const toggleSelected = (id: string) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))

  return (
    <Modal isOpen onClose={onClose} title={`Products in ${cat.name}`} className="max-w-2xl">
      <div className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">Add products to this category</label>
          <div className="max-h-48 overflow-y-auto border rounded-lg divide-y divide-border">
            {available.length === 0 ? (
              <p className="text-sm text-muted-foreground p-3">Every product is already assigned here.</p>
            ) : (
              available.map((p) => (
                <label key={p.id} className="flex items-center gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-muted/50">
                  <Checkbox checked={selected.includes(p.id)} onCheckedChange={() => toggleSelected(p.id)} />
                  <span className="truncate">{p.title}</span>
                </label>
              ))
            )}
          </div>
          <div className="flex justify-end">
            <Button size="sm" onClick={() => linkMutation.mutate()} disabled={selected.length === 0 || linkMutation.isPending} isLoading={linkMutation.isPending}>
              Link {selected.length ? `(${selected.length})` : ""}
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Assigned ({assigned.length})</label>
          <div className="max-h-48 overflow-y-auto border rounded-lg divide-y divide-border">
            {assigned.length === 0 ? (
              <p className="text-sm text-muted-foreground p-3">No products in this category.</p>
            ) : (
              assigned.map((p) => (
                <div key={p.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                  <span className="truncate">{p.title}</span>
                  <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive shrink-0"
                    onClick={() => unlinkMutation.mutate([p.id])} disabled={unlinkMutation.isPending}>
                    Remove
                  </Button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </Modal>
  )
}
