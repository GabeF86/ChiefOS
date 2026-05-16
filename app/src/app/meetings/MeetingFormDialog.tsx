"use client";

import { useEffect, useRef, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createMeeting,
  updateMeeting,
} from "@/lib/domain/meetings/server";
import type {
  CadenceInput,
  RecurringMeetingRow,
} from "@/lib/schemas/meeting";
import { WEEKDAY_LABEL } from "@/lib/meetings/rrule";
import { cn } from "@/lib/utils";

interface Props {
  mode: "create" | "edit";
  meeting?: RecurringMeetingRow;
  cadence?: CadenceInput;
}

export function MeetingFormDialog({ mode, meeting, cadence }: Props) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [kind, setKind] = useState<CadenceInput["kind"]>(
    cadence?.kind ?? "weekly",
  );
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  function onSubmit(formData: FormData) {
    startTransition(async () => {
      if (mode === "create") {
        await createMeeting(formData);
      } else {
        formData.set("id", meeting!.id);
        await updateMeeting(formData);
      }
      setOpen(false);
    });
  }

  const initialTime = cadence?.timeHHMM ?? "07:00";

  return (
    <>
      <Button
        variant={mode === "create" ? "default" : "ghost"}
        size="sm"
        onClick={() => setOpen(true)}
      >
        {mode === "create" ? "+ New meeting" : "Edit"}
      </Button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-ink/30 backdrop-blur-sm p-0 md:p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div
            className={cn(
              "bg-surface w-full md:max-w-lg rounded-t-card md:rounded-card border border-border",
              "max-h-[90dvh] overflow-y-auto",
              "shadow-xl",
            )}
          >
            <div className="px-6 py-5 border-b border-border flex items-center justify-between">
              <h2 className="font-serif text-xl">
                {mode === "create" ? "New recurring meeting" : "Edit meeting"}
              </h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-ink-3 hover:text-ink p-1"
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <form
              ref={formRef}
              action={onSubmit}
              className="p-6 space-y-5"
            >
              <Field label="Name">
                <Input
                  name="name"
                  required
                  maxLength={200}
                  defaultValue={meeting?.name ?? ""}
                  placeholder="OR committee"
                  autoFocus
                />
              </Field>

              <Field label="Cadence">
                <select
                  name="cadence_kind"
                  value={kind}
                  onChange={(e) =>
                    setKind(e.target.value as CadenceInput["kind"])
                  }
                  className="w-full rounded-input border border-border bg-surface px-3 py-2 text-sm text-ink"
                >
                  <option value="weekly">Weekly</option>
                  <option value="monthly_nth">Monthly · Nth weekday</option>
                  <option value="monthly_day">Monthly · Day of month</option>
                  <option value="one_off">Once</option>
                </select>
              </Field>

              {kind === "weekly" && (
                <Field label="Weekday">
                  <WeekdaySelect
                    name="weekday"
                    defaultValue={cadence?.weekday ?? "TU"}
                  />
                </Field>
              )}

              {kind === "monthly_nth" && (
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Nth">
                    <select
                      name="nth"
                      defaultValue={String(cadence?.nth ?? 1)}
                      className="w-full rounded-input border border-border bg-surface px-3 py-2 text-sm"
                    >
                      <option value="1">1st</option>
                      <option value="2">2nd</option>
                      <option value="3">3rd</option>
                      <option value="4">4th</option>
                      <option value="5">5th</option>
                    </select>
                  </Field>
                  <Field label="Weekday">
                    <WeekdaySelect
                      name="weekday"
                      defaultValue={cadence?.weekday ?? "MO"}
                    />
                  </Field>
                </div>
              )}

              {kind === "monthly_day" && (
                <Field label="Day of month">
                  <Input
                    name="day_of_month"
                    type="number"
                    min={1}
                    max={31}
                    defaultValue={cadence?.dayOfMonth ?? 1}
                  />
                </Field>
              )}

              {kind === "one_off" && (
                <Field label="Date">
                  <Input
                    name="date_iso"
                    type="date"
                    defaultValue={cadence?.dateISO ?? ""}
                    required
                  />
                </Field>
              )}

              <Field label="Time">
                <Input
                  name="time_hhmm"
                  type="time"
                  defaultValue={initialTime}
                  required
                />
              </Field>

              <Field label="Location">
                <Input
                  name="location"
                  defaultValue={meeting?.location ?? ""}
                  placeholder="Zoom · OR conference room · …"
                  maxLength={500}
                />
              </Field>

              <Field label="Attendees">
                <textarea
                  name="attendees"
                  defaultValue={meeting?.attendees ?? ""}
                  rows={2}
                  maxLength={2000}
                  placeholder="Comma-separated list"
                  className="w-full resize-y rounded-input border border-border bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-3 focus:outline-none focus:ring-2 focus:ring-teal focus:ring-offset-2 focus:ring-offset-cream"
                />
              </Field>

              <Field label="Prep template (markdown)">
                <textarea
                  name="prep_template_md"
                  defaultValue={meeting?.prep_template_md ?? ""}
                  rows={4}
                  maxLength={10_000}
                  placeholder="- Review last month's minutes&#10;- Pull current case stats"
                  className="w-full resize-y rounded-input border border-border bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-3 focus:outline-none focus:ring-2 focus:ring-teal focus:ring-offset-2 focus:ring-offset-cream font-mono"
                />
              </Field>

              <div className="flex items-center justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setOpen(false)}
                  disabled={pending}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={pending}>
                  {pending
                    ? "Saving…"
                    : mode === "create"
                      ? "Create meeting"
                      : "Save"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-mono uppercase tracking-widest text-ink-3">
        {label}
      </Label>
      {children}
    </div>
  );
}

function WeekdaySelect({
  name,
  defaultValue,
}: {
  name: string;
  defaultValue: string;
}) {
  return (
    <select
      name={name}
      defaultValue={defaultValue}
      className="w-full rounded-input border border-border bg-surface px-3 py-2 text-sm text-ink"
    >
      {(Object.entries(WEEKDAY_LABEL) as [string, string][]).map(([code, label]) => (
        <option key={code} value={code}>
          {label}
        </option>
      ))}
    </select>
  );
}
