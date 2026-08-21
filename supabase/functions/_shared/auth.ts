import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

/**
 * Builds a Supabase client authenticated as the calling user (via the
 * forwarded Authorization header) and resolves that user, or `null` if the
 * header is missing/invalid. `auth.getUser()` is what actually proves the
 * header is a real, live session rather than just any non-empty string.
 */
export async function requireUser(
  req: Request,
): Promise<{ supabase: SupabaseClient; user: { id: string } } | null> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return null;

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) return null;

  return { supabase, user };
}
