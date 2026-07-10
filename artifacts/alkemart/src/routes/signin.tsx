import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Logo } from "@/components/shop/logo";
import { CountrySelect } from "@/components/shop/country-select";
import { useLogin, getGetMeQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

const signinSearchSchema = z.object({
  redirect: z.string().optional(),
});

export const Route = createFileRoute("/signin")({
  validateSearch: signinSearchSchema,
  head: () => ({
    meta: [
      { title: "Sign in — alkemart Ghana" },
      { name: "description", content: "Sign in or create your alkemart account to check out and reorder." },
      { property: "og:title", content: "Sign in — alkemart" },
      { property: "og:description", content: "Sign in to your alkemart Ghana account." },
    ],
  }),
  component: SignInPage,
});

function SignInPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const search = Route.useSearch();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const login = useLogin({
    mutation: {
      onSuccess: (data) => {
        queryClient.setQueryData(getGetMeQueryKey(), { user: data });
        navigate({ to: search.redirect ?? "/account" });
      },
      onError: (err: unknown) => {
        const status = (err as { status?: number }).status;
        if (status === 404) {
          navigate({ to: "/signin/create", search: { email } });
          return;
        }
        setError("That password doesn't match this email. Please try again.");
      },
    },
  });

  function handleContinue() {
    setError(null);
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setError("Enter your email to continue.");
      return;
    }
    if (!password) {
      // No account check endpoint yet (deferred OTP flow) — send anyone without
      // a password straight to account creation with the email pre-filled.
      navigate({ to: "/signin/create", search: { email: trimmedEmail } });
      return;
    }
    login.mutate({ data: { email: trimmedEmail, password } });
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-[1200px] items-center justify-between px-4 py-4">
          <Link to="/" className="flex items-center gap-2">
            <div className="rounded-full bg-primary p-2">
              <Logo showWordmark={false} />
            </div>
            <span className="font-display text-lg font-bold lowercase text-primary">alkemart</span>
          </Link>
          <Link to="/" className="text-sm font-semibold text-muted-foreground hover:text-foreground">
            Cancel
          </Link>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-4 py-12">
        <div className="w-full space-y-6 text-center">
          <div className="flex justify-center">
            <div className="rounded-full bg-primary p-3">
              <Logo showWordmark={false} />
            </div>
          </div>

          <div>
            <h1 className="font-display text-2xl font-bold">Sign in or create your account</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Enter your phone number or email and we'll check for an existing alkemart account.
            </p>
          </div>

          <div className="space-y-4 text-left">
            <div>
              <Label className="text-sm font-bold">Country</Label>
              <div className="mt-2">
                <CountrySelect />
              </div>
            </div>
            <div>
              <Label htmlFor="identifier" className="text-sm font-bold">
                Phone number or email <span className="text-muted-foreground">(required)</span>
              </Label>
              <Input
                id="identifier"
                className="mt-2 h-12"
                placeholder="+233 24 000 0000"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="password" className="text-sm font-bold">
                Password <span className="text-muted-foreground">(leave blank if new)</span>
              </Label>
              <Input
                id="password"
                type="password"
                className="mt-2 h-12"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            {error && <p className="text-xs font-semibold text-destructive">{error}</p>}

            <div className="text-xs text-muted-foreground">
              Securing your personal information is our priority. See our{" "}
              <span className="cursor-default font-semibold text-primary underline">
                privacy measures
              </span>
              .
            </div>

            <Button size="lg" className="w-full" onClick={handleContinue} disabled={login.isPending}>
              {login.isPending ? "Checking..." : "Continue"}
            </Button>

            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" size="lg">Continue with Google</Button>
              <Button variant="outline" size="lg">Continue with Apple</Button>
            </div>
          </div>

          <Separator />

          <div className="rounded-md bg-secondary p-6 text-center">
            <div className="font-display text-lg font-bold lowercase">
              alkemart <span className="text-primary">Business</span>
            </div>
            <div className="mt-1 text-sm">Buying for a shop, hotel or office?</div>
            <Button variant="outline" size="sm" className="mt-3">
              Create a business account
            </Button>
          </div>
        </div>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-2 px-4 py-4 text-xs text-muted-foreground">
          <div>© 2026 alkemart Ghana Ltd. All Rights Reserved.</div>
          <div className="flex gap-4">
            <span className="cursor-default">Give feedback</span>
            <span className="cursor-default">Terms of Use</span>
            <span className="cursor-default">Privacy Notice</span>
            <span className="cursor-default">Notice at Collection</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
