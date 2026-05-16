import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata = {
  title: "Dashboard · ChiefOS",
};

export default async function DashboardPage() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main className="min-h-dvh px-6 py-10 max-w-5xl mx-auto">
      <header className="flex items-center justify-between mb-10">
        <div>
          <p className="font-mono text-xs tracking-widest uppercase text-ink-3">
            ChiefOS · Dashboard
          </p>
          <h1 className="font-serif text-3xl text-ink mt-1">
            Good morning, Chief
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="ghost" asChild>
            <Link href="/settings/security">Security</Link>
          </Button>
          <form action="/auth/signout" method="post">
            <Button type="submit" variant="outline" size="sm">
              Sign out
            </Button>
          </form>
        </div>
      </header>

      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Today + Tomorrow</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-ink-3">
            Spinfusion pull lands here — Phase 3.
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Todos</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-ink-3">
            CRUD coming in ticket 7+ of Phase 1.
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Quick Capture</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-ink-3">
            Voice + text capture — ticket 14–15.
          </CardContent>
        </Card>
      </section>

      <p className="text-xs text-ink-3 mt-12 font-mono">
        Signed in as {user?.email}
      </p>
    </main>
  );
}
