import { createClient } from "@supabase/supabase-js";

/**
 * Service-role Supabase client — BYPASSES RLS.
 *
 * Use ONLY in server-side code that needs to insert audit/cost rows on behalf
 * of a user (cost wrapper, system event logger). Never expose to the browser.
 *
 * Constructed lazily inside the factory function — never at module load —
 * because Next.js's `next build` evaluates module top-levels during page-data
 * collection and would crash without env vars present.
 */
export function createSupabaseServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    },
  );
}
