import Link from "next/link";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { listIndexedFiles } from "@/lib/rag/ingest";

import { ChatClient } from "./ChatClient";

export const metadata = {
  title: "Ask the vault · ChiefOS",
};

export const dynamic = "force-dynamic";

interface SearchParams {
  q?: string;
}

export default async function ChatPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const indexed = user ? await listIndexedFiles(user.id) : [];
  const initialQuestion = (searchParams.q ?? "").slice(0, 1000);

  const vaultName = process.env.NEXT_PUBLIC_OBSIDIAN_VAULT_NAME ?? "";

  return (
    <main className="min-h-dvh px-5 py-8 md:px-8 md:py-10 max-w-3xl mx-auto flex flex-col gap-6">
      <header className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <Link
            href="/dashboard"
            className="font-mono text-xs tracking-widest uppercase text-ink-3 hover:text-ink"
          >
            ← Dashboard
          </Link>
          <h1 className="font-serif text-3xl text-ink mt-2">Ask the vault</h1>
          <p className="text-ink-2 mt-1 text-balance">
            Questions answered from your Obsidian notes only.{" "}
            <span className="text-ink-3">
              {indexed.length} file{indexed.length === 1 ? "" : "s"} indexed.
            </span>
          </p>
        </div>
      </header>

      <ChatClient
        initialQuestion={initialQuestion}
        vaultName={vaultName}
      />

      <footer className="text-[11px] font-mono text-ink-3 text-center">
        Answers are drafts, not policy. Verify against the source note.
      </footer>
    </main>
  );
}
