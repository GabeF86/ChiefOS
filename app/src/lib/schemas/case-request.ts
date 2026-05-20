import { z } from "zod";

export const CaseRequestStatus = z.enum([
  "pending",
  "confirmed",
  "declined",
  "cancelled",
]);
export type CaseRequestStatus = z.infer<typeof CaseRequestStatus>;

export const CaseRequestSource = z.enum(["manual", "email"]);
export type CaseRequestSource = z.infer<typeof CaseRequestSource>;

const CaseRequestBase = z.object({
  case_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date YYYY-MM-DD"),
  surgeon_name: z.string().trim().min(1).max(200),
  needs_md: z.coerce.boolean().default(false),
  needs_crna: z.coerce.boolean().default(false),
  md_name: z.string().trim().max(200).optional().nullable(),
  crna_name: z.string().trim().max(200).optional().nullable(),
  notes: z.string().trim().max(4000).optional().nullable(),
});

const needsAtLeastOneRole = (v: { needs_md: boolean; needs_crna: boolean }) =>
  v.needs_md || v.needs_crna;
const needsAtLeastOneRoleErr = {
  message: "Pick MD, CRNA, or both",
  path: ["needs_md"] as PropertyKey[],
};

export const CaseRequestCreateInput = CaseRequestBase.refine(
  needsAtLeastOneRole,
  needsAtLeastOneRoleErr,
);
export type CaseRequestCreateInput = z.infer<typeof CaseRequestCreateInput>;

export const CaseRequestUpdateInput = CaseRequestBase.extend({
  id: z.string().uuid(),
  status: CaseRequestStatus.optional(),
}).refine(needsAtLeastOneRole, needsAtLeastOneRoleErr);
export type CaseRequestUpdateInput = z.infer<typeof CaseRequestUpdateInput>;

export interface CaseRequestRow {
  id: string;
  user_id: string;
  case_date: string;       // YYYY-MM-DD
  surgeon_name: string;
  needs_md: boolean;
  needs_crna: boolean;
  md_name: string | null;
  crna_name: string | null;
  notes: string | null;
  status: CaseRequestStatus;
  source: CaseRequestSource;
  source_ref: string | null;
  created_at: string;
  updated_at: string;
}
