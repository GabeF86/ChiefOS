import Link from "next/link";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { listAllCaseRequests } from "@/lib/domain/case-requests/server";

import { CaseRequestFormDialog } from "./CaseRequestFormDialog";
import { CaseRequestRow } from "./CaseRequestRow";

export const metadata = {
  title: "Case requests · ChiefOS",
};

export const dynamic = "force-dynamic";

export default async function CaseRequestsPage() {
  const rows = await listAllCaseRequests();

  // Bucket by case_date relative to today.
  const todayYmd = ymd(new Date());
  const past = rows.filter((r) => r.case_date < todayYmd);
  const upcoming = rows.filter((r) => r.case_date >= todayYmd);

  return (
    <main className="min-h-dvh px-6 py-10 max-w-4xl mx-auto space-y-10">
      <header className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <Link
            href="/dashboard"
            className="font-mono text-xs tracking-widest uppercase text-ink-3 hover:text-ink"
          >
            ← Dashboard
          </Link>
          <h1 className="font-serif text-3xl text-ink mt-2">Case requests</h1>
          <p className="text-ink-2 mt-1 text-balance">
            Surgeon requests for MD / CRNA coverage on a specific date. Will
            auto-populate from emails sent to farkas@paolianesthesia.com with
            subject &ldquo;Request Case&rdquo; once the Gmail intake worker is
            wired.
          </p>
        </div>
        <CaseRequestFormDialog mode="create" />
      </header>

      <section>
        <h2 className="font-serif text-xl text-ink mb-3">Upcoming</h2>
        {upcoming.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-ink-3">
              No upcoming case requests. Add one above.
            </CardContent>
          </Card>
        ) : (
          <ul className="space-y-3">
            {upcoming.map((r) => (
              <CaseRequestRow key={r.id} row={r} />
            ))}
          </ul>
        )}
      </section>

      {past.length > 0 && (
        <section>
          <h2 className="font-serif text-xl text-ink mb-3">
            Past <span className="text-ink-3 font-normal">· {past.length}</span>
          </h2>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">History</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-1.5">
                {past.slice(0, 20).map((r) => (
                  <li
                    key={r.id}
                    className="flex items-baseline gap-3 text-sm text-ink-2"
                  >
                    <span className="font-mono text-xs text-ink-3 tabular-nums shrink-0 w-24">
                      {formatHistoryDate(r.case_date)}
                    </span>
                    <span className="truncate">{r.surgeon_name}</span>
                    <span className="font-mono text-[10px] uppercase tracking-widest text-ink-3 ml-auto shrink-0">
                      {r.status}
                    </span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </section>
      )}
    </main>
  );
}

function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatHistoryDate(ymd: string): string {
  const [y, m, d] = ymd.split("-").map((s) => parseInt(s, 10));
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
