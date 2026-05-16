/**
 * GitHub helpers for the vault webhook. We use the contents API with a raw
 * Accept header so the response is the file body itself, not a JSON wrapper.
 */

interface FetchArgs {
  repo: string; // "owner/repo"
  path: string;
  ref: string; // commit sha
  token: string;
}

export async function fetchFileAtRef({
  repo,
  path,
  ref,
  token,
}: FetchArgs): Promise<string | null> {
  const url = `https://api.github.com/repos/${repo}/contents/${encodeURI(
    path,
  )}?ref=${encodeURIComponent(ref)}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      "User-Agent": "ChiefOS-vault-ingest",
      Accept: "application/vnd.github.raw",
    },
    // GitHub responses move with commits; no point caching.
    cache: "no-store",
  });
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(
      `GitHub contents fetch failed for ${path}@${ref}: ${res.status}`,
    );
  }
  return await res.text();
}

export interface PushEvent {
  ref: string;
  after: string;
  before: string;
  repository?: { full_name?: string };
  commits?: Array<{
    id: string;
    added?: string[];
    modified?: string[];
    removed?: string[];
  }>;
}

export interface AggregatedChanges {
  upserted: string[]; // added ∪ modified, last-write-wins
  removed: string[]; // removed only if not later re-added
}

/**
 * Aggregate the per-commit add/modify/remove lists in a push into a single
 * set of changes against the head ref. Order matters: a file added in commit
 * A then deleted in commit B should appear in `removed`. A file deleted in
 * commit A then re-added in commit B should appear in `upserted`.
 */
export function aggregateChanges(
  commits: PushEvent["commits"],
  filter: (path: string) => boolean,
): AggregatedChanges {
  const upserted = new Set<string>();
  const removed = new Set<string>();
  for (const commit of commits ?? []) {
    for (const p of commit.added ?? []) {
      if (!filter(p)) continue;
      upserted.add(p);
      removed.delete(p);
    }
    for (const p of commit.modified ?? []) {
      if (!filter(p)) continue;
      upserted.add(p);
      removed.delete(p);
    }
    for (const p of commit.removed ?? []) {
      if (!filter(p)) continue;
      removed.add(p);
      upserted.delete(p);
    }
  }
  return {
    upserted: Array.from(upserted),
    removed: Array.from(removed),
  };
}
