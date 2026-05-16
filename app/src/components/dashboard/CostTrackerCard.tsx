import Link from "next/link";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getCostSummary } from "@/lib/domain/costs/server";
import { cn } from "@/lib/utils";

const fmt = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
});

export async function CostTrackerCard() {
  const summary = await getCostSummary();

  const monthSoFar = summary.monthVariableUsd + summary.monthFixedUsd;
  const projected = summary.monthProjectedUsd;
  const lastMonth = summary.lastMonthVariableUsd + summary.lastMonthFixedUsd;

  const cap = summary.monthCapUsd;
  const utilization = cap > 0 ? summary.monthVariableUsd / cap : 0;
  const tone =
    utilization >= 1
      ? "red"
      : utilization >= 0.5
        ? "yellow"
        : "green";

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle>Cost Tracker</CardTitle>
        <Link
          href="/costs"
          className="text-xs font-mono text-ink-3 hover:text-ink uppercase tracking-widest"
        >
          Detail →
        </Link>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-baseline gap-2">
          <span className="font-serif text-3xl text-ink tabular-nums">
            {fmt.format(monthSoFar)}
          </span>
          <span className="font-mono text-xs uppercase tracking-widest text-ink-3">
            this month
          </span>
        </div>
        <ThresholdBar utilization={utilization} tone={tone} cap={cap} />
        <dl className="grid grid-cols-2 gap-y-1 text-xs text-ink-3 font-mono">
          <dt>Projected EoM</dt>
          <dd className="text-right text-ink tabular-nums">
            {fmt.format(projected)}
          </dd>
          <dt>Last month</dt>
          <dd className="text-right text-ink-2 tabular-nums">
            {fmt.format(lastMonth)}
          </dd>
        </dl>
      </CardContent>
    </Card>
  );
}

function ThresholdBar({
  utilization,
  tone,
  cap,
}: {
  utilization: number;
  tone: "green" | "yellow" | "red";
  cap: number;
}) {
  const pct = Math.min(100, Math.round(utilization * 100));
  const barColor =
    tone === "green"
      ? "bg-[var(--emerald)]"
      : tone === "yellow"
        ? "bg-[var(--gold)]"
        : "bg-[var(--red)]";
  const label =
    tone === "green"
      ? `${pct}% of ${fmt.format(cap)} cap`
      : tone === "yellow"
        ? `${pct}% of cap`
        : `Over cap (${pct}%)`;
  return (
    <div>
      <div className="h-1.5 w-full rounded-pill bg-cream-2 overflow-hidden">
        <div
          className={cn("h-full rounded-pill transition-all", barColor)}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-[10px] font-mono uppercase tracking-widest text-ink-3 mt-1">
        {label}
      </p>
    </div>
  );
}
