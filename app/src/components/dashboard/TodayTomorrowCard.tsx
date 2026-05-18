import Link from "next/link";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  getSpinfusionView,
  type DayAssignments,
} from "@/lib/domain/spinfusion/server";
import { cn } from "@/lib/utils";

/**
 * Today + Tomorrow assignments. Reads from the Spinfusion cache populated by
 * the Railway scraper. If no rows exist yet, renders an instructional empty
 * state with skeleton bars so the card has shape on a fresh install.
 */
export async function TodayTomorrowCard() {
  let view: Awaited<ReturnType<typeof getSpinfusionView>> | null = null;
  let queryError: string | null = null;
  try {
    view = await getSpinfusionView(2);
  } catch (err) {
    queryError = err instanceof Error ? err.message : "query failed";
  }

  const hasRun = view?.lastRunStatus && view.lastRunStatus !== "never";
  const hasData = (view?.days ?? []).some(
    (d) => d.mds.length + d.crnas.length + d.other.length > 0,
  );

  return (
    <Card className={cn(!hasData && "bg-cream-2/40 border-dashed")}>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className={cn(!hasData && "text-ink-2")}>
          Today + Tomorrow
        </CardTitle>
        <RunBadge view={view} queryError={queryError} />
      </CardHeader>
      <CardContent>
        {!view || queryError ? (
          <Placeholder
            reason={queryError ?? "Couldn't load assignments."}
          />
        ) : hasData ? (
          <div className="space-y-4">
            {view.days.map((d) => (
              <DayBlock key={d.date} day={d} />
            ))}
          </div>
        ) : (
          <Placeholder reason={hasRun
            ? "Scraper ran but returned no rows."
            : "Scraper hasn't run yet — set it up on Railway and trigger the daily cron."}
          />
        )}
        {view?.lastPulledAt && (
          <p className="text-[10px] font-mono uppercase tracking-widest text-ink-3 mt-4">
            Last refreshed {formatRelative(view.lastPulledAt)}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function DayBlock({ day }: { day: DayAssignments }) {
  const label = formatDayLabel(day.date);
  return (
    <div>
      <p className="font-mono text-[11px] uppercase tracking-widest text-ink-3 mb-2">
        {label}
      </p>
      <div className="grid grid-cols-2 gap-x-3 gap-y-1">
        <RoleColumn title="MDs" rows={day.mds} />
        <RoleColumn title="CRNAs" rows={day.crnas} />
      </div>
      {day.other.length > 0 && (
        <ul className="mt-2 text-xs text-ink-3 space-y-0.5">
          {day.other.map((r) => (
            <li key={r.id}>
              <span className="text-ink-2">{r.provider_name}</span> · {r.role} ·{" "}
              {r.assignment_text}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function RoleColumn({
  title,
  rows,
}: {
  title: string;
  rows: Array<{
    id: string;
    provider_name: string;
    assignment_text: string;
  }>;
}) {
  return (
    <div>
      <p className="text-[10px] font-mono uppercase tracking-widest text-ink-3 mb-1">
        {title}
      </p>
      {rows.length === 0 ? (
        <p className="text-xs text-ink-3">—</p>
      ) : (
        <ul className="space-y-0.5">
          {rows.map((r) => (
            <li
              key={r.id}
              className="text-xs text-ink truncate"
              title={`${r.provider_name} — ${r.assignment_text}`}
            >
              <span className="text-ink">{r.provider_name}</span>
              <span className="text-ink-3"> · {r.assignment_text}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Placeholder({ reason }: { reason: string }) {
  const today = new Date();
  const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
  return (
    <div>
      <ul className="space-y-3 text-sm">
        <SkeletonRow label={`Today · ${formatDayLabel(toYmd(today))}`} />
        <SkeletonRow label={`Tomorrow · ${formatDayLabel(toYmd(tomorrow))}`} />
      </ul>
      <p className="text-xs text-ink-3 mt-4 leading-relaxed">
        {reason}{" "}
        <Link
          href="https://github.com/GabeF86/ChiefOS/tree/main/workers/spinfusion-scraper"
          className="text-teal hover:underline"
        >
          Scraper README →
        </Link>
      </p>
    </div>
  );
}

function SkeletonRow({ label }: { label: string }) {
  return (
    <li className="flex items-center gap-3">
      <span className="font-mono text-[11px] uppercase tracking-widest text-ink-3 shrink-0 w-32 truncate">
        {label}
      </span>
      <span className="h-2 w-full bg-cream-2 rounded-pill" />
    </li>
  );
}

function RunBadge({
  view,
  queryError,
}: {
  view: Awaited<ReturnType<typeof getSpinfusionView>> | null;
  queryError: string | null;
}) {
  if (queryError) {
    return (
      <span className="text-[10px] font-mono uppercase tracking-widest text-red px-2 py-0.5 rounded-pill border border-red/40">
        Error
      </span>
    );
  }
  const status = view?.lastRunStatus ?? "never";
  if (status === "never") {
    return (
      <span className="text-[10px] font-mono uppercase tracking-widest text-ink-3 px-2 py-0.5 rounded-pill border border-border">
        Pending
      </span>
    );
  }
  const tone = {
    success: "text-emerald border-emerald/40",
    partial: "text-[var(--gold)] border-[var(--gold)]/40",
    failed: "text-red border-red/40",
    running: "text-ink-3 border-border",
  }[status];
  return (
    <span
      className={cn(
        "text-[10px] font-mono uppercase tracking-widest px-2 py-0.5 rounded-pill border",
        tone,
      )}
      title={view?.lastRunError ?? undefined}
    >
      {status}
    </span>
  );
}

function toYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatDayLabel(ymd: string): string {
  const [y, m, d] = ymd.split("-").map((s) => parseInt(s, 10));
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diffMin = Math.round((now - then) / 60_000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin} min ago`;
  const diffH = Math.round(diffMin / 60);
  if (diffH < 24) return `${diffH} hr ago`;
  const diffD = Math.round(diffH / 24);
  return `${diffD} d ago`;
}
