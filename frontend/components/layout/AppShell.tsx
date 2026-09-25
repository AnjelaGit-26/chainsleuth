"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Sidebar } from "./Sidebar";
import { RoleSwitcher } from "./RoleSwitcher";
import { useAppStore } from "@/lib/store";
import { ShieldCheck, Activity, LogOut, User, Loader2 } from "lucide-react";

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const router = useRouter();
  const { user, isAuthenticated, isLoadingAuth, clearAuthSession } = useAppStore();

  useEffect(() => {
    // Route Protection: If authentication check finishes and user is unauthenticated, redirect to login
    if (!isLoadingAuth && !isAuthenticated) {
      router.push("/login");
    }
  }, [isLoadingAuth, isAuthenticated, router]);

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.warn("[AppShell] Error during Supabase signOut:", err);
    } finally {
      clearAuthSession();
      router.push("/login");
    }
  };

  if (isLoadingAuth) {
    return (
      <div className="h-screen w-screen bg-slate-950 flex flex-col items-center justify-center space-y-3 font-mono text-xs text-slate-300">
        <Loader2 className="w-8 h-8 text-teal-400 animate-spin" />
        <div>Verifying Officer Session...</div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen bg-slate-950 text-slate-100 overflow-hidden font-sans selection:bg-teal-900 selection:text-teal-200">
      <Sidebar />
      <div className="flex-1 flex flex-col h-full overflow-hidden min-w-0">
        {/* Top Header Bar (Compact 44px) */}
        <header className="h-11 px-4 border-b border-slate-800 bg-slate-950 flex items-center justify-between shrink-0 font-mono text-xs select-none">
          <div className="flex items-center gap-2 text-slate-400 truncate">
            <ShieldCheck className="w-4 h-4 text-teal-400 shrink-0" />
            <span className="font-semibold text-slate-200 truncate text-[11px]">
              POLICE CYBER CRIME INVESTIGATION CONSOLE
            </span>
            <span className="text-slate-700 hidden md:inline">|</span>
            <span className="text-slate-500 hidden md:inline truncate text-[11px]">
              BNSS §94 & BSA §63 COMPLIANT
            </span>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {/* Authenticated Officer Badge */}
            {user && (
              <div className="hidden sm:flex items-center gap-2 bg-slate-900 px-2.5 py-1 border border-slate-800 rounded text-[11px]">
                {user.picture ? (
                  <img
                    src={user.picture}
                    alt={user.name || "Officer"}
                    className="w-4 h-4 rounded-full object-cover border border-slate-700"
                  />
                ) : (
                  <User className="w-3.5 h-3.5 text-teal-400 shrink-0" />
                )}
                <span className="font-bold text-slate-100 truncate max-w-[140px]">
                  {user.name || user.email || "Officer"}
                </span>
                {user.badge_number && (
                  <span className="text-[9px] bg-slate-950 px-1 py-0.2 rounded text-slate-400 border border-slate-800 font-mono">
                    #{user.badge_number}
                  </span>
                )}
              </div>
            )}

            <div className="hidden lg:flex items-center gap-1.5 text-[10px] text-slate-400 bg-slate-900/80 px-2 py-0.5 border border-slate-800 rounded">
              <Activity className="w-3 h-3 text-emerald-400" />
              <span>TRON RPC: ONLINE</span>
            </div>

            <RoleSwitcher orientation="horizontal" />

            {/* Logout Button */}
            <button
              type="button"
              onClick={handleLogout}
              className="flex items-center gap-1 px-2.5 py-1 bg-slate-900 hover:bg-red-950 text-slate-400 hover:text-red-300 border border-slate-800 hover:border-red-800 rounded transition-colors text-[11px] font-sans font-semibold cursor-pointer"
              title="Logout Session"
            >
              <LogOut className="w-3.5 h-3.5 text-slate-400 group-hover:text-red-300" />
              <span className="hidden md:inline">Logout</span>
            </button>
          </div>
        </header>

        {/* Main Operational Window */}
        <main className="flex-1 overflow-y-auto p-4 bg-slate-950">{children}</main>
      </div>
    </div>
  );
}
