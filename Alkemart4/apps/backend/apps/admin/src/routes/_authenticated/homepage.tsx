import type { HomeSection } from "@alkemart/shared/homepage"
import { isSectionVisible } from "@alkemart/shared/homepage"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { useEffect, useMemo, useRef, useState } from "react"
import { DeviceMobile, Globe, Monitor, Pencil } from "@phosphor-icons/react"
import { toast } from "sonner"
import {
  Button,
  Card,
  CardContent,
  EmptyState,
  LivePreview,
  Skeleton,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  cn,
  formatSchedule,
} from "@workspace/ui"
import { PageHeader } from "../../components/page-header"
import { PageShell } from "../../components/page-shell"
import { homepageStudio } from "../../lib/api"
import { DraftPreview } from "../../components/homepage-studio/DraftPreview"
import { PublishBar } from "../../components/homepage-studio/PublishBar"
import { SectionEditor } from "../../components/homepage-studio/SectionEditor"
import { SectionList } from "../../components/homepage-studio/SectionList"
import { sectionLabels, sectionName, storefrontBase } from "../../components/homepage-studio/model"

export const Route = createFileRoute("/_authenticated/homepage")({ component: HomepageStudioPage })

function HomepageStudioPage() {
  const queryClient = useQueryClient()
  const pageQ = useQuery({ queryKey: ["homepage-studio"], queryFn: homepageStudio.get })
  const categoriesQ = useQuery({ queryKey: ["homepage-studio", "categories"], queryFn: homepageStudio.categories })
  const [sections, setSections] = useState<HomeSection[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [perspective, setPerspective] = useState<"draft" | "live">("draft")
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop")
  const [publishAt, setPublishAt] = useState<string | null>(null)
  const [unpublishAt, setUnpublishAt] = useState<string | null>(null)
  const [announcement, setAnnouncement] = useState("")
  const settingsHeadingRef = useRef<HTMLHeadingElement>(null)
  const userSelectedRef = useRef(false)
  const previewUrl = useMemo(() => `${storefrontBase()}/`, [])
  const categoryNameMap = useMemo(() => new Map(
    (categoriesQ.data?.categories ?? []).flatMap((category) => [
      [category.id, category.name] as const,
      ...((category.children ?? []).map((child) => [child.id, child.name] as const)),
    ]),
  ), [categoriesQ.data])

  useEffect(() => {
    if (!pageQ.data) return
    setSections(pageQ.data.sections)
    setSelectedId((current) => current ?? pageQ.data.sections[0]?.id ?? null)
  }, [pageQ.data])

  const announce = (message: string) => setAnnouncement(message)
  const selectSection = (id: string | null, message?: string) => {
    userSelectedRef.current = true
    setSelectedId(id)
    if (message) announce(message)
  }

  // Move focus to settings when the admin picks a section, so keyboard
  // and screen-reader users land where the work happens.
  useEffect(() => {
    if (userSelectedRef.current && selectedId) {
      userSelectedRef.current = false
      settingsHeadingRef.current?.focus()
    }
  }, [selectedId])

  const selected = useMemo(() => sections.find((section) => section.id === selectedId) ?? null, [sections, selectedId])
  const now = useMemo(() => new Date(), [])
  const hiddenCount = useMemo(() => sections.filter((section) => !isSectionVisible(section, now)).length, [sections, now])

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
  const move = (id: string, delta: -1 | 1, fromKeyboard = false) => {
    const from = sections.findIndex((item) => item.id === id)
    const to = from + delta
    if (from < 0 || to < 0 || to >= sections.length) return
    const next = [...sections]
    const [item] = next.splice(from, 1)
    if (item) next.splice(to, 0, item)
    setSections(next)
    const moved = next[to]
    if (moved) announce(`${sectionName(moved)} moved to position ${to + 1} of ${next.length}.`)
    if (fromKeyboard) {
      requestAnimationFrame(() => document.getElementById(`section-item-${id}`)?.focus())
    }
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
    selectSection(nextId, `${sectionLabels[source.type]} duplicated.`)
    toast.success("Section duplicated")
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
      <a href="#studio-settings" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground">
        Skip to section settings
      </a>
      <a href="#studio-preview" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground">
        Skip to live preview
      </a>
      <div aria-live="polite" role="status" className="sr-only">{announcement}</div>

      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <PageHeader
          title="Homepage Studio"
          description="Sections, live page, and publishing for the storefront homepage."
        />
        <PublishBar
          status={pageQ.data.status}
          hiddenCount={hiddenCount}
          saving={save.isPending}
          publishing={publish.isPending}
          publishAt={publishAt}
          unpublishAt={unpublishAt}
          onPublishAt={setPublishAt}
          onUnpublishAt={setUnpublishAt}
          onSave={() => save.mutate()}
          onPublish={() => publish.mutate()}
        />
      </div>

      <div className="grid min-h-[720px] grid-cols-1 gap-4 xl:grid-cols-[300px_minmax(0,1fr)_360px]">
        <SectionList
          sections={sections}
          selectedId={selectedId}
          now={now}
          onSelect={(id) => {
            const target = sections.find((item) => item.id === id)
            selectSection(id, target ? `${sectionName(target)} selected.` : undefined)
          }}
          onMove={(id, delta) => move(id, delta, true)}
          onToggleVisible={toggleVisible}
          onDuplicate={duplicate}
          onAdd={(section) => {
            setSections((items) => [...items, section])
            selectSection(section.id, `${sectionLabels[section.type]} added.`)
          }}
        />

        <Card id="studio-preview" className="h-fit overflow-hidden scroll-mt-4">
          <CardContent className="pt-6">
            <Tabs value={perspective} onValueChange={(next) => setPerspective(next as "draft" | "live")}>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
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
                <div className="inline-flex rounded-lg border border-border bg-background p-0.5" role="group" aria-label="Preview width">
                  <Button
                    type="button"
                    size="sm"
                    variant={device === "desktop" ? "default" : "ghost"}
                    aria-pressed={device === "desktop"}
                    onClick={() => setDevice("desktop")}
                    className="h-7 gap-1 px-2.5 text-xs"
                  >
                    <Monitor className="h-3.5 w-3.5" aria-hidden="true" />
                    Desktop
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={device === "mobile" ? "default" : "ghost"}
                    aria-pressed={device === "mobile"}
                    onClick={() => setDevice("mobile")}
                    className="h-7 gap-1 px-2.5 text-xs"
                  >
                    <DeviceMobile className="h-3.5 w-3.5" aria-hidden="true" />
                    Mobile
                  </Button>
                </div>
              </div>
              <TabsContent value="draft" className="mt-0">
                <div className={cn("mx-auto transition-all", device === "mobile" ? "max-w-[390px]" : "max-w-5xl")}>
                  <DraftPreview
                    sections={sections}
                    selectedId={selectedId}
                    onSelect={(section) => {
                      selectSection(section.id, `${sectionName(section)} selected. Section settings focused.`)
                      // Focus directly: the effect on [selectedId] won't fire
                      // when re-picking the already-selected section.
                      settingsHeadingRef.current?.focus()
                    }}
                    categoryNames={categoryNameMap}
                  />
                  <p className="mt-3 text-xs text-muted-foreground">
                    Draft preview — edits show here instantly. Select any block to edit it.
                  </p>
                </div>
              </TabsContent>
              <TabsContent value="live" className="mt-0">
                <div className={cn("mx-auto transition-all", device === "mobile" ? "max-w-[390px]" : "max-w-5xl")}>
                  <LivePreview
                    hideToolbar
                    title="Live preview of the storefront homepage"
                    pageUrl={previewUrl}
                    note="Live page — save and publish to update what buyers see."
                  />
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <div id="studio-settings" className="h-fit scroll-mt-4 xl:sticky xl:top-4">
          {selected ? (
            <SectionEditor
              key={selected.id}
              section={selected}
              position={sections.findIndex((item) => item.id === selected.id) + 1}
              total={sections.length}
              categories={(categoriesQ.data?.categories ?? []).flatMap((category) => [category, ...(category.children ?? [])])}
              headingRef={settingsHeadingRef}
              onChange={update}
              onDelete={() => {
                setSections((items) => items.filter((item) => item.id !== selected.id))
                selectSection(null)
                announce("Section deleted.")
              }}
              onMove={(delta) => move(selected.id, delta)}
              onDuplicate={() => duplicate(selected.id)}
            />
          ) : (
            <Card>
              <CardContent className="py-10">
                <EmptyState
                  title="No section selected"
                  description="Select a section from the list to edit its settings."
                />
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </PageShell>
  )
}
