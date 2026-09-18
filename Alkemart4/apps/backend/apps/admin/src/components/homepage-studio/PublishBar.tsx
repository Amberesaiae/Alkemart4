import { CalendarBlank, FloppyDisk, RocketLaunch } from "@phosphor-icons/react"
import { startOfDay } from "date-fns"
import { useState } from "react"
import {
  Badge,
  Button,
  Popover,
  PopoverContent,
  PopoverTrigger,
  SchedulePicker,
  cn,
  formatSchedule,
} from "@workspace/ui"

/**
 * Studio command-bar actions: one status cluster plus Save / Timing /
 * Publish. Lives in the sticky shell header so publishing is reachable
 * without scrolling past the canvas.
 */
export function PublishBar({ status, hiddenCount, issueCount, saving, publishing, publishAt, unpublishAt, onPublishAt, onUnpublishAt, onSave, onPublish }: {
  status: string
  hiddenCount: number
  issueCount: number
  saving: boolean
  publishing: boolean
  publishAt: string | null
  unpublishAt: string | null
  onPublishAt: (value: string | null) => void
  onUnpublishAt: (value: string | null) => void
  onSave: () => void
  onPublish: () => void
}) {
  const [open, setOpen] = useState(false)
  const statusDot = status === "published"
    ? "bg-tone-success"
    : status === "scheduled"
      ? "bg-tone-warning"
      : "bg-tone-neutral"
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-2">
      <span className="inline-flex items-center gap-2 rounded-full border border-border bg-white py-1.5 pl-3 pr-3 text-xs font-semibold">
        <span className={cn("size-1.5 rounded-full", statusDot)} aria-hidden="true" />
        <span className="capitalize">{status}</span>
        {hiddenCount ? (
          <span className="font-normal text-muted-foreground">· {hiddenCount} hidden</span>
        ) : null}
      </span>
      {issueCount ? (
        <Badge variant="destructive" className="px-2.5 py-1" title="Fix the flagged sections before saving">
          {issueCount} to fix
        </Badge>
      ) : null}
      <span className="mx-1 hidden h-5 w-px bg-border sm:block" aria-hidden="true" />
      <Button variant="outline" size="sm" onClick={onSave} isLoading={saving}>
        {!saving && <FloppyDisk className="mr-1.5 h-4 w-4" aria-hidden="true" />}
        Save draft
      </Button>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="sm" aria-label={publishAt ? `Publishing timing. Scheduled for ${formatSchedule(publishAt)}` : "Publishing timing"}>
            <CalendarBlank className="mr-1.5 h-4 w-4" aria-hidden="true" />
            {publishAt ? formatSchedule(publishAt) : "Timing"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-4" align="end">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <p className="text-sm font-bold">Publishing options</p>
              <p className="text-xs text-muted-foreground">Pick a date, then a time of day. Leave empty to publish immediately.</p>
            </div>
            <div className="flex flex-col gap-1.5">
              <span id="publish-at-label" className="text-sm font-semibold">Publish at</span>
              <SchedulePicker label="Publish at" labelledBy="publish-at-label" value={publishAt} minDate={startOfDay(new Date())} onChange={onPublishAt} />
            </div>
            <div className="flex flex-col gap-1.5">
              <span id="unpublish-at-label" className="text-sm font-semibold">Unpublish at</span>
              <SchedulePicker label="Unpublish at" labelledBy="unpublish-at-label" value={unpublishAt} minDate={publishAt ? new Date(publishAt) : startOfDay(new Date())} onChange={onUnpublishAt} />
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" className="flex-1" onClick={() => { onPublishAt(null); onUnpublishAt(null) }}>
                Clear schedule
              </Button>
              <Button type="button" size="sm" className="flex-1" onClick={() => setOpen(false)}>
                Done
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>
      <Button onClick={onPublish} isLoading={publishing}>
        {!publishing && <RocketLaunch className="mr-1.5 h-4 w-4" aria-hidden="true" />}
        {publishAt ? "Schedule publish" : "Publish"}
      </Button>
    </div>
  )
}
