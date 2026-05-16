"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type Mode = "password" | "magic-link";

interface SignInFormProps {
  next?: string;
  initialError?: string;
  magicLinkSent?: boolean;
}

export function SignInForm({
  next,
  initialError,
  magicLinkSent,
}: SignInFormProps) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | undefined>(initialError);
  const [sent, setSent] = useState(magicLinkSent ?? false);
  const [pending, startTransition] = useTransition();

  const redirectTo = next ?? "/dashboard";

  function handlePassword(e: React.FormEvent) {
    e.preventDefault();
    setError(undefined);
    startTransition(async () => {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) {
        setError(error.message);
        return;
      }
      // MFA challenge required?
      const factors = data?.user?.factors ?? [];
      const totp = factors.find((f) => f.factor_type === "totp" && f.status === "verified");
      if (totp) {
        const params = new URLSearchParams({ next: redirectTo, factor: totp.id });
        router.push(`/auth/mfa?${params.toString()}`);
        return;
      }
      router.push(redirectTo);
      router.refresh();
    });
  }

  function handleMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setError(undefined);
    startTransition(async () => {
      const supabase = createSupabaseBrowserClient();
      const origin = window.location.origin;
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(
            redirectTo,
          )}`,
        },
      });
      if (error) {
        setError(error.message);
        return;
      }
      setSent(true);
    });
  }

  if (sent) {
    return (
      <div className="rounded-input border border-border bg-cream-2 p-4 text-sm text-ink-2">
        Check <span className="font-medium text-ink">{email}</span> for a sign-in
        link. You can close this tab.
      </div>
    );
  }

  return (
    <form
      onSubmit={mode === "password" ? handlePassword : handleMagicLink}
      className="space-y-4"
    >
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
        />
      </div>

      {mode === "password" && (
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
      )}

      {error && (
        <p className="text-sm text-red" role="alert">
          {error}
        </p>
      )}

      <Button type="submit" className="w-full" disabled={pending}>
        {pending
          ? "Working…"
          : mode === "password"
            ? "Sign in"
            : "Email me a link"}
      </Button>

      <button
        type="button"
        onClick={() => {
          setMode((m) => (m === "password" ? "magic-link" : "password"));
          setError(undefined);
        }}
        className="block w-full text-center text-sm text-teal hover:underline"
      >
        {mode === "password"
          ? "Use a magic link instead"
          : "Use password instead"}
      </button>
    </form>
  );
}
