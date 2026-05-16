import { Suspense } from "react";
import Link from "next/link";

import { QuickCaptureCard } from "@/components/dashboard/QuickCaptureCard";
import { TodosCard } from "@/components/dashboard/TodosCard";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata = {
  title: "Dashboard · ChiefOS",
};

export const dynamic = "force-dynamic";

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
            {greeting()}, Chief
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
        <Suspense fallback={<CardSkeleton title="Today + Tomorrow" />}>
          <Card>
            <CardHeader>
              <CardTitle>Today + Tomorrow</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-ink-3">
              Spinfusion pull lands here — Phase 3.
            </CardContent>
          </Card>
        </Suspense>

        <Suspense fallback={<CardSkeleton title="Todos" />}>
          <TodosCard />
        </Suspense>

        <Card>
          <CardHeader>
            <CardTitle>Upcoming Meetings</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-ink-3">
            CRUD lands next batch.
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Inbox Summary</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-ink-3">
            Gmail intake — Phase 4.
          </CardContent>
        </Card>

        <QuickCaptureCard />

        <Card>
          <CardHeader>
            <CardTitle>Cost Tracker</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-ink-3">
            Wired but empty until first AI call — ticket 16.
          </CardContent>
        </Card>
      </section>

      <p className="text-xs text-ink-3 mt-12 font-mono">
        Signed in as {user?.email}
      </p>
    </main>
  );
}

function CardSkeleton({ title }: { title: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 animate-pulse">
          <div className="h-3 w-3/4 bg-cream-2 rounded-pill" />
          <div className="h-3 w-1/2 bg-cream-2 rounded-pill" />
        </div>
      </CardContent>
    </Card>
  );
}

function greeting() {
  const hr = new Date().getHours();
  if (hr < 12) return "Good morning";
  if (hr < 17) return "Good afternoon";
  return "Good evening";
}
