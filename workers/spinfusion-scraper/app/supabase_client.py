"""Thin Supabase service-role wrapper for the Spinfusion scraper.

We intentionally do not use the supabase-py auth client — these are
service-role writes, RLS is bypassed, and the only operations we need are
insert + upsert + update.
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Iterable, Optional

from supabase import Client, create_client


def _client() -> Client:
    url = os.environ["SUPABASE_URL"]
    key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    return create_client(url, key)


@dataclass
class AssignmentRow:
    user_id: str
    date: str  # YYYY-MM-DD
    provider_name: str
    role: str
    site: str
    assignment_text: str
    notes: Optional[str] = None
    source_html_ref: Optional[str] = None


def upsert_assignments(rows: Iterable[AssignmentRow]) -> int:
    """Upsert assignments. Returns number of rows sent (not necessarily inserted
    — duplicates on the unique constraint are no-ops).
    """
    payload = [
        {
            "user_id": r.user_id,
            "date": r.date,
            "provider_name": r.provider_name,
            "role": r.role,
            "site": r.site,
            "assignment_text": r.assignment_text,
            "notes": r.notes,
            "source_html_ref": r.source_html_ref,
            "pulled_at": datetime.now(timezone.utc).isoformat(),
        }
        for r in rows
    ]
    if not payload:
        return 0
    client = _client()
    (
        client.table("spinfusion_assignments")
        .upsert(
            payload,
            on_conflict="user_id,date,provider_name,site,assignment_text",
        )
        .execute()
    )
    return len(payload)


def start_run(user_id: str) -> str:
    """Insert a spinfusion_runs row, return its id."""
    client = _client()
    res = (
        client.table("spinfusion_runs")
        .insert({"user_id": user_id, "status": "running"})
        .execute()
    )
    return res.data[0]["id"]


def finish_run(
    run_id: str,
    status: str,  # "success" | "partial" | "failed"
    rows_written: int,
    error: Optional[str] = None,
) -> None:
    client = _client()
    (
        client.table("spinfusion_runs")
        .update(
            {
                "status": status,
                "rows_written": rows_written,
                "finished_at": datetime.now(timezone.utc).isoformat(),
                "error": error,
            }
        )
        .eq("id", run_id)
        .execute()
    )


def delete_assignments_in_window(
    user_id: str, from_date: str, to_date: str
) -> None:
    """Optional helper — clear a date window before reinsert. The scraper does
    NOT use this by default (upsert is idempotent), but if Spinfusion removes
    a previously-published assignment we want it gone from the cache too.
    """
    client = _client()
    (
        client.table("spinfusion_assignments")
        .delete()
        .eq("user_id", user_id)
        .gte("date", from_date)
        .lte("date", to_date)
        .execute()
    )
