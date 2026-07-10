import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListAdminHomepageSections,
  useUpdateAdminHomepageSections,
  getListAdminHomepageSectionsQueryKey,
} from "@workspace/api-client-react";
import type { HomepageSection } from "@workspace/api-client-react";
import { AdminShell } from "@/components/admin/admin-nav";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ImageUploader } from "@/components/shop/image-uploader";
import { ArrowUpIcon, ArrowDownIcon } from "@radix-ui/react-icons";
import { requireAdminAccessBeforeLoad } from "@/lib/auth";
import { toast } from "sonner";
import { HOMEPAGE_THEME_PRESETS } from "@/lib/homepage-themes";

const IMAGEABLE_SECTION_TYPES = new Set(["hero", "hero_split"]);

const THEMEABLE_SECTION_TYPES = new Set(["bento_grid", "hero_split"]);

function parseDraftConfig(draft: string | undefined): Record<string, unknown> {
  try {
    const parsed = JSON.parse(draft ?? "{}");
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export const Route = createFileRoute("/_shop/admin/homepage")({
  beforeLoad: requireAdminAccessBeforeLoad,
  head: () => ({ meta: [{ title: "Homepage sections — Admin panel" }] }),
  component: AdminHomepagePage,
});

function sortByOrder(sections: HomepageSection[]): HomepageSection[] {
  return [...sections].sort((a, b) => a.sortOrder - b.sortOrder);
}

function ThemePicker({
  config,
  onChange,
}: {
  config: Record<string, unknown>;
  onChange: (patch: Record<string, unknown>) => void;
}) {
  const theme = typeof config.theme === "string" ? config.theme : "default";
  const customBg = typeof config.customBg === "string" ? config.customBg : "#8B1E2B";
  const customFg = typeof config.customFg === "string" ? config.customFg : "#FDF6EC";

  return (
    <div className="mt-4 rounded-md border border-dashed border-border p-3">
      <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Occasion theme
      </label>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <Select value={theme} onValueChange={(value) => onChange({ theme: value })}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Theme" />
          </SelectTrigger>
          <SelectContent>
            {HOMEPAGE_THEME_PRESETS.map((preset) => (
              <SelectItem key={preset.value} value={preset.value}>
                {preset.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {theme === "custom" && (
          <>
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              Background
              <input
                type="color"
                value={customBg}
                onChange={(e) => onChange({ customBg: e.target.value })}
                className="h-8 w-10 cursor-pointer rounded border border-input"
              />
            </label>
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              Text
              <input
                type="color"
                value={customFg}
                onChange={(e) => onChange({ customFg: e.target.value })}
                className="h-8 w-10 cursor-pointer rounded border border-input"
              />
            </label>
          </>
        )}
      </div>
    </div>
  );
}

function AdminHomepagePage() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useListAdminHomepageSections();
  const [sections, setSections] = useState<HomepageSection[]>([]);
  const [configDrafts, setConfigDrafts] = useState<Record<number, string>>({});
  const [configErrors, setConfigErrors] = useState<Record<number, string>>({});
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);

  // Only sync server data into local editable draft state on the initial
  // load (or right after a save, which sets this state directly in
  // onSuccess below). Background refetches (e.g. window focus, query
  // invalidation) must never clobber in-progress, unsaved edits.
  useEffect(() => {
    if (data && !hasLoadedOnce) {
      const sorted = sortByOrder(data.items);
      setSections(sorted);
      setConfigDrafts(Object.fromEntries(sorted.map((s) => [s.id, JSON.stringify(s.config, null, 2)])));
      setConfigErrors({});
      setHasLoadedOnce(true);
    }
  }, [data, hasLoadedOnce]);

  const updateSections = useUpdateAdminHomepageSections({
    mutation: {
      onSuccess: (updated) => {
        queryClient.invalidateQueries({ queryKey: getListAdminHomepageSectionsQueryKey() });
        toast.success("Homepage sections saved.");
        const sorted = sortByOrder(updated.items);
        setSections(sorted);
        setConfigDrafts(Object.fromEntries(sorted.map((s) => [s.id, JSON.stringify(s.config, null, 2)])));
      },
      onError: () => toast.error("Could not save homepage sections."),
    },
  });

  function toggleEnabled(id: number, enabled: boolean) {
    setSections((prev) => prev.map((s) => (s.id === id ? { ...s, enabled } : s)));
  }

  function patchThemeFields(id: number, patch: Record<string, unknown>) {
    setConfigDrafts((prev) => {
      const current = parseDraftConfig(prev[id]);
      const next = { ...current, ...patch };
      return { ...prev, [id]: JSON.stringify(next, null, 2) };
    });
    setConfigErrors((prev) => {
      if (!prev[id]) return prev;
      const { [id]: _removed, ...rest } = prev;
      return rest;
    });
  }

  function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= sections.length) return;
    const next = [...sections];
    [next[index], next[target]] = [next[target], next[index]];
    setSections(next.map((s, i) => ({ ...s, sortOrder: i })));
  }

  function saveAll() {
    let parsedConfigs: Record<number, Record<string, unknown>> = {};
    const errors: Record<number, string> = {};
    for (const section of sections) {
      try {
        parsedConfigs[section.id] = JSON.parse(configDrafts[section.id] ?? "{}");
      } catch {
        errors[section.id] = "Invalid JSON";
      }
    }
    if (Object.keys(errors).length > 0) {
      setConfigErrors(errors);
      toast.error("Fix invalid config JSON before saving.");
      return;
    }
    setConfigErrors({});

    updateSections.mutate({
      data: {
        sections: sections.map((s, i) => ({
          id: s.id,
          sortOrder: i,
          enabled: s.enabled,
          config: parsedConfigs[s.id],
        })),
      },
    });
  }

  return (
    <AdminShell title="Homepage sections" description="Toggle, reorder and tweak the config of each homepage section.">
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading sections…</p>
      ) : (
        <div className="space-y-4">
          {sections.map((section, index) => (
            <div key={section.id} className="rounded-md border border-border bg-background p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex flex-col">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      disabled={index === 0}
                      onClick={() => move(index, -1)}
                      aria-label="Move up"
                    >
                      <ArrowUpIcon />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      disabled={index === sections.length - 1}
                      onClick={() => move(index, 1)}
                      aria-label="Move down"
                    >
                      <ArrowDownIcon />
                    </Button>
                  </div>
                  <div>
                    <div className="font-display text-base font-bold">{section.type}</div>
                    <div className="text-xs text-muted-foreground">Position {index + 1}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">{section.enabled ? "Enabled" : "Hidden"}</span>
                  <Switch checked={section.enabled} onCheckedChange={(checked) => toggleEnabled(section.id, checked)} />
                </div>
              </div>

              {THEMEABLE_SECTION_TYPES.has(section.type) && (
                <ThemePicker
                  config={parseDraftConfig(configDrafts[section.id])}
                  onChange={(patch) => patchThemeFields(section.id, patch)}
                />
              )}

              {IMAGEABLE_SECTION_TYPES.has(section.type) && (
                <div className="mt-4 rounded-md border border-dashed border-border p-3">
                  <ImageUploader
                    targetType="homepage_section"
                    targetId={section.id}
                    currentImageUrl={section.imageUrl}
                    label="Section image"
                    ratio={16 / 9}
                    onUploaded={() =>
                      queryClient.invalidateQueries({ queryKey: getListAdminHomepageSectionsQueryKey() })
                    }
                  />
                </div>
              )}

              <div className="mt-4">
                <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Config (JSON)</label>
                <Textarea
                  className="mt-1 font-mono text-xs"
                  aria-label="Configuration JSON"
                  rows={4}
                  value={configDrafts[section.id] ?? "{}"}
                  onChange={(e) => setConfigDrafts((prev) => ({ ...prev, [section.id]: e.target.value }))}
                />
                {configErrors[section.id] && <p className="mt-1 text-xs text-destructive">{configErrors[section.id]}</p>}
              </div>
            </div>
          ))}

          <div className="flex justify-end">
            <Button onClick={saveAll} disabled={updateSections.isPending}>
              {updateSections.isPending ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </div>
      )}
    </AdminShell>
  );
}
