"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

interface ExistingFactor {
  id: string;
  friendlyName: string | null;
  status: "unverified" | "verified";
  createdAt: string;
}

type EnrollState =
  | { kind: "idle" }
  | { kind: "enrolling"; factorId: string; qr: string; secret: string }
  | { kind: "verifying"; factorId: string; qr: string; secret: string };

export function TotpEnrollment({
  existingFactors,
}: {
  existingFactors: ExistingFactor[];
}) {
  const router = useRouter();
  const [state, setState] = useState<EnrollState>({ kind: "idle" });
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [pending, startTransition] = useTransition();

  const verified = existingFactors.filter((f) => f.status === "verified");

  function startEnroll() {
    setError(undefined);
    startTransition(async () => {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: "totp",
      });
      if (error) {
        setError(error.message);
        return;
      }
      setState({
        kind: "enrolling",
        factorId: data.id,
        qr: data.totp.qr_code,
        secret: data.totp.secret,
      });
    });
  }

  function verifyEnroll(e: React.FormEvent) {
    e.preventDefault();
    if (state.kind === "idle") return;
    setError(undefined);
    startTransition(async () => {
      const supabase = createSupabaseBrowserClient();
      const challenge = await supabase.auth.mfa.challenge({
        factorId: state.factorId,
      });
      if (challenge.error) {
        setError(challenge.error.message);
        return;
      }
      const verify = await supabase.auth.mfa.verify({
        factorId: state.factorId,
        challengeId: challenge.data.id,
        code,
      });
      if (verify.error) {
        setError(verify.error.message);
        return;
      }
      setState({ kind: "idle" });
      setCode("");
      router.refresh();
    });
  }

  function cancel() {
    if (state.kind === "idle") return;
    startTransition(async () => {
      const supabase = createSupabaseBrowserClient();
      await supabase.auth.mfa.unenroll({ factorId: state.factorId });
      setState({ kind: "idle" });
      setCode("");
      router.refresh();
    });
  }

  function unenroll(factorId: string) {
    if (!confirm("Remove this authenticator? You'll lose 2FA.")) return;
    startTransition(async () => {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.mfa.unenroll({ factorId });
      if (error) {
        setError(error.message);
        return;
      }
      router.refresh();
    });
  }

  if (state.kind !== "idle") {
    return (
      <div className="space-y-5">
        <div className="space-y-3">
          <p className="text-sm text-ink-2">
            Scan this QR code in your authenticator app, then enter the
            6-digit code it generates.
          </p>
          <div className="flex items-center justify-center bg-white rounded-input border border-border p-4">
            {/* Supabase returns an SVG data URL — render via next/image with unoptimized */}
            <Image
              src={state.qr}
              alt="TOTP QR code"
              width={192}
              height={192}
              unoptimized
              className="h-48 w-48"
            />
          </div>
          <details className="text-xs text-ink-3">
            <summary className="cursor-pointer hover:text-ink">
              Can&apos;t scan? Show secret
            </summary>
            <p className="mt-2 font-mono break-all bg-cream-2 rounded-input p-2">
              {state.secret}
            </p>
          </details>
        </div>

        <form onSubmit={verifyEnroll} className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="verify-code">6-digit code</Label>
            <Input
              id="verify-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]*"
              maxLength={6}
              required
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            />
          </div>
          {error && (
            <p className="text-sm text-red" role="alert">
              {error}
            </p>
          )}
          <div className="flex gap-2">
            <Button type="submit" disabled={pending}>
              {pending ? "Verifying…" : "Verify and enable"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={cancel}
              disabled={pending}
            >
              Cancel
            </Button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {verified.length === 0 ? (
        <>
          <p className="text-sm text-ink-2">
            Not enrolled. Recommended; takes two minutes.
          </p>
          {error && (
            <p className="text-sm text-red" role="alert">
              {error}
            </p>
          )}
          <Button onClick={startEnroll} disabled={pending}>
            {pending ? "Starting…" : "Enable two-factor"}
          </Button>
        </>
      ) : (
        <div className="space-y-3">
          {verified.map((f) => (
            <div
              key={f.id}
              className="flex items-center justify-between rounded-input border border-border bg-cream-2 px-4 py-3"
            >
              <div>
                <p className="text-sm text-ink font-medium">
                  {f.friendlyName ?? "Authenticator"}
                </p>
                <p className="text-xs text-ink-3 font-mono">
                  Enrolled {new Date(f.createdAt).toLocaleDateString()}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => unenroll(f.id)}
                disabled={pending}
              >
                Remove
              </Button>
            </div>
          ))}
          {error && (
            <p className="text-sm text-red" role="alert">
              {error}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
