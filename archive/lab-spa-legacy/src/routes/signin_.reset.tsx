import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/shop/logo";
import { useResetPassword } from "@/lib/api-stubs"
import { resetPasswordSchema, type ResetPasswordFormValues } from "@/lib/form-schemas";

const resetSearchSchema = z.object({
  token: z.string().min(1, "Missing reset token"),
});

export const Route = createFileRoute("/signin_/reset")({
  validateSearch: resetSearchSchema,
  head: () => ({
    meta: [
      { title: "Reset your password — alkemart Ghana" },
      { name: "description", content: "Set a new password for your alkemart account." },
      { property: "og:title", content: "Reset your password — alkemart" },
      { property: "og:description", content: "Set a new password for your alkemart Ghana account." },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const [done, setDone] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const form = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { token: search.token, newPassword: "", confirmPassword: "" },
  });

  const resetPassword = useResetPassword({
    mutation: {
      onSuccess: () => setDone(true),
      onError: (err: unknown) => {
        const msg = (err as { message?: string }).message;
        setServerError(msg?.includes("expired") ? "This reset link has expired. Please request a new one." : "Invalid reset link. Please request a new one.");
      },
    },
  });

  function onSubmit(values: ResetPasswordFormValues) {
    setServerError(null);
    resetPassword.mutate({
      data: { token: values.token, newPassword: values.newPassword },
    });
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-[1200px] items-center justify-between px-4 py-4">
          <Link to="/" className="inline-flex" aria-label="alkemart home">
            <Logo variant="onLight" />
          </Link>
          <Link to="/signin" className="text-sm font-semibold text-muted-foreground hover:text-foreground">
            Back to sign in
          </Link>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-4 py-12">
        <div className="w-full space-y-6 text-center">
          <div className="flex justify-center">
            <Link to="/" className="inline-flex" aria-label="alkemart home">
              <Logo variant="onLight" />
            </Link>
          </div>

          {done ? (
            <div className="space-y-4">
              <h1 className="font-display text-2xl font-bold">Password reset</h1>
              <p className="text-sm text-muted-foreground">
                Your password has been updated. You can now sign in with your new password.
              </p>
              <Button size="lg" className="w-full" asChild>
                <Link to="/signin">Sign in</Link>
              </Button>
            </div>
          ) : (
            <>
              <div>
                <h1 className="font-display text-2xl font-bold">Set a new password</h1>
                <p className="mt-2 text-sm text-muted-foreground">
                  Choose a strong password with at least 8 characters.
                </p>
              </div>

              <form className="space-y-4 text-left" onSubmit={form.handleSubmit(onSubmit)} noValidate>
                <div>
                  <Label htmlFor="newPassword" className="text-sm font-bold">
                    New password <span className="text-muted-foreground">(required)</span>
                  </Label>
                  <Input
                    id="newPassword"
                    type="password"
                    autoComplete="new-password"
                    className="mt-2 h-12"
                    placeholder="At least 8 characters"
                    {...form.register("newPassword")}
                  />
                  {form.formState.errors.newPassword && (
                    <p className="mt-1 text-xs font-semibold text-destructive">
                      {form.formState.errors.newPassword.message}
                    </p>
                  )}
                </div>

                <div>
                  <Label htmlFor="confirmPassword" className="text-sm font-bold">
                    Confirm password <span className="text-muted-foreground">(required)</span>
                  </Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    autoComplete="new-password"
                    className="mt-2 h-12"
                    placeholder="Re-enter your new password"
                    {...form.register("confirmPassword")}
                  />
                  {form.formState.errors.confirmPassword && (
                    <p className="mt-1 text-xs font-semibold text-destructive">
                      {form.formState.errors.confirmPassword.message}
                    </p>
                  )}
                </div>

                {serverError && (
                  <p className="text-xs font-semibold text-destructive">{serverError}</p>
                )}

                <Button size="lg" className="w-full" type="submit" disabled={resetPassword.isPending}>
                  {resetPassword.isPending ? "Resetting..." : "Reset password"}
                </Button>

                <Button variant="ghost" size="lg" className="w-full" asChild>
                  <Link to="/signin">Back to sign in</Link>
                </Button>
              </form>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
