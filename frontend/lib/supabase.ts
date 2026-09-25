import { createClient, SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://your-supabase-project-url.supabase.co";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "your-supabase-anon-key";

declare global {
  var __supabaseInstance: SupabaseClient | undefined;
}

export const supabase: SupabaseClient =
  globalThis.__supabaseInstance ||
  (globalThis.__supabaseInstance = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  }));

export function isSupabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
  return (
    Boolean(url) &&
    Boolean(key) &&
    !url.includes("your-supabase-project-url") &&
    !key.includes("your-supabase-anon-key")
  );
}
