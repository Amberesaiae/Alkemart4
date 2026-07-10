/**
 * SectionConfigEditor — renders a purpose-built form panel for each of the
 * 10 homepage section types. Replaces the raw JSON textarea in the admin
 * homepage CMS editor.
 */
import { useId } from "react";
import { PlusIcon, TrashIcon, ArrowUpIcon, ArrowDownIcon } from "@radix-ui/react-icons";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ImageUploader } from "@/components/shop/image-uploader";
import { useListCategories, getListAdminHomepageSectionsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { HOMEPAGE_THEME_PRESETS } from "@/lib/homepage-themes";
import type { FeatureItem } from "@/lib/homepage-section-configs";
import { PRODUCT_TAGS, HERO_TONES } from "@/lib/homepage-section-configs";

// ─── Shared helpers ──────────────────────────────────────────────────────────

function str(v: unknown): string { return typeof v === "string" ? v : ""; }
function num(v: unknown, fallback: number): number { return typeof v === "number" ? v : fallback; }
function bool(v: unknown): boolean { return Boolean(v); }

interface FieldRowProps {
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}

function FieldRow({ label, hint, error, children }: FieldRowProps) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </Label>
      {children}
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

function SwitchRow({
  label,
  checked,
  onCheckedChange,
}: { label: string; checked: boolean; onCheckedChange: (v: boolean) => void }) {
  const id = useId();
  return (
    <div className="flex items-center gap-2">
      <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} />
      <Label htmlFor={id} className="text-sm cursor-pointer">
        {label}
      </Label>
    </div>
  );
}

// ─── ThemePicker ─────────────────────────────────────────────────────────────

function ThemePicker({
  config,
  onChange,
}: { config: Record<string, unknown>; onChange: (patch: Record<string, unknown>) => void }) {
  const theme = str(config.theme) || "default";
  const customBg = str(config.customBg) || "#8B1E2B";
  const customFg = str(config.customFg) || "#FDF6EC";

  return (
    <div className="rounded-md border border-dashed border-border p-3 space-y-3">
      <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Occasion theme
      </Label>
      <Select value={theme} onValueChange={(v) => onChange({ theme: v })}>
        <SelectTrigger className="w-52">
          <SelectValue placeholder="Theme" />
        </SelectTrigger>
        <SelectContent>
          {HOMEPAGE_THEME_PRESETS.map((p) => (
            <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      {theme === "custom" && (
        <div className="flex flex-wrap gap-4">
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
            Text colour
            <input
              type="color"
              value={customFg}
              onChange={(e) => onChange({ customFg: e.target.value })}
              className="h-8 w-10 cursor-pointer rounded border border-input"
            />
          </label>
        </div>
      )}
    </div>
  );
}

// ─── ProductRailFields (shared between product_rail and deals_grid) ──────────

function ProductRailFields({
  config,
  patch,
  showUseRealData = false,
}: {
  config: Record<string, unknown>;
  patch: (k: string, v: unknown) => void;
  showUseRealData?: boolean;
}) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <FieldRow label="Section title">
          <Input value={str(config.title)} onChange={(e) => patch("title", e.target.value)} placeholder="e.g. Best sellers" />
        </FieldRow>
        <FieldRow label="Product tag filter">
          <Select value={str(config.tag) || "__none__"} onValueChange={(v) => patch("tag", v === "__none__" ? undefined : v)}>
            <SelectTrigger><SelectValue placeholder="Any" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">Any (no filter)</SelectItem>
              {PRODUCT_TAGS.map((t) => (
                <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FieldRow>
        <FieldRow label="Product count">
          <Input
            type="number" min={1} max={24}
            value={num(config.count, 6)}
            onChange={(e) => patch("count", Math.max(1, parseInt(e.target.value) || 6))}
          />
        </FieldRow>
        <FieldRow label="Grid columns">
          <Input
            type="number" min={2} max={8}
            value={num(config.columns, 6)}
            onChange={(e) => patch("columns", Math.max(2, parseInt(e.target.value) || 6))}
          />
        </FieldRow>
      </div>
      <div className="flex flex-wrap gap-6">
        <SwitchRow label="Show 'Add to cart' button" checked={bool(config.showAdd)} onCheckedChange={(v) => patch("showAdd", v)} />
        {showUseRealData && (
          <SwitchRow label="Use live product data" checked={bool(config.useRealData)} onCheckedChange={(v) => patch("useRealData", v)} />
        )}
      </div>
    </div>
  );
}

// ─── CategoryPicker ───────────────────────────────────────────────────────────

function CategoryPicker({
  selectedIds,
  onChange,
}: { selectedIds: number[]; onChange: (ids: number[]) => void }) {
  const { data, isLoading } = useListCategories();
  const selected = new Set(selectedIds);

  function toggle(id: number, checked: boolean) {
    const next = new Set(selected);
    if (checked) next.add(id); else next.delete(id);
    onChange([...next]);
  }

  if (isLoading) return <p className="text-xs text-muted-foreground">Loading categories…</p>;
  if (!data?.length) return <p className="text-xs text-muted-foreground">No categories found.</p>;

  return (
    <div className="max-h-52 overflow-y-auto rounded-md border border-input p-2 space-y-1">
      {data.map((cat) => (
        <label key={cat.id} className="flex items-center gap-2 rounded px-1 py-0.5 text-sm cursor-pointer hover:bg-accent/40">
          <Checkbox
            checked={selected.has(cat.id)}
            onCheckedChange={(checked) => toggle(cat.id, Boolean(checked))}
          />
          {cat.name}
        </label>
      ))}
    </div>
  );
}

// ─── FeatureGridEditor ────────────────────────────────────────────────────────

function newFeatureItem(): FeatureItem {
  return { id: crypto.randomUUID(), icon: "", title: "", description: "" };
}

function FeatureGridEditor({
  config,
  onChange,
}: { config: Record<string, unknown>; onChange: (c: Record<string, unknown>) => void }) {
  const items: FeatureItem[] = Array.isArray(config.items)
    ? (config.items as FeatureItem[])
    : [];

  function setItems(next: FeatureItem[]) {
    onChange({ ...config, items: next });
  }

  function updateItem(idx: number, key: keyof FeatureItem, value: string) {
    setItems(items.map((item, i) => (i === idx ? { ...item, [key]: value } : item)));
  }

  function addItem() {
    setItems([...items, newFeatureItem()]);
  }

  function removeItem(idx: number) {
    setItems(items.filter((_, i) => i !== idx));
  }

  function moveItem(idx: number, dir: -1 | 1) {
    const target = idx + dir;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    [next[idx], next[target]] = [next[target], next[idx]];
    setItems(next);
  }

  return (
    <div className="space-y-3">
      {items.length === 0 && (
        <p className="text-xs text-muted-foreground">
          No items yet — click "Add item" to start. When items are defined here they replace the default static tiles on the homepage.
        </p>
      )}
      {items.map((item, idx) => (
        <div key={item.id} className="rounded-md border border-border bg-muted/30 p-3 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-muted-foreground">Item {idx + 1}</span>
            <div className="flex items-center gap-1">
              <Button type="button" variant="ghost" size="icon" className="h-6 w-6" disabled={idx === 0} onClick={() => moveItem(idx, -1)} aria-label="Move up">
                <ArrowUpIcon className="h-3 w-3" />
              </Button>
              <Button type="button" variant="ghost" size="icon" className="h-6 w-6" disabled={idx === items.length - 1} onClick={() => moveItem(idx, 1)} aria-label="Move down">
                <ArrowDownIcon className="h-3 w-3" />
              </Button>
              <Button type="button" variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-destructive" onClick={() => removeItem(idx)} aria-label="Remove">
                <TrashIcon className="h-3 w-3" />
              </Button>
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            <FieldRow label="Icon / emoji">
              <Input value={item.icon ?? ""} onChange={(e) => updateItem(idx, "icon", e.target.value)} placeholder="🛒" className="font-mono" />
            </FieldRow>
            <FieldRow label="Title *">
              <Input value={item.title} onChange={(e) => updateItem(idx, "title", e.target.value)} placeholder="e.g. Fast delivery" />
            </FieldRow>
            <FieldRow label="Description">
              <Input value={item.description ?? ""} onChange={(e) => updateItem(idx, "description", e.target.value)} placeholder="Short sentence" />
            </FieldRow>
          </div>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={addItem}>
        <PlusIcon className="h-3 w-3" />
        Add item
      </Button>
    </div>
  );
}

// ─── Per-type editor sub-components ──────────────────────────────────────────

interface EditorProps {
  config: Record<string, unknown>;
  sectionId: number;
  imageUrl?: string | null;
  onChange: (config: Record<string, unknown>) => void;
  onImageUploaded?: () => void;
}

function patch(config: Record<string, unknown>, key: string, value: unknown) {
  return { ...config, [key]: value };
}

function AnnouncementYellowEditor({ config, onChange }: EditorProps) {
  return (
    <FieldRow label="Headline" hint="Overrides the default promotional headline text.">
      <Input
        value={str(config.headline)}
        onChange={(e) => onChange(patch(config, "headline", e.target.value))}
        placeholder="Hurry & get 50% off a year of alkemart+…"
      />
    </FieldRow>
  );
}

function HeroEditor({ config, onChange, sectionId, imageUrl, onImageUploaded }: EditorProps) {
  const queryClient = useQueryClient();
  function p(k: string, v: unknown) { onChange(patch(config, k, v)); }
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <FieldRow label="Eyebrow">
          <Input value={str(config.eyebrow)} onChange={(e) => p("eyebrow", e.target.value)} placeholder="e.g. Introducing" />
        </FieldRow>
        <FieldRow label="Title">
          <Input value={str(config.title)} onChange={(e) => p("title", e.target.value)} placeholder="Hero headline" />
        </FieldRow>
        <FieldRow label="CTA button label">
          <Input value={str(config.cta)} onChange={(e) => p("cta", e.target.value)} placeholder="e.g. Shop now" />
        </FieldRow>
      </div>
      <div className="rounded-md border border-dashed border-border p-3">
        <ImageUploader
          targetType="homepage_section"
          targetId={sectionId}
          currentImageUrl={imageUrl}
          label="Hero image"
          ratio={16 / 9}
          onUploaded={() => {
            queryClient.invalidateQueries({ queryKey: getListAdminHomepageSectionsQueryKey() });
            onImageUploaded?.();
          }}
        />
      </div>
    </div>
  );
}

function ProductRailEditor({ config, onChange }: EditorProps) {
  function p(k: string, v: unknown) { onChange(patch(config, k, v)); }
  return <ProductRailFields config={config} patch={p} showUseRealData />;
}

function FeatureGridEditorWrapper({ config, onChange }: EditorProps) {
  return <FeatureGridEditor config={config} onChange={onChange} />;
}

function DealsGridEditor({ config, onChange }: EditorProps) {
  function p(k: string, v: unknown) { onChange(patch(config, k, v)); }
  return <ProductRailFields config={config} patch={p} />;
}

function CategoryRowEditor({ config, onChange }: EditorProps) {
  function p(k: string, v: unknown) { onChange(patch(config, k, v)); }
  const ids = Array.isArray(config.categoryIds) ? (config.categoryIds as number[]) : [];
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <FieldRow label="Section title">
          <Input value={str(config.title)} onChange={(e) => p("title", e.target.value)} placeholder="Get it all right here" />
        </FieldRow>
      </div>
      <FieldRow label="Pinned categories" hint="When selected, these categories appear in the row. Leave empty to show all default tiles.">
        <CategoryPicker selectedIds={ids} onChange={(v) => p("categoryIds", v)} />
      </FieldRow>
    </div>
  );
}

function BentoGridEditor({ config, onChange }: EditorProps) {
  function p(k: string, v: unknown) { onChange(patch(config, k, v)); }
  const isWithRail = config.variant === "with_rail";
  return (
    <div className="space-y-4">
      <FieldRow label="Variant">
        <Select value={isWithRail ? "with_rail" : "__default__"} onValueChange={(v) => p("variant", v === "__default__" ? undefined : v)}>
          <SelectTrigger className="w-52"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__default__">Default bento grid</SelectItem>
            <SelectItem value="with_rail">Bento + product rail</SelectItem>
          </SelectContent>
        </Select>
      </FieldRow>
      <ThemePicker config={config} onChange={(thPatch) => onChange({ ...config, ...thPatch })} />
      {isWithRail && (
        <div className="space-y-4 rounded-md border border-dashed border-border p-3">
          <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Rail settings</Label>
          <div className="grid gap-4 sm:grid-cols-2">
            <FieldRow label="Rail title">
              <Input value={str(config.railTitle)} onChange={(e) => p("railTitle", e.target.value)} />
            </FieldRow>
            <FieldRow label="Rail count">
              <Input type="number" min={1} max={12} value={num(config.railCount, 4)} onChange={(e) => p("railCount", Math.max(1, parseInt(e.target.value) || 4))} />
            </FieldRow>
            <FieldRow label="Rail columns">
              <Input type="number" min={2} max={6} value={num(config.railColumns, 4)} onChange={(e) => p("railColumns", Math.max(2, parseInt(e.target.value) || 4))} />
            </FieldRow>
          </div>
          <SwitchRow label="Show 'Add to cart' button" checked={bool(config.showAdd)} onCheckedChange={(v) => p("showAdd", v)} />
        </div>
      )}
    </div>
  );
}

function VideoGridEditor({ config, onChange }: EditorProps) {
  function p(k: string, v: unknown) { onChange(patch(config, k, v)); }
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <FieldRow label="Section title">
        <Input value={str(config.title)} onChange={(e) => p("title", e.target.value)} placeholder="Featured on alkemart TV" />
      </FieldRow>
    </div>
  );
}

function HeroSplitEditor({ config, onChange, sectionId, imageUrl, onImageUploaded }: EditorProps) {
  const queryClient = useQueryClient();
  function p(k: string, v: unknown) { onChange(patch(config, k, v)); }
  return (
    <div className="space-y-4">
      {/* Layout & tone */}
      <div className="grid gap-4 sm:grid-cols-3">
        <FieldRow label="Layout">
          <Select value={str(config.layout) || "hero_first"} onValueChange={(v) => p("layout", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="hero_first">Hero first</SelectItem>
              <SelectItem value="rail_first">Rail first</SelectItem>
            </SelectContent>
          </Select>
        </FieldRow>
        <FieldRow label="Hero tone">
          <Select value={str(config.heroTone) || "surface-strong"} onValueChange={(v) => p("heroTone", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {HERO_TONES.map((t) => (
                <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FieldRow>
        <FieldRow label="Image position">
          <Select value={str(config.heroImagePosition) || "right"} onValueChange={(v) => p("heroImagePosition", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="left">Left</SelectItem>
              <SelectItem value="right">Right</SelectItem>
            </SelectContent>
          </Select>
        </FieldRow>
      </div>
      {/* Hero copy */}
      <div className="grid gap-4 sm:grid-cols-2">
        <FieldRow label="Hero eyebrow">
          <Input value={str(config.heroEyebrow)} onChange={(e) => p("heroEyebrow", e.target.value)} placeholder="e.g. New arrivals" />
        </FieldRow>
        <FieldRow label="Hero title">
          <Input value={str(config.heroTitle)} onChange={(e) => p("heroTitle", e.target.value)} placeholder="Headline for the hero panel" />
        </FieldRow>
      </div>
      {/* Theme */}
      <ThemePicker config={config} onChange={(thPatch) => onChange({ ...config, ...thPatch })} />
      {/* Image */}
      <div className="rounded-md border border-dashed border-border p-3">
        <ImageUploader
          targetType="homepage_section"
          targetId={sectionId}
          currentImageUrl={imageUrl}
          label="Hero image"
          ratio={16 / 9}
          onUploaded={() => {
            queryClient.invalidateQueries({ queryKey: getListAdminHomepageSectionsQueryKey() });
            onImageUploaded?.();
          }}
        />
      </div>
      {/* Rail */}
      <div className="rounded-md border border-dashed border-border p-3 space-y-3">
        <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Product rail</Label>
        <div className="grid gap-4 sm:grid-cols-2">
          <FieldRow label="Rail title">
            <Input value={str(config.railTitle)} onChange={(e) => p("railTitle", e.target.value)} />
          </FieldRow>
          <FieldRow label="Rail eyebrow">
            <Input value={str(config.railEyebrow)} onChange={(e) => p("railEyebrow", e.target.value)} />
          </FieldRow>
          <FieldRow label="Tag filter">
            <Select value={str(config.railTag) || "__none__"} onValueChange={(v) => p("railTag", v === "__none__" ? undefined : v)}>
              <SelectTrigger><SelectValue placeholder="Any" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Any</SelectItem>
                {PRODUCT_TAGS.map((t) => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </FieldRow>
          <FieldRow label="Count">
            <Input type="number" min={1} max={12} value={num(config.railCount, 3)} onChange={(e) => p("railCount", Math.max(1, parseInt(e.target.value) || 3))} />
          </FieldRow>
          <FieldRow label="Columns">
            <Input type="number" min={2} max={6} value={num(config.railColumns, 3)} onChange={(e) => p("railColumns", Math.max(2, parseInt(e.target.value) || 3))} />
          </FieldRow>
        </div>
        <SwitchRow label="Show 'Add to cart'" checked={bool(config.showAdd)} onCheckedChange={(v) => p("showAdd", v)} />
      </div>
    </div>
  );
}

function ExpressBandEditor({ config, onChange }: EditorProps) {
  function p(k: string, v: unknown) { onChange(patch(config, k, v)); }
  return (
    <div className="space-y-4">
      <FieldRow label="Headline override" hint="Leave blank to use the default 'Delivery as soon as 1 hour*' text.">
        <Input value={str(config.headline)} onChange={(e) => p("headline", e.target.value)} placeholder="Delivery as soon as 1 hour*" />
      </FieldRow>
      <FieldRow label="Subtext override">
        <Input value={str(config.subtext)} onChange={(e) => p("subtext", e.target.value)} placeholder="Shop your faves, fast!" />
      </FieldRow>
    </div>
  );
}

// ─── Registry & main component ───────────────────────────────────────────────

const EDITOR_REGISTRY: Record<string, React.ComponentType<EditorProps>> = {
  announcement_yellow: AnnouncementYellowEditor,
  hero: HeroEditor,
  product_rail: ProductRailEditor,
  feature_grid: FeatureGridEditorWrapper,
  deals_grid: DealsGridEditor,
  category_row: CategoryRowEditor,
  bento_grid: BentoGridEditor,
  video_grid: VideoGridEditor,
  hero_split: HeroSplitEditor,
  express_band: ExpressBandEditor,
};

interface SectionConfigEditorProps {
  sectionId: number;
  type: string;
  config: Record<string, unknown>;
  imageUrl?: string | null;
  onChange: (config: Record<string, unknown>) => void;
  onImageUploaded?: () => void;
  /** Optional field-level error message to display at the top of this editor */
  validationError?: string;
}

export function SectionConfigEditor({
  sectionId,
  type,
  config,
  imageUrl,
  onChange,
  onImageUploaded,
  validationError,
}: SectionConfigEditorProps) {
  const Editor = EDITOR_REGISTRY[type];

  if (!Editor) {
    return (
      <p className="text-xs text-muted-foreground italic">
        No structured editor for section type "{type}".
      </p>
    );
  }

  return (
    <div className="mt-4 space-y-4">
      {validationError && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {validationError}
        </p>
      )}
      <Editor
        config={config}
        sectionId={sectionId}
        imageUrl={imageUrl}
        onChange={onChange}
        onImageUploaded={onImageUploaded}
      />
    </div>
  );
}
