import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/shop/logo";
import { useForgotPassword } from "@/lib/api-stubs"
import { forgotPasswordSchema, type ForgotPasswordFormValues } from "@/lib/form-schemas";

export const Route = createFileRoute("/signin_/forgot")({
  head: () => ({
    meta: [
      { title: "Forgot your password — alkemart Ghana" },
      { name: "description", content: "Request a password reset link for your alkemart account." },
      { property: "og:title", content: "Forgot your password — alkemart" },
      { property: "og:description", content: "Reset your alkemart Ghana account password." },
    ],
  }),
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const [submitted, setSubmitted] = useState(false);

  const form = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  });

  const forgotPassword = useForgotPassword({
    mutation: {
      onSuccess: () => setSubmitted(true),
    },
  });

  function onSubmit(values: ForgotPasswordFormValues) {
    forgotPassword.mutate({ data: { email: values.email.trim() } });
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

          {submitted ? (
            <div className="space-y-4">
              <h1 className="font-display text-2xl font-bold">Check your email</h1>
              <p className="text-sm text-muted-foreground">
                If an account exists for that email, we've sent a password reset link.
                The link expires in 1 hour.
              </p>
              <Button variant="outline" size="lg" className="w-full" asChild>
                <Link to="/signin">Return to sign in</Link>
              </Button>
            </div>
          ) : (
            <>
              <div>
                <h1 className="font-display text-2xl font-bold">Forgot your password?</h1>
                <p className="mt-2 text-sm text-muted-foreground">
                  Enter your email and we'll send you a reset link.
                </p>
              </div>

              <form className="space-y-4 text-left" onSubmit={form.handleSubmit(onSubmit)} noValidate>
                <div>
                  <Label htmlFor="email" className="text-sm font-bold">
                    Email <span className="text-muted-foreground">(required)</span>
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    className="mt-2 h-12"
                    placeholder="you@example.com"
                    {...form.register("email")}
                  />
                  {form.formState.errors.email && (
                    <p className="mt-1 text-xs font-semibold text-destructive">
                      {form.formState.errors.email.message}
                    </p>
                  )}
                </div>

                <Button size="lg" className="w-full" type="submit" disabled={forgotPassword.isPending}>
                  {forgotPassword.isPending ? "Sending..." : "Send reset link"}
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
