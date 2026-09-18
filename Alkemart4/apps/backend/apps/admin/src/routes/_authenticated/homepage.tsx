import type { HomeSection } from "@alkemart/shared/homepage"
import { isSectionVisible } from "@alkemart/shared/homepage"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Eye, EyeSlash, Globe, Pencil } from "@phosphor-icons/react"
import { toast } from "sonner"
import {
  Button,
  EmptyState,
  LivePreview,
  Skeleton,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  formatSchedule,
} from "@workspace/ui"
import { PageShell } from "../../components/page-shell"
import { homepageStudio } from "../../lib/api"
import { DraftPreview } from "../../components/homepage-studio/DraftPreview"
import { usePreviewFeatured } from "../../components/homepage-studio/preview-data"
import { PublishBar } from "../../components/homepage-studio/PublishBar"
import { SectionEditor } from "../../components/homepage-studio/SectionEditor"
import { SectionLibrary } from "../../components/homepage-studio/SectionLibrary"
import { SlideOver, SlideOverClose } from "../../components/homepage-studio/SlideOver"
import { sectionLabels, sectionName, storefrontBase, validateSections } from "../../components/homepage-studio/model"

export const Route = createFileRoute("/_authenticated/homepage")({ component: HomepageStudioPage })

/**
 * Single-pane studio: the draft canvas is the page. Layers stack with gap
 * inserts, and editing happens in a slide-over beside the canvas — no
 * outline rail, no docked inspector. Every control lives exactly once:
 * the canvas owns stacking and looking, the slide-over owns fields.
 */
function HomepageStudioPage() {
  const queryClient = useQueryClient()
  const pageQ = useQuery({ queryKey: ["homepage-studio"], queryFn: homepageStudio.get })
  const categoriesQ = useQuery({ queryKey: ["homepage-studio", "categories"], queryFn: homepageStudio.categories })
  const [sections, setSections] = useState<HomeSection[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [inspectorOpen, setInspectorOpen] = useState(false)
  const [libraryOpen, setLibraryOpen] = useState(false)
  const [addAt, setAddAt] = useState<number | null>(null)
  const [perspective, setPerspective] = useState<"draft" | "live">("draft")
  const [showHidden, setShowHidden] = useState(true)
  const [publishAt, setPublishAt] = useState<string | null>(null)
  const [unpublishAt, setUnpublishAt] = useState<string | null>(null)
  const [announcement, setAnnouncement] = useState("")
  const settingsHeadingRef = useRef<HTMLHeadingElement>(null)
  const previewUrl = useMemo(() => `${storefrontBase()}/`, [])
  const flatCategories = useMemo(() => (categoriesQ.data?.categories ?? []).flatMap((category) => [
    { id: category.id, name: category.name, handle: category.handle ?? null },
    ...((category.children ?? []).map((child) => ({ id: child.id, name: child.name, handle: child.handle ?? null }))),
  ]), [categoriesQ.data])
  const topCategories = useMemo(() => (categoriesQ.data?.categories ?? []).map((category) => ({
    id: category.id,
    name: category.name,
    handle: category.handle ?? null,
  })), [categoriesQ.data])
  const featuredQ = usePreviewFeatured(24)
  const featured = useMemo(() => featuredQ.data?.items ?? [], [featuredQ.data])

  useEffect(() => {
    if (!pageQ.data) return
    setSections(pageQ.data.sections)
    setSelectedId((current) => current ?? pageQ.data.sections[0]?.id ?? null)
  }, [pageQ.data])

  const announce = (message: string) => setAnnouncement(message)

  const openSection = useCallback((section: HomeSection, message?: string) => {
    setSelectedId(section.id)
    setInspectorOpen(true)
    if (message) announce(message)
    // The heading mounts with the slide-over; focus it so keyboard and
    // screen-reader users land where the work happens.
    requestAnimationFrame(() => settingsHeadingRef.current?.focus())
  }, [])

  const closeInspector = useCallback(() => setInspectorOpen(false), [])

  const selected = useMemo(() => sections.find((section) => section.id === selectedId) ?? null, [sections, selectedId])
  const selectedIndex = useMemo(() => sections.findIndex((section) => section.id === selectedId), [sections, selectedId])
  const now = useMemo(() => new Date(), [])
  const hiddenCount = useMemo(() => sections.filter((section) => !isSectionVisible(section, now)).length, [sections, now])
  // Client mirror of the API's draft validation. Problems render inline on
  // the offending layer, and save/publish stop here instead of failing
  // with a bare toast that names no section.
  const issues = useMemo(() => validateSections(sections), [sections])
  const selectedIssues = useMemo(() => issues.filter((issue) => issue.sectionId === selectedId).map((issue) => issue.message), [issues, selectedId])

  const blockedByIssues = (action: "save" | "publish") => {
    if (!issues.length) return false
    const first = issues[0]
    const target = sections.find((section) => section.id === first.sectionId)
    if (target) openSection(target)
    else announce(first.message)
    toast.error(`Can't ${action} yet — ${first.message}`, {
      description: issues.length > 1 ? `${issues.length - 1} more problem${issues.length === 2 ? "" : "s"} flagged on the page.` : undefined,
    })
    return true
  }

  const save = useMutation({
    mutationFn: () => homepageStudio.saveDraft(pageQ.data!.revision, sections),
    onSuccess: (page) => { queryClient.setQueryData(["homepage-studio"], page); toast.success("Draft saved"); announce("Draft saved.") },
    onError: (error: Error) => toast.error(error.message),
  })
  const publish = useMutation({
    mutationFn: async () => {
      const saved = await homepageStudio.saveDraft(pageQ.data!.revision, sections)
      return publishAt
        ? homepageStudio.schedule(saved.revision, publishAt, unpublishAt)
        : homepageStudio.publish(saved.revision, unpublishAt)
    },
    onSuccess: (page) => {
      queryClient.setQueryData(["homepage-studio"], page)
      const message = publishAt ? `Homepage scheduled for ${formatSchedule(publishAt) ?? publishAt}.` : "Homepage published."
      toast.success(message)
      announce(message)
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const update = (next: HomeSection) => setSections((items) => items.map((item) => item.id === next.id ? next : item))
  const move = (id: string, delta: -1 | 1) => {
    const from = sections.findIndex((item) => item.id === id)
    const to = from + delta
    if (from < 0 || to < 0 || to >= sections.length) return
    const next = [...sections]
    const [item] = next.splice(from, 1)
    if (item) next.splice(to, 0, item)
    setSections(next)
    const moved = next[to]
    if (moved) announce(`${sectionName(moved)} moved to position ${to + 1} of ${next.length}.`)
  }
  const toggleVisible = (id: string) => {
    const target = sections.find((item) => item.id === id)
    if (!target) return
    const visible = target.visible === false
    update({ ...target, visible } as HomeSection)
    announce(`${sectionName(target)} is now ${visible ? "visible" : "hidden"}.`)
  }
  const duplicate = (id: string) => {
    const source = sections.find((item) => item.id === id)
    if (!source) return
    const copy = structuredClone(source) as HomeSection
    const nextId = `${source.type}-${crypto.randomUUID().slice(0, 8)}`
    const clone: HomeSection = { ...copy, id: nextId } as HomeSection
    if (clone.type === "promo_grid") clone.tiles = clone.tiles.map((tile) => ({ ...tile, id: `${nextId}-${crypto.randomUUID().slice(0, 6)}` }))
    if (clone.type === "value_grid") clone.items = clone.items.map((item) => ({ ...item, id: `${nextId}-${crypto.randomUUID().slice(0, 6)}` }))
    setSections((items) => {
      const index = items.findIndex((item) => item.id === id)
      const next = [...items]
      next.splice(index + 1, 0, clone)
      return next
    })
    openSection(clone, `${sectionLabels[source.type]} duplicated.`)
    toast.success("Section duplicated")
  }
  const insertSection = (section: HomeSection) => {
    const at = addAt ?? sections.length
    setSections((items) => {
      const next = [...items]
      next.splice(Math.min(at, next.length), 0, section)
      return next
    })
    setLibraryOpen(false)
    setAddAt(null)
    openSection(section, `${sectionLabels[section.type]} added at position ${Math.min(at, sections.length) + 1}.`)
  }

  if (pageQ.isLoading) {
    return (
      <PageShell>
        <div className="flex flex-col gap-4" role="status" aria-label="Loading Homepage Studio">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-[70vh] rounded-2xl" />
        </div>
      </PageShell>
    )
  }
  if (!pageQ.data) {
    return (
      <PageShell>
        <EmptyState
          title="Homepage Studio could not be loaded"
          description="Check your connection and try again."
          action={<Button onClick={() => void pageQ.refetch()}>Retry</Button>}
        />
      </PageShell>
    )
  }

  return (
    <PageShell>
      <div aria-live="polite" role="status" className="sr-only">{announcement}</div>

      {/* Slim command bar: title, status and publish actions stay reachable
          while the canvas scrolls. */}
      <div className="sticky top-0 z-30 -mx-5 border-b border-border bg-background/90 px-5 py-2.5 backdrop-blur sm:-mx-8 sm:px-8">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <h1 className="mr-auto text-lg font-extrabold tracking-tight">Homepage</h1>
          <PublishBar
            status={pageQ.data.status}
            hiddenCount={hiddenCount}
            issueCount={issues.length}
            saving={save.isPending}
            publishing={publish.isPending}
            publishAt={publishAt}
            unpublishAt={unpublishAt}
            onPublishAt={setPublishAt}
            onUnpublishAt={setUnpublishAt}
            onSave={() => { if (!blockedByIssues("save")) save.mutate() }}
            onPublish={() => { if (!blockedByIssues("publish")) publish.mutate() }}
          />
        </div>
      </div>

      <div className="mx-auto max-w-5xl">
        <Tabs value={perspective} onValueChange={(next) => setPerspective(next as "draft" | "live")}>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <TabsList aria-label="Preview perspective">
              <TabsTrigger value="draft">
                <Pencil className="mr-1.5 h-4 w-4" aria-hidden="true" />
                Draft
              </TabsTrigger>
              <TabsTrigger value="live">
                <Globe className="mr-1.5 h-4 w-4" aria-hidden="true" />
                Live page
              </TabsTrigger>
            </TabsList>
            <div className="flex items-center gap-1">
              {perspective === "draft" ? (
                <Button
                  type="button"
                  size="sm"
                  variant={showHidden ? "default" : "ghost"}
                  aria-pressed={showHidden}
                  onClick={() => {
                    setShowHidden((value) => {
                      announce(value ? "Hidden sections concealed — buyer view." : "Hidden sections shown — draft view.")
                      return !value
                    })
                  }}
                  title={showHidden ? "Conceal hidden sections (buyer view)" : "Show hidden sections (draft view)"}
                  className="h-7 gap-1 px-2.5 text-xs"
                >
                  {showHidden ? <Eye className="h-3.5 w-3.5" aria-hidden="true" /> : <EyeSlash className="h-3.5 w-3.5" aria-hidden="true" />}
                  Hidden
                </Button>
              ) : null}
              <div className="inline-flex items-center rounded-xl border border-border bg-white px-2.5 py-1 text-xs text-muted-foreground shadow-xs">
                Canvas follows your window — narrow it to proof the mobile layout
              </div>
            </div>
          </div>
          <TabsContent value="draft" className="mt-0">
            <div className="rounded-3xl border border-border bg-tone-neutral-soft p-3 sm:p-4">
              <div className="mx-auto max-w-6xl">
                <DraftPreview
                  sections={sections}
                  selectedId={selectedId}
                  issues={issues}
                  showHidden={showHidden}
                  featured={featured}
                  categories={flatCategories}
                  topCategories={topCategories}
                  onMove={(id, delta) => move(id, delta)}
                  onToggleVisible={toggleVisible}
                  onDuplicate={duplicate}
                  onAddAt={(index) => { setAddAt(index); setLibraryOpen(true) }}
                  onAddFirst={() => { setAddAt(0); setLibraryOpen(true) }}
                  onSelect={(section) => openSection(section, `${sectionName(section)} selected. Section settings opened. `)}
                />
                <p className="mt-3 px-1 text-xs text-muted-foreground">
                  Draft canvas — hover a gap to insert, click a layer to edit.
                </p>
              </div>
            </div>
          </TabsContent>
          <TabsContent value="live" className="mt-0">
            <div className="mx-auto max-w-6xl">
              <LivePreview
                hideToolbar
                title="Live preview of the storefront homepage"
                pageUrl={previewUrl}
                note="Live page — save and publish to update what buyers see."
              />
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <SectionLibrary
        open={libraryOpen}
        disabled={sections.length >= 24}
        title={addAt === 0 ? "Add first section" : addAt != null ? `Insert at position ${addAt + 1}` : "Add section"}
        onClose={() => { setLibraryOpen(false); setAddAt(null) }}
        onPick={insertSection}
      />

      <SlideOver
        open={inspectorOpen && selected !== null}
        label={selected ? `Edit ${sectionName(selected)}` : "Section settings"}
        returnFocusId={selected ? `layer-edit-${selected.id}` : null}
        onClose={closeInspector}
      >
        <SlideOverClose onClose={closeInspector} />
        {selected ? (
          <SectionEditor
            key={selected.id}
            section={selected}
            categories={flatCategories}
            headingRef={settingsHeadingRef}
            issues={selectedIssues}
            position={selectedIndex >= 0 ? `Section ${selectedIndex + 1} of ${sections.length}` : ""}
            onUpload={homepageStudio.upload}
            onChange={update}
            onDelete={() => {
              setSections((items) => items.filter((item) => item.id !== selected.id))
              setSelectedId(null)
              setInspectorOpen(false)
              announce("Section deleted.")
            }}
          />
        ) : null}
      </SlideOver>
    </PageShell>
  )
}
