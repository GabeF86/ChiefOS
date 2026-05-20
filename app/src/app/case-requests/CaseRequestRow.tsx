"use client";

import { useTransition } from "react";

import { Button } from "@/components/ui/button";
import {
  deleteCaseRequest,
  setCaseRequestStatus,
} from "@/lib/domain/case-requests/server";
import type {
  CaseRequestRow as CaseRequestRowT,
  CaseRequestStatus,
} from "@/lib/schemas/case-request";
import { cn } from "@/lib/utils";

import { CaseRequestFormDialog } from "./CaseRequestFormDialog";

const STATUS_TONE: Record<CaseRequestStatus, string> = {
  pending: "text-ink-3 border-border",
  confirmed: "text-emerald border-emerald/40",
  declined: "text-red border-red/40",
  cancelled: "text-ink-3 border-border line-through",
};

export function CaseRequestRow({ row }: { row: CaseRequestRowT }) {
  const [pending, startTransition] = useTransition();

  function updateStatus(next: CaseRequestStatus) {
    startTransition(() => {
      setCaseRequestStatus(row.id, next).catch(() => {});
    });
  }

  function remove() {
    if (!confirm("Delete this case request?")) return;
    startTransition(() => {
      deleteCaseRequest(row.id).catch(() => {});
    });
  }

  const team: Array<{ role: "MD" | "CRNA"; name: string | null }> = [];
  if (row.needs_md) team.push({ role: "MD", name: row.md_name });
  if (row.needs_crna) team.push({ role: "CRNA", name: row.crna_name });

  return (
    <li
      className={cn(
        "rounded-card border border-border bg-surface p-4 flex items-start gap-4",
        pending && "opacity-60",
      )}
    >
      <div className="font-mono text-xs text-ink-3 tabular-nums shrink-0 w-24">
        {formatDate(row.case_date)}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-3 flex-wrap">
          <p className="text-base text-ink">{row.surgeon_name}</p>
          <span className="text-sm text-ink-2 flex items-center gap-2">
            {team.map((t, i) => (
              <span key={t.role} className="flex items-baseline gap-1">
                {i > 0 && <span className="text-ink-3">·</span>}
                <span className="font-mono text-[10px] uppercase tracking-widest text-ink-3">
                  {t.role}
                </span>
                {t.name && <span className="text-ink-2">{t.name}</span>}
              </span>
            ))}
          </span>
          <span
            className={cn(
              "font-mono text-[10px] uppercase tracking-widest px-2 py-0.5 rounded-pill border",
              STATUS_TONE[row.status],
            )}
          >
            {row.status}
          </span>
          {row.source === "email" && (
            <span className="font-mono text-[10px] uppercase tracking-widest text-ink-3">
              via email
            </span>
          )}
        </div>
        {row.notes && (
          <p className="text-sm text-ink-2 mt-1 whitespace-pre-line">
            {row.notes}
          </p>
        )}
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {row.status === "pending" && (
          <>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => updateStatus("confirmed")}
              disabled={pending}
            >
              ✓ Confirm
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => updateStatus("declined")}
              disabled={pending}
            >
              ✕ Decline
            </Button>
          </>
        )}
        <CaseRequestFormDialog mode="edit" row={row} />
        <Button
          variant="ghost"
          size="sm"
          onClick={remove}
          disabled={pending}
          className="text-ink-3 hover:text-red"
        >
          Delete
        </Button>
      </div>
    </li>
  );
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
