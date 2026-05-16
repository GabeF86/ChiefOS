import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import { TotpEnrollment } from "./TotpEnrollment";

export const metadata = {
  title: "Security · ChiefOS",
};

export default async function SecurityPage() {
  const supabase = createSupabaseServerClient();
  const { data: factorsData } = await supabase.auth.mfa.listFactors();

  const totp = factorsData?.totp ?? [];

  return (
    <main className="min-h-dvh px-6 py-10 max-w-2xl mx-auto">
      <header className="mb-10">
        <Link
          href="/dashboard"
          className="font-mono text-xs tracking-widest uppercase text-ink-3 hover:text-ink"
        >
          ← Dashboard
        </Link>
        <h1 className="font-serif text-3xl text-ink mt-2">Security</h1>
        <p className="text-ink-2 mt-1">
          Two-factor authentication adds a second step at sign-in.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Authenticator app (TOTP)</CardTitle>
          <CardDescription>
            Use Google Authenticator, 1Password, Authy, or any RFC-6238 app.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TotpEnrollment
            existingFactors={totp.map((f) => ({
              id: f.id,
              friendlyName: f.friendly_name ?? null,
              status: f.status,
              createdAt: f.created_at,
            }))}
          />
        </CardContent>
      </Card>

      <p className="text-xs text-ink-3 mt-8">
        After enrolling, you&apos;ll be prompted for a 6-digit code at every
        sign-in. Recovery is by support contact only — keep your authenticator
        backup codes safe.
      </p>

      <div className="mt-10">
        <Button variant="ghost" asChild>
          <Link href="/dashboard">Back to dashboard</Link>
        </Button>
      </div>
    </main>
  );
}
