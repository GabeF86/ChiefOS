import { z } from "zod";

export const WeekdayCode = z.enum(["MO", "TU", "WE", "TH", "FR", "SA", "SU"]);
export type WeekdayCode = z.infer<typeof WeekdayCode>;

export const CadenceKind = z.enum([
  "weekly",        // every {weekday} at {time}
  "monthly_nth",   // {nth} {weekday} of the month at {time}  (e.g. 1st Monday)
  "monthly_day",   // day {dayOfMonth} of the month at {time}
  "one_off",       // once at {dateISO} {time}
]);
export type CadenceKind = z.infer<typeof CadenceKind>;

export const CadenceInput = z
  .object({
    kind: CadenceKind,
    weekday: WeekdayCode.optional(),
    nth: z.coerce.number().int().min(1).max(5).optional(),
    dayOfMonth: z.coerce.number().int().min(1).max(31).optional(),
    dateISO: z.string().optional(), // YYYY-MM-DD
    timeHHMM: z.string().regex(/^\d{2}:\d{2}$/, "Time HH:MM"),
  })
  .refine(
    (c) => c.kind !== "weekly" || !!c.weekday,
    "weekday required for weekly cadence",
  )
  .refine(
    (c) => c.kind !== "monthly_nth" || (!!c.weekday && !!c.nth),
    "weekday + nth required for monthly_nth cadence",
  )
  .refine(
    (c) => c.kind !== "monthly_day" || !!c.dayOfMonth,
    "dayOfMonth required for monthly_day cadence",
  )
  .refine(
    (c) => c.kind !== "one_off" || !!c.dateISO,
    "dateISO required for one_off cadence",
  );
export type CadenceInput = z.infer<typeof CadenceInput>;

export const MeetingCreateInput = z.object({
  name: z.string().trim().min(1).max(200),
  cadence: CadenceInput,
  location: z.string().trim().max(500).optional().nullable(),
  attendees: z.string().trim().max(2000).optional().nullable(),
  prep_template_md: z.string().trim().max(10_000).optional().nullable(),
});
export type MeetingCreateInput = z.infer<typeof MeetingCreateInput>;

export const MeetingUpdateInput = MeetingCreateInput.extend({
  id: z.string().uuid(),
});
export type MeetingUpdateInput = z.infer<typeof MeetingUpdateInput>;

export interface RecurringMeetingRow {
  id: string;
  user_id: string;
  name: string;
  rrule: string;
  location: string | null;
  attendees: string | null;
  prep_template_md: string | null;
  google_event_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface MeetingOccurrence {
  meeting: RecurringMeetingRow;
  occursAt: Date;
}
