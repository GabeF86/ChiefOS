"use client";

import { useEffect, useRef, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createCaseRequest,
  updateCaseRequest,
} from "@/lib/domain/case-requests/server";
import type { CaseRequestRow } from "@/lib/schemas/case-request";
import { cn } from "@/lib/utils";

interface Props {
  mode: "create" | "edit";
  row?: CaseRequestRow;
}

export function CaseRequestFormDialog({ mode, row }: Props) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [needsMd, setNeedsMd] = useState(row?.needs_md ?? true);
  const [needsCrna, setNeedsCrna] = useState(row?.needs_crna ?? false);
  const [error, setError] = useState<string | null>(null);
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
    setError(null);
    if (!needsMd && !needsCrna) {
      setError("Pick MD, CRNA, or both.");
      return;
    }
    formData.set("needs_md", needsMd ? "on" : "");
    formData.set("needs_crna", needsCrna ? "on" : "");
    startTransition(async () => {
      try {
        if (mode === "create") {
          await createCaseRequest(formData);
        } else {
          formData.set("id", row!.id);
          await updateCaseRequest(formData);
        }
        setOpen(false);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Save failed");
      }
    });
  }

  return (
    <>
      <Button
        variant={mode === "create" ? "default" : "ghost"}
        size="sm"
        onClick={() => setOpen(true)}
      >
        {mode === "create" ? "+ New request" : "Edit"}
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
                {mode === "create" ? "New case request" : "Edit case request"}
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
            <form ref={formRef} action={onSubmit} className="p-6 space-y-5">
              <Field label="Date">
                <Input
                  name="case_date"
                  type="date"
                  required
                  defaultValue={row?.case_date ?? todayYmd()}
                  autoFocus
                />
              </Field>

              <Field label="Surgeon">
                <Input
                  name="surgeon_name"
                  required
                  maxLength={200}
                  defaultValue={row?.surgeon_name ?? ""}
                  placeholder="Dr. Smith"
                />
              </Field>

              <Field label="Anesthesia team requested">
                <div className="space-y-2.5">
                  <RoleRow
                    label="MD"
                    inputName="md_name"
                    placeholder="Specific MD (optional)"
                    checked={needsMd}
                    onChange={setNeedsMd}
                    defaultValue={row?.md_name ?? ""}
                  />
                  <RoleRow
                    label="CRNA"
                    inputName="crna_name"
                    placeholder="Specific CRNA (optional)"
                    checked={needsCrna}
                    onChange={setNeedsCrna}
                    defaultValue={row?.crna_name ?? ""}
                  />
                </div>
              </Field>

              <Field label="Notes">
                <textarea
                  name="notes"
                  defaultValue={row?.notes ?? ""}
                  rows={3}
                  maxLength={4000}
                  placeholder="Procedure, location, special requests…"
                  className="w-full resize-y rounded-input border border-border bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-3 focus:outline-none focus:ring-2 focus:ring-teal focus:ring-offset-2 focus:ring-offset-cream"
                />
              </Field>

              {mode === "edit" && (
                <Field label="Status">
                  <select
                    name="status"
                    defaultValue={row?.status ?? "pending"}
                    className="w-full rounded-input border border-border bg-surface px-3 py-2 text-sm text-ink"
                  >
                    <option value="pending">Pending</option>
                    <option value="confirmed">Confirmed</option>
                    <option value="declined">Declined</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </Field>
              )}

              {error && (
                <p className="text-sm text-red bg-red/10 border border-red/40 rounded-input px-3 py-2">
                  {error}
                </p>
              )}

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
                      ? "Create request"
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

function RoleRow({
  label,
  inputName,
  placeholder,
  checked,
  onChange,
  defaultValue,
}: {
  label: string;
  inputName: string;
  placeholder: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  defaultValue: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <label className="inline-flex items-center gap-2 cursor-pointer select-none w-20 shrink-0">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="h-4 w-4 rounded border-border text-teal focus:ring-teal"
        />
        <span className="text-sm text-ink">{label}</span>
      </label>
      <Input
        name={inputName}
        defaultValue={defaultValue}
        placeholder={placeholder}
        maxLength={200}
        disabled={!checked}
        className={cn("flex-1", !checked && "opacity-40")}
      />
    </div>
  );
}

function todayYmd(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
