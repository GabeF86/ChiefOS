import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  getCostSummary,
  getThresholds,
  listFixedCosts,
} from "@/lib/domain/costs/server";

import { DailyBarChart } from "./DailyBarChart";
import { FixedCostsEditor } from "./FixedCostsEditor";

export const metadata = {
  title: "Costs · ChiefOS",
};

export const dynamic = "force-dynamic";

const fmt = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
});

const fmt4 = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 4,
});

export default async function CostsPage() {
  const [summary, fixedCosts, thresholds] = await Promise.all([
    getCostSummary(),
    listFixedCosts(),
    getThresholds(),
  ]);

  return (
    <main className="min-h-dvh px-6 py-10 max-w-5xl mx-auto space-y-8">
      <header className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <Link
            href="/dashboard"
            className="font-mono text-xs tracking-widest uppercase text-ink-3 hover:text-ink"
          >
            ← Dashboard
          </Link>
          <h1 className="font-serif text-3xl text-ink mt-2">Costs</h1>
          <p className="text-ink-2 mt-1">
            Soft alert at {fmt.format(thresholds.softMonthlyUsd)} / month,
            hard alert at {fmt.format(thresholds.hardDailyUsd)} / day.
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/settings/costs">Edit thresholds</Link>
        </Button>
      </header>

      <section className="grid gap-4 md:grid-cols-4">
        <SummaryStat
          label="This month (variable)"
          value={fmt.format(summary.monthVariableUsd)}
        />
        <SummaryStat
          label="This month (fixed)"
          value={fmt.format(summary.monthFixedUsd)}
          sub={`of ${fmt.format(summary.monthFixedMonthlyUsd)}/mo`}
        />
        <SummaryStat
          label="Projected EoM"
          value={fmt.format(summary.monthProjectedUsd)}
        />
        <SummaryStat
          label="Last month"
          value={fmt.format(
            summary.lastMonthVariableUsd + summary.lastMonthFixedUsd,
          )}
          sub={`${fmt.format(summary.lastMonthVariableUsd)} var`}
        />
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Daily variable spend — last 30 days</CardTitle>
        </CardHeader>
        <CardContent>
          <DailyBarChart
            data={summary.dailySpend}
            hardDaily={thresholds.hardDailyUsd}
          />
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>By category (this month)</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              {summary.categoryBreakdown.map((c) => (
                <li key={c.category} className="flex justify-between">
                  <span className="text-ink capitalize">{c.category}</span>
                  <span className="font-mono tabular-nums text-ink-2">
                    {fmt.format(c.total_usd)}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top operations (this month)</CardTitle>
          </CardHeader>
          <CardContent>
            {summary.topOperations.length === 0 ? (
              <p className="text-sm text-ink-3">No AI calls yet.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {summary.topOperations.map((op) => (
                  <li
                    key={`${op.provider}-${op.model}-${op.operation}`}
                    className="flex items-baseline justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <p className="text-ink truncate">{op.model}</p>
                      <p className="text-xs text-ink-3 font-mono">
                        {op.operation} · {op.call_count}×
                      </p>
                    </div>
                    <span className="font-mono tabular-nums text-ink-2 shrink-0">
                      {fmt4.format(op.total_usd)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Fixed costs</CardTitle>
        </CardHeader>
        <CardContent>
          <FixedCostsEditor initial={fixedCosts} />
        </CardContent>
      </Card>
    </main>
  );
}

function SummaryStat({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <p className="font-mono text-[10px] uppercase tracking-widest text-ink-3">
          {label}
        </p>
        <p className="font-serif text-2xl text-ink tabular-nums mt-1">{value}</p>
        {sub && (
          <p className="text-xs text-ink-3 font-mono mt-1">{sub}</p>
        )}
      </CardContent>
    </Card>
  );
}
