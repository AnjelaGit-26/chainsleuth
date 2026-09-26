"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getCurrentAuthUserEmail, getAuthSession } from "@/lib/supabase";
import { useAppStore } from "@/lib/store";
import { UserRole } from "@/lib/types";

export default function Home() {
  const router = useRouter();
  const { userEmail, setUserEmail, setCurrentRole } = useAppStore();

  useEffect(() => {
    let isMounted = true;

    async function checkAuthAndRedirect() {
      if (userEmail) {
        router.replace("/dashboard");
        return;
      }

      const email = await getCurrentAuthUserEmail();
      if (!isMounted) return;

      if (email) {
        setUserEmail(email);
        const session = await getAuthSession();
        if (session?.user?.user_metadata?.role) {
          setCurrentRole(session.user.user_metadata.role as UserRole);
        }
        router.replace("/dashboard");
      } else {
        router.replace("/login");
      }
    }

    checkAuthAndRedirect();

    return () => {
      isMounted = false;
    };
  }, [router, userEmail, setUserEmail, setCurrentRole]);

  return (
    <div className="min-h-screen w-screen bg-[var(--background)] flex items-center justify-center">
      <div className="flex items-center gap-3 text-sm text-[var(--muted-foreground)] font-mono">
        <div className="size-4 animate-spin rounded-full border-2 border-[var(--primary)] border-t-transparent" />
        <span>Verifying security session…</span>
      </div>
    </div>
  );
}

