import { useEffect } from "react"
import { createFileRoute, Link } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ChevronRightIcon } from "@radix-ui/react-icons";
import { UserAvatar } from "@/components/shop/user-avatar";
import { cn } from "@/lib/utils";
import { requireAuthBeforeLoad, useAuth } from "@/lib/auth";
import { useUpdateMyProfile, getGetMeQueryKey } from "@/lib/hooks-auth";
import { useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ShopPage } from "@/components/shop/shop-page";
import { CountrySelect } from "@/components/shop/country-select";
import {
  profileSchema,
  changePasswordSchema,
  type ProfileFormValues,
  type ChangePasswordFormValues,
} from "@/lib/form-schemas";
import { marketByCode, type MarketCode } from "@/lib/markets";
import { useChangeMyPassword } from "@/lib/api-extra";
import { useState } from "react";

export const Route = createFileRoute("/_shop/account")({
  beforeLoad: requireAuthBeforeLoad,
  head: () => ({
    meta: [
      { title: "Your account — alkemart Ghana" },
      { name: "description", content: "Manage orders, addresses, payments, lists and account settings." },
      { property: "og:title", content: "Your account — alkemart" },
      { property: "og:description", content: "Manage orders, payments and profile settings." },
    ],
  }),
  component: AccountPage,
});

const tiles: { title: string; body: string; to?: string; tone?: "primary" | "accent" | "default" }[] = [
  { title: "Purchase history", body: "Track, return or reorder past items.", to: "/orders", tone: "primary" },
  { title: "Lists", body: "Saved items, wish lists and registries.", to: "/account/lists" },
  { title: "Addresses", body: "Manage where alkemart delivers.", to: "/account/addresses" },
  { title: "Payment methods", body: "MoMo, cards and cash on delivery.", to: "/account/payments" },
  { title: "Message support", body: "Chat with support about an order.", to: "/support" },
];

function Tile({ title, body, to, tone = "default" }: (typeof tiles)[number]) {
  const Comp: any = to ? Link : "div";
  return (
    <Comp
      to={to}
      className={cn(
        "flex flex-col justify-between gap-6 rounded-md border border-border p-6 transition-colors hover:border-primary",
        tone === "primary" && "bg-primary text-primary-foreground border-transparent",
        tone === "accent" && "bg-accent text-accent-foreground border-transparent",
        tone === "default" && "bg-background",
      )}
      style={{ minHeight: 180 }}
    >
      <div>
        <h3 className="font-display text-lg font-bold">{title}</h3>
        <p className="mt-2 text-sm opacity-80">{body}</p>
      </div>
      <div className="flex items-center gap-1 text-sm font-semibold underline underline-offset-4">
        Open <ChevronRightIcon />
      </div>
    </Comp>
  );
}

function AccountPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const displayName = user
    ? [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email
    : "there";
  const displayFirstName = user?.firstName ?? "there";
  const market = marketByCode(user?.countryCode);

  const profileForm = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    values: {
      firstName: user?.firstName ?? "",
      lastName: user?.lastName ?? "",
      phone: user?.phone ?? "",
      countryCode: (user?.countryCode as MarketCode) || "GH",
      preferredCurrency: (user?.preferredCurrency as ProfileFormValues["preferredCurrency"]) || "GHS",
      locale: (user?.locale as ProfileFormValues["locale"]) || "en-GH",
    },
  });

  const passwordForm = useForm<ChangePasswordFormValues>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" },
  });

  const updateProfile = useUpdateMyProfile()

  useEffect(() => {
    if (updateProfile.isSuccess) {
      toast.success("Profile updated")
      setEditing(false)
    }
  }, [updateProfile.isSuccess])

  useEffect(() => {
    if (updateProfile.isError) {
      toast.error("Failed to update profile — please try again")
    }
  }, [updateProfile.isError])

  const changePassword = useChangeMyPassword();

  function onSaveProfile(values: ProfileFormValues) {
    const m = marketByCode(values.countryCode);
    updateProfile.mutate({
      firstName: values.firstName?.trim() || undefined,
      lastName: values.lastName?.trim() || undefined,
      phone: values.phone?.trim() || undefined,
      countryCode: values.countryCode,
      preferredCurrency: m.live ? m.currency : "GHS",
      locale: m.locale,
    })
  }

  function onChangePassword(values: ChangePasswordFormValues) {
    changePassword.mutate(
      { currentPassword: values.currentPassword, newPassword: values.newPassword },
      {
        onSuccess: () => {
          toast.success("Password updated");
          passwordForm.reset();
          setShowPassword(false);
        },
        onError: (err: unknown) => {
          const status = (err as { status?: number }).status;
          toast.error(
            status === 401 ? "Current password is incorrect" : "Could not change password",
          );
        },
      },
    );
  }

  return (
    <ShopPage>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex items-center gap-5">
          <UserAvatar size="lg" name={displayName} isMember />
          <div>
            <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Welcome back
            </div>
            <h1 className="mt-2 font-display text-4xl font-bold tracking-tight">Hi, {displayFirstName}</h1>
            <p className="mt-1 text-muted-foreground">
              {user?.email}
              {user?.countryCode ? ` · ${market.name}` : ""}
              {user?.preferredCurrency ? ` · ${user.preferredCurrency}` : ""}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {!editing && (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="rounded-full border border-border bg-background px-4 py-2 text-sm font-semibold transition-colors hover:border-primary hover:text-primary"
            >
              Edit profile
            </button>
          )}
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="rounded-full border border-border bg-background px-4 py-2 text-sm font-semibold transition-colors hover:border-primary hover:text-primary"
          >
            {showPassword ? "Hide password" : "Change password"}
          </button>
        </div>
      </header>

      {editing && (
        <section className="rounded-md border border-border bg-background p-6">
          <h2 className="mb-5 font-display text-xl font-bold">Edit profile & market prefs</h2>
          <form onSubmit={profileForm.handleSubmit(onSaveProfile)} className="space-y-4" noValidate>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="firstName">First name</Label>
                <Input id="firstName" {...profileForm.register("firstName")} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="lastName">Last name</Label>
                <Input id="lastName" {...profileForm.register("lastName")} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="phone">Phone number</Label>
              <Input id="phone" type="tel" {...profileForm.register("phone")} />
              {profileForm.formState.errors.phone && (
                <p className="text-xs text-destructive">{profileForm.formState.errors.phone.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Country / market</Label>
              <CountrySelect
                value={profileForm.watch("countryCode")}
                onChange={(code) => {
                  const m = marketByCode(code);
                  profileForm.setValue("countryCode", code);
                  profileForm.setValue(
                    "preferredCurrency",
                    (m.live ? m.currency : "GHS") as ProfileFormValues["preferredCurrency"],
                  );
                  profileForm.setValue("locale", m.locale as ProfileFormValues["locale"]);
                }}
              />
            </div>
            <div className="flex gap-3 pt-2">
              <Button type="submit" disabled={updateProfile.isPending}>
                {updateProfile.isPending ? "Saving…" : "Save changes"}
              </Button>
              <Button type="button" variant="outline" onClick={() => setEditing(false)}>
                Cancel
              </Button>
            </div>
          </form>
        </section>
      )}

      {showPassword && (
        <section className="rounded-md border border-border bg-background p-6">
          <h2 className="mb-5 font-display text-xl font-bold">Change password</h2>
          <form onSubmit={passwordForm.handleSubmit(onChangePassword)} className="max-w-md space-y-4" noValidate>
            <div className="space-y-1.5">
              <Label htmlFor="currentPassword">Current password</Label>
              <Input id="currentPassword" type="password" autoComplete="current-password" {...passwordForm.register("currentPassword")} />
              {passwordForm.formState.errors.currentPassword && (
                <p className="text-xs text-destructive">{passwordForm.formState.errors.currentPassword.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="newPassword">New password</Label>
              <Input id="newPassword" type="password" autoComplete="new-password" {...passwordForm.register("newPassword")} />
              {passwordForm.formState.errors.newPassword && (
                <p className="text-xs text-destructive">{passwordForm.formState.errors.newPassword.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirmPassword">Confirm new password</Label>
              <Input id="confirmPassword" type="password" autoComplete="new-password" {...passwordForm.register("confirmPassword")} />
              {passwordForm.formState.errors.confirmPassword && (
                <p className="text-xs text-destructive">{passwordForm.formState.errors.confirmPassword.message}</p>
              )}
            </div>
            <Button type="submit" disabled={changePassword.isPending}>
              {changePassword.isPending ? "Updating…" : "Update password"}
            </Button>
          </form>
        </section>
      )}

      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {tiles.map((t) => (
          <Tile key={t.title} {...t} />
        ))}
      </section>
    </ShopPage>
  );
}
