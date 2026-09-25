"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { Terminal, ArrowRight, Lock, Loader2, AlertCircle, KeyRound, CheckCircle2, Eye, EyeOff } from "lucide-react";

export default function ResetPasswordPage() {
  const router = useRouter();

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handlePasswordUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!isSupabaseConfigured()) {
      setErrorMsg(
        "Supabase Credentials Required: Please update NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in your .env.local file with real project credentials."
      );
      return;
    }

    if (!newPassword || !confirmPassword) {
      setErrorMsg("Please provide both new password and confirmation.");
      return;
    }

    if (newPassword.length < 6) {
      setErrorMsg("Password does not meet requirements (must be at least 6 characters).");
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMsg("Passwords do not match.");
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        console.error("[ResetPasswordPage] Supabase error:", error.message);
        setErrorMsg(error.message || "Failed to update password. Please try again.");
      } else {
        setSuccessMsg("Password updated successfully. Redirecting to login console...");
        setTimeout(() => {
          router.push("/login");
        }, 2000);
      }
    } catch (err: unknown) {
      console.error("[ResetPasswordPage] Unexpected error:", err);
      const msg = err instanceof Error ? err.message : "Service error updating password.";
      setErrorMsg(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen w-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4 font-mono select-none">
      <div className="w-full max-w-xl bg-slate-950 border border-slate-800 rounded p-6 shadow-2xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded bg-slate-900 border border-slate-700 flex items-center justify-center text-teal-400">
              <Terminal className="w-4 h-4" />
            </div>
            <div>
              <div className="text-sm font-bold tracking-wider uppercase font-sans text-slate-100">
                CHAINSLEUTH // UPDATE PASSWORD
              </div>
              <div className="text-[10px] text-slate-500 uppercase tracking-widest">
                Crypto Fraud Investigation System • Password Update Console
              </div>
            </div>
          </div>
          <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/50 border border-emerald-800 px-2 py-0.5 rounded flex items-center gap-1">
            <Lock className="w-3 h-3 text-emerald-400" />
            SUPABASE SECURE
          </span>
        </div>

        {/* Error Banner */}
        {errorMsg && (
          <div className="p-3.5 bg-red-950/90 border border-red-700 rounded text-red-200 text-xs font-mono space-y-1 shadow-lg">
            <div className="flex items-center gap-2 font-bold font-sans text-red-400">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>UPDATE FAILURE</span>
            </div>
            <p className="text-[11px] text-red-300 leading-relaxed font-mono">{errorMsg}</p>
          </div>
        )}

        {/* Success Banner */}
        {successMsg && (
          <div className="p-3.5 bg-emerald-950/90 border border-emerald-700 rounded text-emerald-200 text-xs font-mono space-y-1 shadow-lg">
            <div className="flex items-center gap-2 font-bold font-sans text-emerald-400">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>UPDATE SUCCESSFUL</span>
            </div>
            <p className="text-[11px] text-emerald-300 leading-relaxed font-mono">{successMsg}</p>
          </div>
        )}

        <form onSubmit={handlePasswordUpdate} className="space-y-4 font-sans">
          {/* New Password Field */}
          <div className="space-y-1.5 font-sans">
            <label className="text-xs text-slate-300 font-semibold flex items-center gap-1.5 font-mono">
              <KeyRound className="w-3.5 h-3.5 text-teal-400" />
              <span>NEW PASSWORD</span>
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full px-3.5 py-2.5 bg-slate-900/90 border border-slate-800 rounded text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-teal-500 font-mono pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Confirm New Password Field */}
          <div className="space-y-1.5 font-sans">
            <label className="text-xs text-slate-300 font-semibold flex items-center gap-1.5 font-mono">
              <KeyRound className="w-3.5 h-3.5 text-teal-400" />
              <span>CONFIRM NEW PASSWORD</span>
            </label>
            <input
              type={showPassword ? "text" : "password"}
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••••••"
              className="w-full px-3.5 py-2.5 bg-slate-900/90 border border-slate-800 rounded text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-teal-500 font-mono"
            />
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3 bg-teal-500 hover:bg-teal-400 text-slate-950 font-sans font-extrabold text-xs uppercase tracking-wider rounded transition-all shadow-xl flex items-center justify-center gap-2 cursor-pointer border border-teal-400/80 disabled:opacity-50 mt-2"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>UPDATING PASSWORD...</span>
              </>
            ) : (
              <>
                <Lock className="w-4 h-4" />
                <span>UPDATE PASSWORD</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>

          {/* Navigation link */}
          <div className="text-center pt-2 text-xs font-sans">
            <Link href="/login" className="text-teal-400 hover:text-teal-300 font-semibold underline">
              Return to Login
            </Link>
          </div>
        </form>

        {/* Footer info */}
        <div className="flex items-center justify-between text-[10px] text-slate-500 border-t border-slate-800/80 pt-4 font-mono">
          <div>SIH26183 • SUPABASE AUTH UPDATE</div>
          <div>BUILD 2026.09.24</div>
        </div>
      </div>
    </div>
  );
}
