import Link from "next/link";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { listUpcomingOccurrences } from "@/lib/domain/meetings/server";

export async function MeetingsCard() {
  const upcoming = await listUpcomingOccurrences(7, 4);
  const visible = upcoming.slice(0, 5);

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle>Upcoming Meetings</CardTitle>
        <Link
          href="/meetings"
          className="text-xs font-mono text-ink-3 hover:text-ink uppercase tracking-widest"
        >
          Manage →
        </Link>
      </CardHeader>
      <CardContent>
        {visible.length === 0 ? (
          <p className="text-sm text-ink-3">
            Nothing in the next 7 days.{" "}
            <Link href="/meetings" className="text-teal hover:underline">
              Add a meeting
            </Link>
            .
          </p>
        ) : (
          <ul className="space-y-2.5">
            {visible.map((o) => {
              const day = o.occursAt.toLocaleDateString(undefined, {
                weekday: "short",
                month: "short",
                day: "numeric",
              });
              const time = o.occursAt.toLocaleTimeString(undefined, {
                hour: "numeric",
                minute: "2-digit",
              });
              return (
                <li
                  key={`${o.meeting.id}-${o.occursAt.toISOString()}`}
                  className="flex items-baseline gap-2"
                >
                  <span className="font-mono text-[11px] uppercase tracking-widest text-ink-3 tabular-nums shrink-0 w-24">
                    {day}
                  </span>
                  <span className="font-mono text-[11px] text-ink-2 tabular-nums shrink-0 w-14">
                    {time}
                  </span>
                  <span className="text-sm text-ink truncate">
                    {o.meeting.name}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
