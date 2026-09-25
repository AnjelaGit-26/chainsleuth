"use client";

import React, { useEffect } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { useAppStore } from "@/lib/store";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { setAuthSession, clearAuthSession, setIsLoadingAuth } = useAppStore();

  useEffect(() => {
    let isMounted = true;

    async function initAuth() {
      if (!isSupabaseConfigured()) {
        if (isMounted) {
          clearAuthSession();
          setIsLoadingAuth(false);
        }
        return;
      }

      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) {
          console.warn("[SupabaseAuth] getSession warning:", error.message);
        }

        if (isMounted) {
          if (session?.user) {
            const email = session.user.email || "";
            const name = session.user.user_metadata?.full_name || session.user.user_metadata?.name || email.split("@")[0] || "Officer";
            setAuthSession({
              user: {
                email,
                name,
                sub: session.user.id,
                role: "investigating_officer",
              },
              token: session.access_token,
              roles: ["investigating_officer", "supervisory_officer", "vasp_nodal_officer"],
              permissions: [],
              isAuthenticated: true,
            });
          } else {
            clearAuthSession();
          }
        }
      } catch (err) {
        console.error("[SupabaseAuth] Unexpected error during session check:", err);
        if (isMounted) clearAuthSession();
      } finally {
        if (isMounted) setIsLoadingAuth(false);
      }
    }

    initAuth();

    if (!isSupabaseConfigured()) return;

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event: unknown, session: Session | null) => {
      if (session?.user) {
        const email = session.user.email || "";
        const name = session.user.user_metadata?.full_name || session.user.user_metadata?.name || email.split("@")[0] || "Officer";
        setAuthSession({
          user: {
            email,
            name,
            sub: session.user.id,
            role: "investigating_officer",
          },
          token: session.access_token,
          roles: ["investigating_officer", "supervisory_officer", "vasp_nodal_officer"],
          permissions: [],
          isAuthenticated: true,
        });
      } else {
        clearAuthSession();
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [setAuthSession, clearAuthSession, setIsLoadingAuth]);

  return <>{children}</>;
}
