"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export function SignUpForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [sent, setSent] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(undefined);

    if (password.length < 12) {
      setError("Password must be at least 12 characters.");
      return;
    }

    startTransition(async () => {
      const supabase = createSupabaseBrowserClient();
      const origin = window.location.origin;
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(
            "/dashboard",
          )}`,
        },
      });
      if (error) {
        setError(error.message);
        return;
      }
      // If Supabase is configured to require email confirm, session is null.
      if (data.session) {
        router.push("/dashboard");
        router.refresh();
      } else {
        setSent(true);
      }
    });
  }

  if (sent) {
    return (
      <div className="rounded-input border border-border bg-cream-2 p-4 text-sm text-ink-2">
        Check <span className="font-medium text-ink">{email}</span> to confirm
        your address, then sign in.
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={12}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <p className="text-xs text-ink-3">
          12+ characters. Breach-checked against haveibeenpwned (Supabase
          built-in).
        </p>
      </div>

      {error && (
        <p className="text-sm text-red" role="alert">
          {error}
        </p>
      )}

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Creating…" : "Create account"}
      </Button>
    </form>
  );
}
