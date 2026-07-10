import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Logo } from "@/components/shop/logo";
import { useSignup, getGetMeQueryKey } from "@workspace/api-client-react";

const createSearchSchema = z.object({
  email: z.string().optional(),
});

export const Route = createFileRoute("/signin_/create")({
  validateSearch: createSearchSchema,
  head: () => ({
    meta: [
      { title: "Create your account — alkemart Ghana" },
      { name: "description", content: "Finish creating your alkemart Ghana account — a few details and you're in." },
      { property: "og:title", content: "Create your account — alkemart" },
      { property: "og:description", content: "Finish setting up your alkemart Ghana account." },
      { property: "og:url", content: "/signin/create" },
    ],
    links: [{ rel: "canonical", href: "/signin/create" }],
  }),
  component: CreatePage,
});

function CreatePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const search = Route.useSearch();
  const [email, setEmail] = useState(search.email ?? "");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const signup = useSignup({
    mutation: {
      onSuccess: (data) => {
        queryClient.setQueryData(getGetMeQueryKey(), { user: data });
        navigate({ to: "/account" });
      },
      onError: (err: unknown) => {
        const status = (err as { status?: number }).status;
        setError(
          status === 409
            ? "An account already exists for that email. Try signing in instead."
            : "Something went wrong creating your account. Please try again.",
        );
      },
    },
  });

  function handleCreate() {
    setError(null);
    if (!email.trim()) {
      setError("An email address is required.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    signup.mutate({ data: { email, password, firstName, lastName } });
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
          <Link to="/signin" className="text-sm font-semibold text-muted-foreground hover:text-foreground">
            Back to sign in
          </Link>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-[440px] flex-1 flex-col items-center justify-center px-4 py-12">
        <div className="w-full space-y-6">
          <div className="text-center">
            <div className="text-xs font-semibold uppercase tracking-widest text-accent">Step 2 of 2</div>
            <h1 className="mt-2 font-display text-2xl font-bold">Create your account</h1>
            <p className="mt-2 text-sm text-muted-foreground">A few details and you're in.</p>
          </div>

          <div className="space-y-4">
            <div>
              <Label htmlFor="email" className="text-sm font-bold">Email</Label>
              <Input
                id="email"
                type="email"
                className="mt-2 h-12"
                placeholder="ama@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="fn" className="text-sm font-bold">First name</Label>
                <Input
                  id="fn"
                  className="mt-2 h-12"
                  placeholder="Ama"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="ln" className="text-sm font-bold">Last name</Label>
                <Input
                  id="ln"
                  className="mt-2 h-12"
                  placeholder="Boateng"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="pw" className="text-sm font-bold">Create a password</Label>
              <Input
                id="pw"
                type="password"
                className="mt-2 h-12"
                placeholder="At least 8 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <p className="mt-1 text-xs text-muted-foreground">Use letters, numbers and one symbol.</p>
            </div>

            {error && <p className="text-xs font-semibold text-destructive">{error}</p>}

            <label className="flex items-start gap-3 rounded-md border border-border p-3 text-sm">
              <Checkbox id="opt" className="mt-0.5" defaultChecked />
              <span className="text-muted-foreground">
                Send me alkemart Ghana deals, promotions and news by SMS and email. You can unsubscribe any time.
              </span>
            </label>

            <div className="text-xs text-muted-foreground">
              By tapping Create account, you agree to alkemart Ghana's{" "}
              <span className="cursor-default font-semibold text-foreground underline">Terms of Use</span> and{" "}
              <span className="cursor-default font-semibold text-foreground underline">Privacy Notice</span>.
            </div>

            <Button size="lg" className="w-full" onClick={handleCreate} disabled={signup.isPending}>
              {signup.isPending ? "Creating..." : "Create account"}
            </Button>
          </div>
        </div>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-2 px-4 py-4 text-xs text-muted-foreground">
          <div>© 2026 alkemart Ghana Ltd. All Rights Reserved.</div>
          <div className="flex gap-4">
            <span className="cursor-default">Terms of Use</span>
            <span className="cursor-default">Privacy Notice</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
