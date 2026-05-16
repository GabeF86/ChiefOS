import Link from "next/link";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  listMeetings,
  listUpcomingOccurrences,
} from "@/lib/domain/meetings/server";
import { decodeCadence, humanCadence } from "@/lib/meetings/rrule";

import { MeetingFormDialog } from "./MeetingFormDialog";
import { MeetingRow } from "./MeetingRow";

export const metadata = {
  title: "Meetings · ChiefOS",
};

export const dynamic = "force-dynamic";

export default async function MeetingsPage() {
  const [meetings, upcoming] = await Promise.all([
    listMeetings(),
    listUpcomingOccurrences(14, 8),
  ]);

  return (
    <main className="min-h-dvh px-6 py-10 max-w-4xl mx-auto space-y-10">
      <header className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <Link
            href="/dashboard"
            className="font-mono text-xs tracking-widest uppercase text-ink-3 hover:text-ink"
          >
            ← Dashboard
          </Link>
          <h1 className="font-serif text-3xl text-ink mt-2">Recurring meetings</h1>
          <p className="text-ink-2 mt-1 text-balance">
            Chief-role obligations on a cadence. Prep templates fire 24 hr
            ahead as todos.
          </p>
        </div>
        <MeetingFormDialog mode="create" />
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Upcoming · next 14 days</CardTitle>
        </CardHeader>
        <CardContent>
          {upcoming.length === 0 ? (
            <p className="text-sm text-ink-3">
              Nothing scheduled in the next two weeks.
            </p>
          ) : (
            <ul className="space-y-3">
              {upcoming.map((o) => (
                <li
                  key={`${o.meeting.id}-${o.occursAt.toISOString()}`}
                  className="flex items-baseline gap-3"
                >
                  <span className="font-mono text-xs text-ink-3 tabular-nums shrink-0 w-32">
                    {o.occursAt.toLocaleDateString(undefined, {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                    })}{" "}
                    ·{" "}
                    {o.occursAt.toLocaleTimeString(undefined, {
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-ink truncate">{o.meeting.name}</p>
                    {o.meeting.location && (
                      <p className="text-xs text-ink-3 truncate">
                        {o.meeting.location}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <section>
        <h2 className="font-serif text-xl text-ink mb-3">
          All recurring meetings
        </h2>
        {meetings.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-ink-3">
              No meetings yet. Add the weekly OR committee, M&amp;M, MEC…
            </CardContent>
          </Card>
        ) : (
          <ul className="space-y-3">
            {meetings.map((m) => {
              const cadence = decodeCadence(m.rrule);
              const label = cadence ? humanCadence(cadence) : m.rrule;
              return <MeetingRow key={m.id} meeting={m} cadenceLabel={label} />;
            })}
          </ul>
        )}
      </section>
    </main>
  );
}
