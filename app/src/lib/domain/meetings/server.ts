"use server";

import { revalidatePath } from "next/cache";

import { expandRrule } from "@/lib/meetings/rrule";
import {
  MeetingCreateInput,
  MeetingUpdateInput,
  CadenceInput,
  type MeetingOccurrence,
  type RecurringMeetingRow,
} from "@/lib/schemas/meeting";
import { encodeCadence } from "@/lib/meetings/rrule";
import { createSupabaseServerClient } from "@/lib/supabase/server";

async function requireUser() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  return { supabase, user };
}

export async function listMeetings(): Promise<RecurringMeetingRow[]> {
  const { supabase, user } = await requireUser();
  const { data, error } = await supabase
    .from("recurring_meetings")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as RecurringMeetingRow[];
}

function parseFormDataCadence(fd: FormData): CadenceInput {
  return CadenceInput.parse({
    kind: fd.get("cadence_kind"),
    weekday: fd.get("weekday") || undefined,
    nth: fd.get("nth") || undefined,
    dayOfMonth: fd.get("day_of_month") || undefined,
    dateISO: fd.get("date_iso") || undefined,
    timeHHMM: fd.get("time_hhmm"),
  });
}

export async function createMeeting(formData: FormData) {
  const cadence = parseFormDataCadence(formData);
  const parsed = MeetingCreateInput.parse({
    name: formData.get("name"),
    cadence,
    location: formData.get("location") || null,
    attendees: formData.get("attendees") || null,
    prep_template_md: formData.get("prep_template_md") || null,
  });
  const { supabase, user } = await requireUser();
  const { error } = await supabase.from("recurring_meetings").insert({
    user_id: user.id,
    name: parsed.name,
    rrule: encodeCadence(parsed.cadence),
    location: parsed.location,
    attendees: parsed.attendees,
    prep_template_md: parsed.prep_template_md,
  });
  if (error) throw error;
  revalidatePath("/meetings");
  revalidatePath("/dashboard");
}

export async function updateMeeting(formData: FormData) {
  const cadence = parseFormDataCadence(formData);
  const parsed = MeetingUpdateInput.parse({
    id: formData.get("id"),
    name: formData.get("name"),
    cadence,
    location: formData.get("location") || null,
    attendees: formData.get("attendees") || null,
    prep_template_md: formData.get("prep_template_md") || null,
  });
  const { supabase, user } = await requireUser();
  const { error } = await supabase
    .from("recurring_meetings")
    .update({
      name: parsed.name,
      rrule: encodeCadence(parsed.cadence),
      location: parsed.location,
      attendees: parsed.attendees,
      prep_template_md: parsed.prep_template_md,
    })
    .eq("id", parsed.id)
    .eq("user_id", user.id);
  if (error) throw error;
  revalidatePath("/meetings");
  revalidatePath("/dashboard");
}

export async function deleteMeeting(id: string) {
  const { supabase, user } = await requireUser();
  const { error } = await supabase
    .from("recurring_meetings")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) throw error;
  revalidatePath("/meetings");
  revalidatePath("/dashboard");
}

/**
 * Expand all of a user's recurring meetings into concrete occurrences within
 * the next `daysAhead` days, sorted ascending by occurrence time.
 */
export async function listUpcomingOccurrences(
  daysAhead = 7,
  perMeetingLimit = 6,
): Promise<MeetingOccurrence[]> {
  const meetings = await listMeetings();
  const now = new Date();
  const to = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);
  const out: MeetingOccurrence[] = [];
  for (const m of meetings) {
    const occs = expandRrule(m.rrule, now, to, perMeetingLimit);
    for (const o of occs) out.push({ meeting: m, occursAt: o });
  }
  out.sort((a, b) => a.occursAt.getTime() - b.occursAt.getTime());
  return out;
}
