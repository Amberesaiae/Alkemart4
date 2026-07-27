import { createFileRoute, useNavigate, Link } from "@tanstack/react-router"
import { useState } from "react"
import { useProduct, useUpdateProduct, useDeleteProduct, useCategories } from "../lib/hooks"
import { Card, Button, Input, Label, Textarea, Select, Skeleton } from "@workspace/ui"
import { ArrowLeft, Save, Trash2, AlertCircle } from "lucide-react"
import { PageShell } from "../components/page-shell"

export const Route = createFileRoute('/products/$id')({
  component: ProductDetailPage,
})

function ProductDetailPage() {
  const { id } = Route.useParams()
  const navigate = useNavigate()
  const { data, isLoading, isError } = useProduct(id)
  const update = useUpdateProduct()
  const del = useDeleteProduct()
  const { data: categoriesData } = useCategories()

  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [categoryId, setCategoryId] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const product = data?.product

  const startEditing = () => {
    if (!product) return
    setTitle(product.title || "")
    setDescription(product.description || "")
    setCategoryId(product.categories?.[0]?.id || "")
    setEditing(true)
    setError(null)
    setSuccess(null)
  }

  const handleSave = async () => {
    setError(null)
    setSuccess(null)
    if (!title || title.trim().length < 3) {
      setError("Title must be at least 3 characters.")
      return
    }
    try {
      await update.mutateAsync({
        id,
        data: {
          title: title.trim(),
          description: description.trim() || undefined,
          categories: categoryId ? [{ id: categoryId }] : [],
        },
      })
      setSuccess("Product updated.")
      setEditing(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update.")
    }
  }

  const handleDelete = async () => {
    setError(null)
    try {
      await del.mutateAsync(id)
      navigate({ to: "/products" })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete.")
      setConfirmDelete(false)
    }
  }

  if (isLoading) {
    return (
      <PageShell>
        <div className="space-y-6">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
      </PageShell>
    )
  }

  if (isError || !product) {
    return (
      <PageShell>
        <Card className="p-8 text-center">
          <AlertCircle className="h-10 w-10 mx-auto mb-3 text-destructive" />
          <h2 className="text-lg font-bold mb-1">Product not found</h2>
          <p className="text-muted-foreground text-sm mb-4">
            This product doesn't exist or you don't have access to it.
          </p>
          <Button onClick={() => navigate({ to: "/products" })} variant="outline">
            Back to Products
          </Button>
        </Card>
      </PageShell>
    )
  }

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      draft: "bg-muted text-muted-foreground",
      proposed: "bg-yellow-100 text-yellow-800",
      published: "bg-green-100 text-green-800",
      rejected: "bg-red-100 text-red-800",
    }
    return (
      <span className={`px-3 py-1 rounded-full text-xs font-bold ${map[status] || "bg-muted"}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    )
  }

  return (
    <PageShell>
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" onClick={() => navigate({ to: "/products" })}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">{product.title || "Untitled"}</h1>
          <p className="text-sm text-muted-foreground">Ref: {product.handle?.slice(0, 12) || product.id.slice(0, 12)}</p>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-destructive/10 text-destructive text-sm font-semibold rounded-lg border border-destructive/20" role="alert">
          {error}
        </div>
      )}
      {success && (
        <div className="mb-4 p-3 bg-green-100 text-green-800 text-sm font-semibold rounded-lg border border-green-200" role="status">
          {success}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1 overflow-hidden">
          {product.thumbnail ? (
            <img src={product.thumbnail} alt={product.title || "Product"} className="w-full aspect-square object-cover" />
          ) : (
            <div className="w-full aspect-square bg-muted flex items-center justify-center text-muted-foreground text-sm font-semibold">
              No Image
            </div>
          )}
        </Card>

        <Card className="lg:col-span-2 p-6 space-y-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-sm font-semibold text-muted-foreground">Status:</span>
              {statusBadge(product.status || "draft")}
            </div>
            {product.status !== "published" && (
              <div className="flex gap-2">
                {!editing && (
                  <Button onClick={startEditing} variant="outline" size="sm">
                    Edit
                  </Button>
                )}
                {!confirmDelete ? (
                  <Button onClick={() => setConfirmDelete(true)} variant="outline" size="sm" className="text-destructive border-destructive/30">
                    <Trash2 className="h-4 w-4 mr-1" />
                    Delete
                  </Button>
                ) : (
                  <div className="flex gap-2 items-center">
                    <span className="text-xs text-destructive font-semibold">Sure?</span>
                    <Button onClick={handleDelete} size="sm" variant="destructive" isLoading={del.isPending}>
                      Confirm
                    </Button>
                    <Button onClick={() => setConfirmDelete(false)} size="sm" variant="outline">
                      Cancel
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>

          {editing ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="edit-title">Title</Label>
                <Input id="edit-title" value={title} onChange={e => setTitle(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-desc">Description</Label>
                <Textarea id="edit-desc" value={description} onChange={e => setDescription(e.target.value)} rows={4} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-category">Category</Label>
                <Select id="edit-category" value={categoryId} onChange={e => setCategoryId(e.target.value)}>
                  <option value="">No category</option>
                  {categoriesData?.product_categories?.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </Select>
              </div>
              <div className="flex gap-3 pt-2">
                <Button onClick={handleSave} isLoading={update.isPending} className="gap-2">
                  <Save className="h-4 w-4" />
                  Save
                </Button>
                <Button onClick={() => setEditing(false)} variant="outline">Cancel</Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <span className="text-sm font-semibold text-muted-foreground block mb-1">Title</span>
                <p className="font-bold text-lg">{product.title || "Untitled"}</p>
              </div>
              <div>
                <span className="text-sm font-semibold text-muted-foreground block mb-1">Description</span>
                <p className="text-sm whitespace-pre-wrap">{product.description || "No description."}</p>
              </div>
              {product.categories && product.categories.length > 0 && (
                <div>
                  <span className="text-sm font-semibold text-muted-foreground block mb-1">Category</span>
                  <p className="text-sm">{product.categories.map(c => c.name).join(", ")}</p>
                </div>
              )}
              <div>
                <span className="text-sm font-semibold text-muted-foreground block mb-1">Created</span>
                <p className="text-sm">{product.created_at ? new Date(product.created_at).toLocaleDateString() : "Unknown"}</p>
              </div>
            </div>
          )}
        </Card>
      </div>
    </PageShell>
  )
}
