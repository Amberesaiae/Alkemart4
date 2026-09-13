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
  formatSchedule,
} from "@workspace/ui"

export function PublishBar({ status, hiddenCount, saving, publishing, publishAt, unpublishAt, onPublishAt, onUnpublishAt, onSave, onPublish }: {
  status: string
  hiddenCount: number
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
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Badge variant="secondary" className="px-3 py-1.5 capitalize">{status}</Badge>
      {hiddenCount ? <Badge variant="warning" className="px-3 py-1.5">{hiddenCount} hidden / scheduled</Badge> : null}
      <Button variant="outline" onClick={onSave} isLoading={saving}>
        {!saving && <FloppyDisk className="mr-2 h-4 w-4" aria-hidden="true" />}
        Save draft
      </Button>
      <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" aria-label={publishAt ? `Publishing options. Scheduled for ${formatSchedule(publishAt)}` : undefined}>
            <CalendarBlank className="mr-2 h-4 w-4" aria-hidden="true" />
            {publishAt ? formatSchedule(publishAt) : "Schedule"}
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
        {!publishing && <RocketLaunch className="mr-2 h-4 w-4" aria-hidden="true" />}
        {publishAt ? "Schedule" : "Publish"}
      </Button>
    </div>
  )
}
