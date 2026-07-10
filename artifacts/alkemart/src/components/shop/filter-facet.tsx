import {
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

interface FilterFacetProps {
  label: string;
  items: string[];
  selectedItems?: string[];
  onToggle?: (item: string) => void;
}

export function FilterFacet({ label, items, selectedItems = [], onToggle }: FilterFacetProps) {
  return (
    <AccordionItem value={label} className="border-border">
      <AccordionTrigger className="text-sm font-semibold">{label}</AccordionTrigger>
      <AccordionContent>
        <div className="space-y-2">
          {items.map((it) => (
            <div key={it} className="flex items-center gap-2">
              <Checkbox
                id={`${label}-${it}`}
                checked={selectedItems.includes(it)}
                onCheckedChange={() => onToggle?.(it)}
              />
              <Label
                htmlFor={`${label}-${it}`}
                className="text-xs font-normal text-muted-foreground cursor-pointer select-none"
              >
                {it}
              </Label>
            </div>
          ))}
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}
