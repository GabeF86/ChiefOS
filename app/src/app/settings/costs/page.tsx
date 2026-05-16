import Link from "next/link";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getThresholds } from "@/lib/domain/costs/server";

import { ThresholdsForm } from "./ThresholdsForm";

export const metadata = {
  title: "Cost alerts · ChiefOS",
};

export const dynamic = "force-dynamic";

export default async function CostSettingsPage() {
  const thresholds = await getThresholds();

  return (
    <main className="min-h-dvh px-6 py-10 max-w-xl mx-auto">
      <header className="mb-8">
        <Link
          href="/costs"
          className="font-mono text-xs tracking-widest uppercase text-ink-3 hover:text-ink"
        >
          ← Costs
        </Link>
        <h1 className="font-serif text-3xl text-ink mt-2">Cost alerts</h1>
        <p className="text-ink-2 mt-1">
          The home card turns yellow at 50% of the soft monthly cap and red
          over 100%.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Thresholds</CardTitle>
          <CardDescription>
            PRD defaults: $40 / month soft, $5 / day hard.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ThresholdsForm initial={thresholds} />
        </CardContent>
      </Card>

      <p className="text-xs text-ink-3 font-mono mt-6">
        Hard daily cap email alerts go live once ChiefOS is deployed to
        Vercel with a Resend API key.
      </p>
    </main>
  );
}
