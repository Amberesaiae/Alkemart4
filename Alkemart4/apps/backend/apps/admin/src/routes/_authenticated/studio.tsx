import type { HomeSection } from "@alkemart/shared/homepage"
import { composeMarketCourse } from "@alkemart/shared/homepage"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { createFileRoute, Link } from "@tanstack/react-router"
import { ArrowSquareOut, ArrowLeft, DeviceMobile, Desktop, PencilSimple, ArrowClockwise } from "@phosphor-icons/react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"
import { Button, EmptyState, Skeleton } from "@workspace/ui"
import { homepageStudio } from "../../lib/api"
import { SlideOver } from "../../components/homepage-studio/SlideOver"
import { SectionEditor } from "../../components/homepage-studio/SectionEditor"
import { sectionName, storefrontBase, validateSections } from "../../components/homepage-studio/model"

export const Route = createFileRoute("/_authenticated/studio")({ component: LiveStudioPage })

/**
 * Live Studio: a full-viewport iframe of the REAL storefront (never a draft
 * mock) with click-to-edit. The iframe runs `?studio=1` edit mode, which is
 * strictly read-only affordances — sections report clicks via postMessage and
 * all writes happen here with the admin JWT. No draft state exists: Save
 * publishes straight to live (with validation + confirm inline).
 */
function LiveStudioPage() {
  const queryClient = useQueryClient()
  const pageQ = useQuery({ queryKey: ["homepage-studio"], queryFn: homepageStudio.get })
  const categoriesQ = useQuery({ queryKey: ["homepage-studio", "categories"], queryFn: homepageStudio.categories })
  const [editMode, setEditMode] = useState(true)
  const [device, setDevice] = useState<"mobile" | "desktop">("desktop")
  const [refreshTick, setRefreshTick] = useState(0)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [sections, setSections] = useState<HomeSection[]>([])
  const [announcement, setAnnouncement] = useState("")
  const settingsHeadingRef = useRef<HTMLHeadingElement>(null)
  const frameRef = useRef<HTMLIFrameElement>(null)

  const base = useMemo(() => storefrontBase(), [])
  const baseOrigin = useMemo(() => {
    try {
      return new URL(base).origin
    } catch {
      return ""
    }
  }, [base])
  const frameSrc = useMemo(
    () => (editMode ? `${base}/?studio=1` : `${base}/`),
    [base, editMode],
  )

  useEffect(() => {
    if (!pageQ.data) return
    setSections(composeMarketCourse(pageQ.data.sections))
  }, [pageQ.data])

  const flatCategories = useMemo(() => (categoriesQ.data?.categories ?? []).flatMap((category) => [
    { id: category.id, name: category.name },
    ...((category.children ?? []).map((child) => ({ id: child.id, name: child.name }))),
  ]), [categoriesQ.data])

  const selected = useMemo(() => sections.find((s) => s.id === selectedId) ?? null, [sections, selectedId])
  const selectedIndex = useMemo(() => sections.findIndex((s) => s.id === selectedId), [sections, selectedId])
  const issues = useMemo(() => validateSections(sections), [sections])
  const selectedIssues = useMemo(
    () => issues.filter((i) => i.sectionId === selectedId).map((i) => i.message),
    [issues, selectedId],
  )

  const openSection = useCallback((section: HomeSection, message?: string) => {
    setSelectedId(section.id)
    if (message) setAnnouncement(message)
    requestAnimationFrame(() => settingsHeadingRef.current?.focus())
  }, [])

  // Clicks reported by the storefront iframe (origin-checked).
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (baseOrigin && event.origin !== baseOrigin) return
      const data = event.data as { type?: string; sectionId?: string } | null
      if (!data || data.type !== "alkemart-studio:select" || !data.sectionId) return
      const hit = sections.find((s) => s.id === data.sectionId)
      if (!hit) {
        toast.info("Rule-backed shelf — manage it via Campaigns or Collections.", {
          description: `“${data.sectionId}” is computed, not a homepage section.`,
        })
        return
      }
      openSection(hit, `${sectionName(hit)} selected.`)
    }
    window.addEventListener("message", onMessage)
    return () => window.removeEventListener("message", onMessage)
  }, [baseOrigin, sections, openSection])

  const update = (next: HomeSection) =>
    setSections((items) => items.map((item) => (item.id === next.id ? next : item)))

  const publishLive = useMutation({
    mutationFn: async () => {
      if (!pageQ.data) throw new Error("Homepage not loaded yet.")
      const problems = validateSections(sections)
      if (problems.length > 0) throw new Error(problems[0]!.message)
      const saved = await homepageStudio.saveDraft(pageQ.data.revision, sections)
      return homepageStudio.publish(saved.revision, null)
    },
    onSuccess: (page) => {
      queryClient.setQueryData(["homepage-studio"], page)
      toast.success("Live on the storefront.")
      setAnnouncement("Section published live.")
      setRefreshTick((t) => t + 1)
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const deleteLive = useMutation({
    mutationFn: async (id: string) => {
      if (!pageQ.data) throw new Error("Homepage not loaded yet.")
      const next = sections.filter((item) => item.id !== id)
      const saved = await homepageStudio.saveDraft(pageQ.data.revision, next)
      return homepageStudio.publish(saved.revision, null)
    },
    onSuccess: (page) => {
      queryClient.setQueryData(["homepage-studio"], page)
      setSections(composeMarketCourse(page.sections))
      setSelectedId(null)
      toast.success("Section removed from the live site.")
      setRefreshTick((t) => t + 1)
    },
    onError: (error: Error) => toast.error(error.message),
  })

  if (pageQ.isLoading) {
    return (
      <div className="flex h-[calc(100dvh-0px)] flex-col gap-3 p-5" role="status" aria-label="Loading Live Studio">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-full w-full rounded-2xl" />
      </div>
    )
  }
  if (!pageQ.data) {
    return (
      <div className="flex h-[calc(100dvh-0px)] items-center justify-center p-5">
        <EmptyState
          title="Live Studio could not be loaded"
          description="Check your connection and try again."
          action={<Button onClick={() => void pageQ.refetch()}>Retry</Button>}
        />
      </div>
    )
  }

  return (
    <div className="flex h-[calc(100dvh-0px)] flex-col bg-muted/40">
      <div aria-live="polite" role="status" className="sr-only">{announcement}</div>
      {/* Toolbar */}
      <div className="flex h-14 shrink-0 items-center gap-2 border-b border-border bg-card px-3 sm:px-4">
        <Link to="/homepage" className="shrink-0">
          <Button variant="ghost" size="sm" className="gap-1.5">
            <ArrowLeft className="h-4 w-4" /> Studio
          </Button>
        </Link>
        <span className="hidden items-center gap-1.5 rounded-full bg-tone-danger-soft px-2.5 py-1 text-xs font-bold uppercase tracking-wider text-tone-danger-ink sm:inline-flex">
          <span className="h-1.5 w-1.5 rounded-full bg-current animate-pulse" /> Live
        </span>
        <div className="mx-auto flex items-center gap-1 rounded-xl border border-border bg-muted/60 p-1">
          <Button
            variant={!editMode ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setEditMode(false)}
            aria-pressed={!editMode}
          >
            View
          </Button>
          <Button
            variant={editMode ? "secondary" : "ghost"}
            size="sm"
            className="gap-1.5"
            onClick={() => setEditMode(true)}
            aria-pressed={editMode}
          >
            <PencilSimple className="h-3.5 w-3.5" /> Click to edit
          </Button>
        </div>
        <div className="hidden items-center gap-1 sm:flex" role="group" aria-label="Preview width">
          <Button variant={device === "mobile" ? "secondary" : "ghost"} size="sm" onClick={() => setDevice("mobile")} aria-label="Mobile width">
            <DeviceMobile className="h-4 w-4" />
          </Button>
          <Button variant={device === "desktop" ? "secondary" : "ghost"} size="sm" onClick={() => setDevice("desktop")} aria-label="Full width">
            <Desktop className="h-4 w-4" />
          </Button>
        </div>
        <Button variant="ghost" size="sm" onClick={() => setRefreshTick((t) => t + 1)} aria-label="Reload preview">
          <ArrowClockwise className="h-4 w-4" />
        </Button>
        <a href={`${base}/`} target="_blank" rel="noreferrer" className="shrink-0">
          <Button variant="outline" size="sm" className="gap-1.5">
            <ArrowSquareOut className="h-3.5 w-3.5" /> Open site
          </Button>
        </a>
      </div>
      {/* Live canvas */}
      <div className="flex min-h-0 flex-1 items-stretch justify-center p-3 sm:p-4">
        <div
          className={
            device === "mobile"
              ? "w-full max-w-[390px] overflow-hidden rounded-[2rem] border border-border bg-background shadow-lg"
              : "w-full overflow-hidden rounded-2xl border border-border bg-background shadow-lg"
          }
        >
          <iframe
            ref={frameRef}
            key={`${frameSrc}-${refreshTick}`}
            title="Live storefront preview"
            src={frameSrc}
            className="h-full min-h-[60vh] w-full"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
          />
        </div>
      </div>
      {/* Click popup */}
      <SlideOver
        open={selected !== null}
        label={selected ? `Edit ${sectionName(selected)}` : "Edit section"}
        returnFocusId={null}
        onClose={() => setSelectedId(null)}
      >
        {selected ? (
          <div className="flex h-full flex-col">
            <div className="min-h-0 flex-1 overflow-y-auto">
              <SectionEditor
                key={selected.id}
                section={selected}
                categories={flatCategories}
                headingRef={settingsHeadingRef}
                issues={selectedIssues}
                position={selectedIndex >= 0 ? `Section ${selectedIndex + 1} of ${sections.length}` : ""}
                onUpload={homepageStudio.upload}
                onChange={update}
                onDelete={() => deleteLive.mutate(selected.id)}
              />
            </div>
            <div className="flex shrink-0 items-center gap-2 border-t border-border bg-card p-4">
              <Button
                className="flex-1"
                disabled={publishLive.isPending || deleteLive.isPending}
                onClick={() => publishLive.mutate()}
              >
                {publishLive.isPending ? "Publishing…" : "Publish live"}
              </Button>
              <Button variant="outline" onClick={() => setSelectedId(null)}>
                Close
              </Button>
            </div>
          </div>
        ) : null}
      </SlideOver>
    </div>
  )
}
