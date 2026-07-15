import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { AlkemartAddress, AddressFormValues } from "@/lib/hooks-cart";

export type { AddressFormValues };

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  address?: AlkemartAddress;
  isSaving?: boolean;
  onSubmit: (values: AddressFormValues) => void;
}

const emptyValues: AddressFormValues = {
  label: "",
  fullName: "",
  phone: "",
  line1: "",
  city: "",
  region: "",
  digitalAddress: "",
  countryCode: "GH",
  isDefault: false,
};

export function AddressForm({ open, onOpenChange, address, isSaving, onSubmit }: Props) {
  const [values, setValues] = useState<AddressFormValues>(emptyValues);

  useEffect(() => {
    if (open) {
      setValues(
        address
          ? {
              label: address.label ?? "",
              fullName: address.fullName,
              phone: address.phone,
              line1: address.line1,
              city: address.city,
              region: address.region ?? "",
              digitalAddress: address.digitalAddress ?? "",
              countryCode: address.countryCode ?? "GH",
              isDefault: address.isDefault,
            }
          : emptyValues,
      );
    }
  }, [open, address]);

  const [fieldError, setFieldError] = useState<string | null>(null);

  const canSubmit =
    values.fullName.trim() &&
    values.phone.trim().replace(/\D/g, "").length >= 9 &&
    values.line1.trim() &&
    values.city.trim();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFieldError(null);
    const phoneDigits = values.phone.trim().replace(/\D/g, "");
    if (!values.fullName.trim() || !values.line1.trim() || !values.city.trim()) {
      setFieldError("Name, address and city are required.");
      return;
    }
    if (phoneDigits.length < 9) {
      setFieldError("Phone must be at least 9 digits.");
      return;
    }
    onSubmit({
      ...values,
      label: values.label?.trim() || undefined,
      region: values.region?.trim() || undefined,
      digitalAddress: values.digitalAddress?.trim() || undefined,
      countryCode: (values.countryCode || "GH").toUpperCase(),
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{address ? "Edit address" : "Add a new address"}</DialogTitle>
            <DialogDescription>Used for delivery ETAs and courier hand-off.</DialogDescription>
          </DialogHeader>

          {fieldError && (
            <p className="mt-3 text-xs font-semibold text-destructive">{fieldError}</p>
          )}

          <div className="mt-4 grid gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="address-label">Label (optional)</Label>
              <Input
                id="address-label"
                placeholder="Home, Work…"
                value={values.label}
                onChange={(e) => setValues((v) => ({ ...v, label: e.target.value }))}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label htmlFor="address-name">Recipient name</Label>
                <Input
                  id="address-name"
                  required
                  value={values.fullName}
                  onChange={(e) => setValues((v) => ({ ...v, fullName: e.target.value }))}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="address-phone">Phone</Label>
                <Input
                  id="address-phone"
                  required
                  placeholder="0244 000 000"
                  value={values.phone}
                  onChange={(e) => setValues((v) => ({ ...v, phone: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="address-line1">Street address</Label>
              <Input
                id="address-line1"
                required
                placeholder="18 Cantonments Rd"
                value={values.line1}
                onChange={(e) => setValues((v) => ({ ...v, line1: e.target.value }))}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label htmlFor="address-city">City / Town</Label>
                <Input
                  id="address-city"
                  required
                  placeholder="City"
                  value={values.city}
                  onChange={(e) => setValues((v) => ({ ...v, city: e.target.value }))}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="address-region">Region (optional)</Label>
                <Input
                  id="address-region"
                  placeholder="Region (optional)"
                  value={values.region}
                  onChange={(e) => setValues((v) => ({ ...v, region: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="address-digital">Ghana Post GPS digital address (optional)</Label>
              <Input
                id="address-digital"
                placeholder="GA-183-1234"
                value={values.digitalAddress}
                onChange={(e) => setValues((v) => ({ ...v, digitalAddress: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground">
                Look yours up at{" "}
                <a
                  href="https://ghanapostgps.com"
                  target="_blank"
                  rel="noreferrer"
                  className="underline"
                >
                  ghanapostgps.com
                </a>{" "}
                — helps couriers find you precisely.
              </p>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={values.isDefault}
                onCheckedChange={(checked) => setValues((v) => ({ ...v, isDefault: checked === true }))}
              />
              Make this my default address
            </label>
          </div>

          <DialogFooter className="mt-6">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!canSubmit || isSaving}>
              {isSaving ? "Saving…" : address ? "Save changes" : "Add address"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
