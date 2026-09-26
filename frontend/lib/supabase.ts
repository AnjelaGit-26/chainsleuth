import { createClient, User, Session } from "@supabase/supabase-js";
import { UserRole } from "./types";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://mudfqfuhymsbxmhiqjsz.supabase.co";
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im11ZGZxZnVoeW1zYnhtaGlxanN6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAxMDE3NzEsImV4cCI6MjEwNTY3Nzc3MX0.2lMq_ekCdo3gUBb-U8_KzNMks2iDqE7Y_-xe8z0gJWs";

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

export interface OfficerProfile {
  id: string;
  email: string;
  badgeNumber?: string;
  role: UserRole;
  fullName?: string;
  station?: string;
}

/**
 * Sign in with email and password using Supabase Auth
 */
export async function signInWithEmail(email: string, password: string) {
  return await supabase.auth.signInWithPassword({
    email,
    password,
  });
}

/**
 * Sign up a new officer/compliance user with custom metadata (role, badge, station)
 */
export async function signUpWithEmail(
  email: string,
  password: string,
  metadata: {
    role: UserRole;
    badgeNumber?: string;
    fullName?: string;
    station?: string;
  }
) {
  return await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        role: metadata.role,
        badge_number: metadata.badgeNumber,
        full_name: metadata.fullName,
        station: metadata.station,
      },
    },
  });
}

/**
 * Sign out current session
 */
export async function signOutUser() {
  if (typeof window !== "undefined") {
    localStorage.removeItem("chainsleuth_user_email");
    localStorage.removeItem("chainsleuth_badge_number");
  }
  return await supabase.auth.signOut();
}

/**
 * Get current session
 */
export async function getAuthSession(): Promise<Session | null> {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

/**
 * Get current user
 */
export async function getAuthUser(): Promise<User | null> {
  const { data } = await supabase.auth.getUser();
  return data.user;
}

/**
 * Get current authenticated user email from Supabase session or local storage
 */
export async function getCurrentAuthUserEmail(): Promise<string | null> {
  try {
    const { data } = await supabase.auth.getSession();
    if (data.session?.user?.email) {
      return data.session.user.email;
    }
  } catch (err) {
    console.error("Error checking Supabase auth session:", err);
  }

  if (typeof window !== "undefined") {
    const saved = localStorage.getItem("chainsleuth_user_email");
    if (saved) return saved;
  }

  return null;
}

