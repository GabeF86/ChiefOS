import { createHmac, timingSafeEqual } from "node:crypto";

import { NextResponse, type NextRequest } from "next/server";

import {
  deleteFile,
  ingestFile,
  type IngestResult,
} from "@/lib/rag/ingest";
import {
  aggregateChanges,
  fetchFileAtRef,
  type PushEvent,
} from "@/lib/vault/github";

export const runtime = "nodejs";
export const maxDuration = 60;

const MD_FILTER = (path: string) => path.toLowerCase().endsWith(".md");

export async function POST(request: NextRequest) {
  const secret = process.env.GITHUB_WEBHOOK_SECRET;
  const token = process.env.GITHUB_TOKEN;
  const repoExpected = process.env.GITHUB_VAULT_REPO;
  const userId = process.env.CHIEFOS_VAULT_USER_ID;

  if (!secret || !token || !repoExpected || !userId) {
    return NextResponse.json(
      {
        error:
          "Vault webhook not configured. Set GITHUB_WEBHOOK_SECRET, GITHUB_TOKEN, GITHUB_VAULT_REPO, CHIEFOS_VAULT_USER_ID.",
      },
      { status: 503 },
    );
  }

  const event = request.headers.get("x-github-event");
  const sigHeader = request.headers.get("x-hub-signature-256") ?? "";
  const body = await request.text();

  if (!verifySignature(body, sigHeader, secret)) {
    return NextResponse.json({ error: "bad signature" }, { status: 401 });
  }

  if (event === "ping") {
    return NextResponse.json({ ok: true, pong: true });
  }
  if (event !== "push") {
    return NextResponse.json({ ok: true, ignored: event });
  }

  const payload: PushEvent = JSON.parse(body);
  const repoFullName = payload.repository?.full_name;
  if (repoFullName && repoFullName !== repoExpected) {
    return NextResponse.json(
      { error: `unexpected repo: ${repoFullName}` },
      { status: 400 },
    );
  }

  const headRef = payload.after;
  const changes = aggregateChanges(payload.commits, MD_FILTER);

  const results: IngestResult[] = [];
  const errors: Array<{ path: string; error: string }> = [];

  for (const path of changes.upserted) {
    try {
      const content = await fetchFileAtRef({
        repo: repoExpected,
        path,
        ref: headRef,
        token,
      });
      if (content === null) {
        // Couldn't find at head — treat as deletion to stay consistent.
        const r = await deleteFile({ userId, path });
        results.push(r);
        continue;
      }
      const r = await ingestFile({ userId, path, content });
      results.push(r);
    } catch (err) {
      errors.push({
        path,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  for (const path of changes.removed) {
    try {
      const r = await deleteFile({ userId, path });
      results.push(r);
    } catch (err) {
      errors.push({
        path,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return NextResponse.json({
    ok: true,
    head: headRef,
    results,
    errors,
  });
}

function verifySignature(body: string, header: string, secret: string): boolean {
  if (!header.startsWith("sha256=")) return false;
  const expected = createHmac("sha256", secret).update(body).digest();
  const got = Buffer.from(header.slice("sha256=".length), "hex");
  if (got.length !== expected.length) return false;
  try {
    return timingSafeEqual(got, expected);
  } catch {
    return false;
  }
}
