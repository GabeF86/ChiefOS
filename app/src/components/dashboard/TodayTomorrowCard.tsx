import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

/**
 * Phase-3 placeholder for the Spinfusion-fed assignment card. Shows real
 * today / tomorrow date headers and a "pending" treatment so the card has
 * shape on the dashboard before the scraper exists.
 */
export function TodayTomorrowCard() {
  const today = new Date();
  const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
  const fmt = (d: Date) =>
    d.toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
    });

  return (
    <Card className="bg-cream-2/40 border-dashed">
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="text-ink-2">Today + Tomorrow</CardTitle>
        <span className="text-[10px] font-mono uppercase tracking-widest text-ink-3 px-2 py-0.5 rounded-pill border border-border">
          Phase 3
        </span>
      </CardHeader>
      <CardContent>
        <ul className="space-y-3 text-sm">
          <DayRow label={`Today · ${fmt(today)}`} />
          <DayRow label={`Tomorrow · ${fmt(tomorrow)}`} />
        </ul>
        <p className="text-xs text-ink-3 mt-4 leading-relaxed">
          MD &amp; CRNA assignments will land here once the Spinfusion nightly
          pull goes live.
        </p>
      </CardContent>
    </Card>
  );
}

function DayRow({ label }: { label: string }) {
  return (
    <li className="flex items-center gap-3">
      <span className="font-mono text-[11px] uppercase tracking-widest text-ink-3 shrink-0 w-32 truncate">
        {label}
      </span>
      <span className="h-2 w-full bg-cream-2 rounded-pill" />
    </li>
  );
}
