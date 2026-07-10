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
import { ArrowUpIcon, ArrowDownIcon } from "@radix-ui/react-icons";
import { requireAdminAccessBeforeLoad } from "@/lib/auth";
import { toast } from "sonner";
import { SECTION_CONFIG_SCHEMAS } from "@/lib/homepage-section-configs";
import { SectionConfigEditor } from "@/components/admin/section-config-editor";

export const Route = createFileRoute("/_shop/admin/homepage")({
  beforeLoad: requireAdminAccessBeforeLoad,
  head: () => ({ meta: [{ title: "Homepage sections — Admin panel" }] }),
  component: AdminHomepagePage,
});

function sortByOrder(sections: HomepageSection[]): HomepageSection[] {
  return [...sections].sort((a, b) => a.sortOrder - b.sortOrder);
}

function AdminHomepagePage() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useListAdminHomepageSections();

  // sections list: order + enabled state
  const [sections, setSections] = useState<HomepageSection[]>([]);
  // per-section config objects (replaces JSON string drafts)
  const [configObjects, setConfigObjects] = useState<Record<number, Record<string, unknown>>>({});
  // per-section Zod validation error messages
  const [configErrors, setConfigErrors] = useState<Record<number, string>>({});
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);

  // Sync server data in two tiers:
  // - First load: sync everything (sections, config, enabled state).
  // - Subsequent refetches (e.g. after an image upload): update imageUrl per
  //   section only, leaving unsaved config edits and enabled toggles intact.
  useEffect(() => {
    if (!data) return;
    const sorted = sortByOrder(data.items);
    if (!hasLoadedOnce) {
      setSections(sorted);
      setConfigObjects(Object.fromEntries(sorted.map((s) => [s.id, s.config ?? {}])));
      setConfigErrors({});
      setHasLoadedOnce(true);
    } else {
      // Selective image-url refresh — preserves unsaved edits everywhere else.
      setSections((prev) =>
        prev.map((s) => {
          const fresh = sorted.find((f) => f.id === s.id);
          return fresh ? { ...s, imageUrl: fresh.imageUrl } : s;
        }),
      );
    }
  }, [data, hasLoadedOnce]);

  const updateSections = useUpdateAdminHomepageSections({
    mutation: {
      onSuccess: (updated) => {
        queryClient.invalidateQueries({ queryKey: getListAdminHomepageSectionsQueryKey() });
        toast.success("Homepage sections saved.");
        const sorted = sortByOrder(updated.items);
        setSections(sorted);
        setConfigObjects(Object.fromEntries(sorted.map((s) => [s.id, s.config ?? {}])));
        setConfigErrors({});
      },
      onError: () => toast.error("Could not save homepage sections."),
    },
  });

  function toggleEnabled(id: number, enabled: boolean) {
    setSections((prev) => prev.map((s) => (s.id === id ? { ...s, enabled } : s)));
  }

  function updateConfig(id: number, config: Record<string, unknown>) {
    setConfigObjects((prev) => ({ ...prev, [id]: config }));
    // Clear this section's error when the admin makes a change
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
    const errors: Record<number, string> = {};

    for (const section of sections) {
      const sectionType = section.type as keyof typeof SECTION_CONFIG_SCHEMAS;
      const schema = SECTION_CONFIG_SCHEMAS[sectionType];
      if (schema) {
        const result = schema.safeParse(configObjects[section.id] ?? {});
        if (!result.success) {
          const first = result.error.issues[0];
          errors[section.id] = first
            ? `${first.path.join(".") || "Config"}: ${first.message}`
            : "Invalid configuration";
        }
      }
    }

    if (Object.keys(errors).length > 0) {
      setConfigErrors(errors);
      toast.error("Fix configuration errors before saving.");
      return;
    }

    setConfigErrors({});
    updateSections.mutate({
      data: {
        sections: sections.map((s, i) => ({
          id: s.id,
          sortOrder: i,
          enabled: s.enabled,
          config: configObjects[s.id] ?? {},
        })),
      },
    });
  }

  const hasErrors = Object.keys(configErrors).length > 0;

  return (
    <AdminShell
      title="Homepage sections"
      description="Toggle, reorder and configure each homepage section with the structured editor below."
    >
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading sections…</p>
      ) : (
        <div className="space-y-4">
          {sections.map((section, index) => (
            <div key={section.id} className="rounded-md border border-border bg-background p-5">
              {/* Section header: reorder + name + enabled toggle */}
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
                    <div className="font-display text-base font-bold capitalize">
                      {section.type.replace(/_/g, " ")}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Position {index + 1} · <code className="font-mono">{section.type}</code>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    {section.enabled ? "Enabled" : "Hidden"}
                  </span>
                  <Switch
                    checked={section.enabled}
                    onCheckedChange={(checked) => toggleEnabled(section.id, checked)}
                  />
                </div>
              </div>

              {/* Structured config editor */}
              <SectionConfigEditor
                sectionId={section.id}
                type={section.type}
                config={configObjects[section.id] ?? {}}
                imageUrl={section.imageUrl}
                onChange={(config) => updateConfig(section.id, config)}
                validationError={configErrors[section.id]}
              />
            </div>
          ))}

          <div className="flex items-center justify-end gap-3">
            {hasErrors && (
              <p className="text-xs text-destructive">
                Fix the errors above before saving.
              </p>
            )}
            <Button
              onClick={saveAll}
              disabled={updateSections.isPending || hasErrors}
            >
              {updateSections.isPending ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </div>
      )}
    </AdminShell>
  );
}
