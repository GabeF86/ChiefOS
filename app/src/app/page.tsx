import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="min-h-dvh flex items-center justify-center px-6">
      <div className="max-w-md text-center space-y-6">
        <p className="font-mono text-xs tracking-widest uppercase text-ink-3">
          ChiefOS · v0.1
        </p>
        <h1 className="font-serif text-4xl text-ink">
          Personal command center
        </h1>
        <p className="text-ink-2 text-balance">
          Departmental signals, queryable.
        </p>
        <div className="flex gap-3 justify-center pt-2">
          <Button asChild>
            <Link href="/signin">Sign in</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
