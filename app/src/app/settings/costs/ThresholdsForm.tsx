"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateThresholds } from "@/lib/domain/costs/server";

export function ThresholdsForm({
  initial,
}: {
  initial: { softMonthlyUsd: number; hardDailyUsd: number };
}) {
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  return (
    <form
      action={(fd) =>
        startTransition(async () => {
          await updateThresholds(fd);
          setSaved(true);
          window.setTimeout(() => setSaved(false), 1500);
        })
      }
      className="space-y-4"
    >
      <div className="space-y-2">
        <Label htmlFor="soft_monthly_usd">Soft monthly cap (USD)</Label>
        <Input
          id="soft_monthly_usd"
          name="soft_monthly_usd"
          type="number"
          step="0.01"
          min="0"
          defaultValue={initial.softMonthlyUsd}
          required
        />
        <p className="text-xs text-ink-3">
          Home-card color changes when this month&apos;s variable spend
          crosses 50% and 100% of this number.
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="hard_daily_usd">Hard daily cap (USD)</Label>
        <Input
          id="hard_daily_usd"
          name="hard_daily_usd"
          type="number"
          step="0.01"
          min="0"
          defaultValue={initial.hardDailyUsd}
          required
        />
        <p className="text-xs text-ink-3">
          Shown on the daily-spend chart as a dotted line. Bars over this go red.
        </p>
      </div>
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </Button>
        {saved && (
          <span className="text-sm text-emerald font-mono">Saved</span>
        )}
      </div>
    </form>
  );
}
