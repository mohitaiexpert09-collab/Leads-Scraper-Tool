export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/**
 * When Supabase env vars are absent the app runs in DEMO MODE: reads/writes hit an
 * in-memory sample store so you can explore the dashboard before wiring a database.
 * Add the two NEXT_PUBLIC_SUPABASE_* vars (see .env.local.example) to switch to the
 * real, persistent, multi-user backend.
 */
export function isSupabaseConfigured(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
}
