import { Suspense, type ReactNode } from "react";
import Link from "next/link";

import { CaseRequestsCard } from "@/components/dashboard/CaseRequestsCard";
import { CostTrackerCard } from "@/components/dashboard/CostTrackerCard";
import { DashboardGrid } from "@/components/dashboard/DashboardGrid";
import { MeetingsCard } from "@/components/dashboard/MeetingsCard";
import { QuickAskCard } from "@/components/dashboard/QuickAskCard";
import { QuickCaptureCard } from "@/components/dashboard/QuickCaptureCard";
import { TodayTomorrowCard } from "@/components/dashboard/TodayTomorrowCard";
import { TodosCard } from "@/components/dashboard/TodosCard";
import { WeatherBadge } from "@/components/dashboard/WeatherBadge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  getDashboardLayout,
  setCardOrder,
  setCollapsed,
} from "@/lib/domain/layout/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata = {
  title: "Dashboard · ChiefOS",
};

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = createSupabaseServerClient();
  const [
    {
      data: { user },
    },
    layout,
  ] = await Promise.all([supabase.auth.getUser(), getDashboardLayout()]);

  const now = new Date();
  const dateLong = now.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  const cards: Record<string, ReactNode> = {
    spinfusion: <TodayTomorrowCard />,
    case_requests: (
      <Suspense fallback={<CardSkeleton title="Case requests" />}>
        <CaseRequestsCard />
      </Suspense>
    ),
    todos: (
      <Suspense fallback={<CardSkeleton title="Todos" />}>
        <TodosCard />
      </Suspense>
    ),
    meetings: (
      <Suspense fallback={<CardSkeleton title="Upcoming Meetings" />}>
        <MeetingsCard />
      </Suspense>
    ),
    inbox: (
      <ComingSoonCard
        title="Inbox Summary"
        phase="Phase 4"
        description="Forwarded emails to farkas@paolianesthesia.com appear here once intake is wired up."
      />
    ),
    quick_capture: <QuickCaptureCard />,
    quick_ask: <QuickAskCard />,
    cost_tracker: (
      <Suspense fallback={<CardSkeleton title="Cost Tracker" />}>
        <CostTrackerCard />
      </Suspense>
    ),
  };

  return (
    <main className="min-h-dvh px-5 py-8 md:px-8 md:py-10 max-w-6xl mx-auto">
      <header className="flex items-start justify-between gap-4 mb-8 md:mb-10">
        <div className="min-w-0">
          <p className="font-mono text-[11px] tracking-widest uppercase text-ink-3">
            ChiefOS · {dateLong}
          </p>
          <h1 className="font-serif text-3xl md:text-4xl text-ink mt-1 leading-tight">
            {greeting()}, Chief
          </h1>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Suspense fallback={null}>
            <WeatherBadge />
          </Suspense>
          <div className="hidden md:flex items-center gap-2">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/chat">Ask</Link>
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/meetings">Meetings</Link>
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/todos">Todos</Link>
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/costs">Costs</Link>
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/settings/security">Security</Link>
            </Button>
            <form action="/auth/signout" method="post">
              <Button type="submit" variant="outline" size="sm">
                Sign out
              </Button>
            </form>
          </div>
        </div>
      </header>

      <DashboardGrid
        initialOrder={layout.cardOrder}
        initialCollapsed={Array.from(layout.collapsed)}
        cards={cards}
        saveOrder={setCardOrder}
        saveCollapsed={setCollapsed}
      />

      <footer className="mt-10 flex items-center justify-between text-[11px] font-mono text-ink-3">
        <span className="truncate">
          Signed in as <span className="text-ink-2">{user?.email}</span>
        </span>
        <Link
          href="/settings/security"
          className="hover:text-ink uppercase tracking-widest hidden md:inline"
        >
          Security
        </Link>
      </footer>
    </main>
  );
}

function ComingSoonCard({
  title,
  phase,
  description,
}: {
  title: string;
  phase: string;
  description: string;
}) {
  return (
    <Card className="bg-cream-2/40 border-dashed h-full">
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="text-ink-2">{title}</CardTitle>
        <span className="text-[10px] font-mono uppercase tracking-widest text-ink-3 px-2 py-0.5 rounded-pill border border-border">
          {phase}
        </span>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-ink-3 text-balance leading-relaxed">
          {description}
        </p>
      </CardContent>
    </Card>
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
