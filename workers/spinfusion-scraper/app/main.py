"""Entrypoint — runs one scrape + write cycle.

Usage:
    python -m app.main             # full run
    python -m app.main --dry-run   # parse only; print rows; no DB write
"""

from __future__ import annotations

import argparse
import asyncio
import json
import os
import sys
import traceback
from dataclasses import asdict
from typing import Optional

import httpx
from dotenv import load_dotenv

from .scraper import ScraperError, config_from_env, scrape
from .supabase_client import (
    finish_run,
    start_run,
    upsert_assignments,
)


def _parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser()
    p.add_argument(
        "--dry-run",
        action="store_true",
        help="parse and print rows; do not write to Supabase",
    )
    return p.parse_args()


async def _run() -> int:
    args = _parse_args()
    load_dotenv()
    cfg = config_from_env()

    if args.dry_run:
        rows = await scrape(cfg)
        print(json.dumps([asdict(r) for r in rows], indent=2))
        return 0

    run_id = start_run(cfg.user_id)
    try:
        rows = await scrape(cfg)
        written = upsert_assignments(rows)
        finish_run(run_id, "success", written)
        print(f"[spinfusion] success: {written} rows for user {cfg.user_id}")
        return 0
    except ScraperError as e:
        finish_run(run_id, "failed", 0, str(e))
        _alert(f"Spinfusion scraper failed: {e}")
        print(f"[spinfusion] failed: {e}", file=sys.stderr)
        return 1
    except Exception as e:  # noqa: BLE001
        finish_run(run_id, "failed", 0, f"{type(e).__name__}: {e}")
        _alert(f"Spinfusion scraper crashed:\n{traceback.format_exc()}")
        print(f"[spinfusion] crashed: {e}", file=sys.stderr)
        return 2


def _alert(message: str) -> None:
    """Optional email alert via Resend. Silent no-op if not configured."""
    api_key = os.environ.get("RESEND_API_KEY")
    to_email = os.environ.get("ALERT_EMAIL_TO")
    from_email = os.environ.get(
        "ALERT_EMAIL_FROM", "alerts@agenticanesthesia.com"
    )
    if not api_key or not to_email:
        return
    try:
        httpx.post(
            "https://api.resend.com/emails",
            headers={"Authorization": f"Bearer {api_key}"},
            json={
                "from": from_email,
                "to": [to_email],
                "subject": "ChiefOS — Spinfusion scraper alert",
                "text": message,
            },
            timeout=10,
        )
    except Exception:  # noqa: BLE001 - best-effort
        pass


def main() -> None:
    rc = asyncio.run(_run())
    sys.exit(rc)


if __name__ == "__main__":
    main()
