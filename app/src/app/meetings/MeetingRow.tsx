"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { deleteMeeting } from "@/lib/domain/meetings/server";
import { decodeCadence } from "@/lib/meetings/rrule";
import type { RecurringMeetingRow } from "@/lib/schemas/meeting";

import { MeetingFormDialog } from "./MeetingFormDialog";

export function MeetingRow({
  meeting,
  cadenceLabel,
}: {
  meeting: RecurringMeetingRow;
  cadenceLabel: string;
}) {
  const [pending, startTransition] = useTransition();
  const [expanded, setExpanded] = useState(false);
  const cadence = decodeCadence(meeting.rrule);

  return (
    <Card>
      <CardContent className="py-4 px-5">
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="text-left w-full"
            >
              <p className="font-serif text-lg text-ink leading-snug">
                {meeting.name}
              </p>
              <p className="text-xs font-mono uppercase tracking-widest text-ink-3 mt-0.5">
                {cadenceLabel}
              </p>
            </button>
            {meeting.location && (
              <p className="text-sm text-ink-2 mt-1">{meeting.location}</p>
            )}
            {expanded && (
              <div className="mt-3 space-y-2 text-sm">
                {meeting.attendees && (
                  <div>
                    <p className="text-[10px] font-mono uppercase tracking-widest text-ink-3 mb-0.5">
                      Attendees
                    </p>
                    <p className="text-ink-2 whitespace-pre-wrap">
                      {meeting.attendees}
                    </p>
                  </div>
                )}
                {meeting.prep_template_md && (
                  <div>
                    <p className="text-[10px] font-mono uppercase tracking-widest text-ink-3 mb-0.5">
                      Prep template
                    </p>
                    <pre className="text-ink-2 whitespace-pre-wrap font-sans text-sm">
                      {meeting.prep_template_md}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {cadence && (
              <MeetingFormDialog
                mode="edit"
                meeting={meeting}
                cadence={cadence}
              />
            )}
            <Button
              variant="ghost"
              size="sm"
              className="text-ink-3 hover:text-red"
              onClick={() => {
                if (!confirm(`Delete "${meeting.name}"?`)) return;
                startTransition(() => deleteMeeting(meeting.id));
              }}
              disabled={pending}
            >
              Delete
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
