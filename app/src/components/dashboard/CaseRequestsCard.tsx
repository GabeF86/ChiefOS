import Link from "next/link";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { listUpcomingCaseRequests } from "@/lib/domain/case-requests/server";
import type { CaseRequestRow } from "@/lib/schemas/case-request";
import { cn } from "@/lib/utils";

export async function CaseRequestsCard() {
  const all = await listUpcomingCaseRequests(30);
  const pending = all.filter((r) => r.status === "pending");
  const visible = pending.slice(0, 6);

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle>
          Case requests{" "}
          {pending.length > 0 && (
            <span className="ml-1 text-ink-3 font-normal text-base">
              · {pending.length}
            </span>
          )}
        </CardTitle>
        <Link
          href="/case-requests"
          className="text-xs font-mono text-ink-3 hover:text-ink uppercase tracking-widest"
        >
          Manage →
        </Link>
      </CardHeader>
      <CardContent>
        {visible.length === 0 ? (
          <p className="text-sm text-ink-3">
            No pending requests.{" "}
            <Link href="/case-requests" className="text-teal hover:underline">
              Add one
            </Link>
            .
          </p>
        ) : (
          <ul className="space-y-2.5">
            {visible.map((r) => (
              <Row key={r.id} row={r} />
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function Row({ row }: { row: CaseRequestRow }) {
  return (
    <li className="flex items-start gap-3">
      <span className="font-mono text-xs text-ink-3 tabular-nums shrink-0 w-20">
        {formatDate(row.case_date)}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm text-ink">{row.surgeon_name}</p>
        <p className="text-xs text-ink-3 mt-0.5">
          <RoleSummary row={row} />
          {row.source === "email" && (
            <span className="ml-2 font-mono uppercase tracking-widest text-[10px] text-ink-3/80">
              · via email
            </span>
          )}
        </p>
      </div>
    </li>
  );
}

function RoleSummary({ row }: { row: CaseRequestRow }) {
  const parts: string[] = [];
  if (row.needs_md) {
    parts.push(row.md_name ? `MD: ${row.md_name}` : "MD");
  }
  if (row.needs_crna) {
    parts.push(row.crna_name ? `CRNA: ${row.crna_name}` : "CRNA");
  }
  return <span className={cn("text-ink-2")}>{parts.join(" · ")}</span>;
}

function formatDate(ymd: string): string {
  const [y, m, d] = ymd.split("-").map((s) => parseInt(s, 10));
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}
