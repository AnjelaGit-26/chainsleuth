"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { useAppStore } from "@/lib/store";
import { UserRole } from "@/lib/types";
import { Shield, UserCheck, Building2, Terminal, ArrowRight, Lock, Loader2, AlertCircle, Mail, KeyRound, Eye, EyeOff } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const { isAuthenticated, isLoadingAuth, authError, setCurrentRole } = useAppStore();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [selectedRole, setSelectedRole] = useState<UserRole>("investigating_officer");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  useEffect(() => {
    // If user is already authenticated with a valid Supabase session, navigate to dashboard
    if (isAuthenticated) {
      router.push("/dashboard");
    }
  }, [isAuthenticated, router]);

  const handleSupabaseLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);

    if (!isSupabaseConfigured()) {
      setLoginError(
        "Supabase Credentials Required: Please update NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in your .env.local file with real project credentials from your Supabase dashboard."
      );
      return;
    }

    if (!email || !password) {
      setLoginError("Please provide both officer email and password.");
      return;
    }

    setIsSubmitting(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        const errorMsg =
          error.message === "Invalid API key"
            ? "Invalid Supabase API Key: Please update NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local with a valid publishable/anon key from your Supabase backend dashboard."
            : error.message || "Invalid officer login credentials.";
        setLoginError(errorMsg);
      } else if (data?.session) {
        setCurrentRole(selectedRole);
        router.push("/dashboard");
      }
    } catch (err: unknown) {
      console.error("[LoginPage] Unexpected login error:", err);
      const msg = err instanceof Error ? err.message : "Authentication service failure.";
      setLoginError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const rolesConfig: {
    id: UserRole;
    title: string;
    code: string;
    description: string;
    icon: React.ElementType;
    badgeColor: string;
    borderColor: string;
  }[] = [
    {
      id: "investigating_officer",
      title: "Investigating Officer",
      code: "ROLE_IO_LEO",
      description:
        "Execute automated TRON / EVM money-flow traces, inspect transaction graph nodes, flag suspect burner addresses.",
      icon: UserCheck,
      badgeColor: "bg-teal-950/80 text-teal-400 border-teal-800",
      borderColor: "hover:border-teal-500/80",
    },
    {
      id: "supervisory_officer",
      title: "Supervisory Officer",
      code: "ROLE_SUPERVISOR",
      description:
        "Review investigation case files, approve & sign Section 94 BNSS legal freeze notices, inspect system audit logs.",
      icon: Shield,
      badgeColor: "bg-amber-950/80 text-amber-400 border-amber-800",
      borderColor: "hover:border-amber-500/80",
    },
    {
      id: "vasp_nodal_officer",
      title: "VASP Nodal Compliance Officer",
      code: "ROLE_VASP_NODAL",
      description:
        "Exchange compliance interface for receiving court-ordered freeze directives & verifying Section 63 BSA evidence certificates.",
      icon: Building2,
      badgeColor: "bg-slate-900 text-slate-300 border-slate-700",
      borderColor: "hover:border-slate-500",
    },
  ];

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
                CHAINSLEUTH // CONSOLE LOGIN
              </div>
              <div className="text-[10px] text-slate-500 uppercase tracking-widest">
                Crypto Fraud Investigation System • Law Enforcement Access
              </div>
            </div>
          </div>
          <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/50 border border-emerald-800 px-2 py-0.5 rounded flex items-center gap-1">
            <Lock className="w-3 h-3 text-emerald-400" />
            SUPABASE SECURE
          </span>
        </div>

        {/* Error Banners */}
        {(loginError || authError) && (
          <div className="p-3.5 bg-red-950/90 border border-red-700 rounded text-red-200 text-xs font-mono space-y-1 shadow-lg">
            <div className="flex items-center gap-2 font-bold font-sans text-red-400">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>AUTHENTICATION ERROR</span>
            </div>
            <p className="text-[11px] text-red-300 leading-relaxed font-mono">
              {loginError || authError}
            </p>
          </div>
        )}

        {/* Loading State */}
        {isLoadingAuth ? (
          <div className="py-12 flex flex-col items-center justify-center space-y-3 bg-slate-900/60 border border-slate-800 rounded">
            <Loader2 className="w-8 h-8 text-teal-400 animate-spin" />
            <div className="text-xs text-slate-300 font-mono">
              Checking Supabase officer session...
            </div>
          </div>
        ) : (
          <form onSubmit={handleSupabaseLogin} className="space-y-4">
            {/* Email Field */}
            <div className="space-y-1.5 font-sans">
              <label className="text-xs text-slate-300 font-semibold flex items-center gap-1.5 font-mono">
                <Mail className="w-3.5 h-3.5 text-teal-400" />
                <span>OFFICER EMAIL</span>
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="officer@chainsleuth.gov.in"
                className="w-full px-3.5 py-2.5 bg-slate-900/90 border border-slate-800 rounded text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-teal-500 font-mono"
              />
            </div>

            {/* Password Field */}
            <div className="space-y-1.5 font-sans">
              <div className="flex items-center justify-between">
                <label className="text-xs text-slate-300 font-semibold flex items-center gap-1.5 font-mono">
                  <KeyRound className="w-3.5 h-3.5 text-teal-400" />
                  <span>PASSWORD</span>
                </label>
                <Link
                  href="/forgot-password"
                  className="text-[11px] text-teal-400 hover:text-teal-300 hover:underline font-mono"
                >
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
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

            {/* Role Context Prompt */}
            <div className="text-[11px] text-slate-400 bg-slate-900/60 border border-slate-800 p-2 rounded font-mono">
              <span className="text-teal-400 font-bold">$</span> SELECT INITIAL OPERATIONAL ACCESS ROLE:
            </div>

            {/* Role Options */}
            <div className="space-y-2 font-sans text-xs">
              {rolesConfig.map((roleItem) => {
                const Icon = roleItem.icon;
                const isSelected = selectedRole === roleItem.id;
                return (
                  <button
                    key={roleItem.id}
                    type="button"
                    onClick={() => setSelectedRole(roleItem.id)}
                    className={`w-full text-left p-3 rounded bg-slate-900/80 border transition-all duration-150 flex items-start justify-between gap-4 cursor-pointer ${
                      isSelected
                        ? "border-teal-500 bg-slate-900 ring-1 ring-teal-500/50"
                        : "border-slate-800 hover:border-slate-700"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="p-1.5 rounded bg-slate-950 border border-slate-800 shrink-0 mt-0.5">
                        <Icon className={`w-4 h-4 ${isSelected ? "text-teal-400" : "text-slate-400"}`} />
                      </div>
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-100 text-xs">
                            {roleItem.title}
                          </span>
                          <span
                            className={`text-[9px] font-mono px-1.5 py-0.2 rounded border uppercase tracking-wider ${roleItem.badgeColor}`}
                          >
                            {roleItem.code}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-400 leading-tight font-mono">
                          {roleItem.description}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 bg-teal-500 hover:bg-teal-400 text-slate-950 font-sans font-extrabold text-xs uppercase tracking-wider rounded transition-all shadow-xl flex items-center justify-center gap-2 cursor-pointer border border-teal-400/80 disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>SIGNING IN...</span>
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4" />
                  <span>SIGN IN</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

            {/* Navigation link to Signup */}
            <div className="text-center pt-2 text-xs text-slate-400 font-sans">
              Don&apos;t have an account?{" "}
              <Link href="/signup" className="text-teal-400 hover:text-teal-300 font-semibold underline">
                Create account
              </Link>
            </div>
          </form>
        )}

        {/* Footer info */}
        <div className="flex items-center justify-between text-[10px] text-slate-500 border-t border-slate-800/80 pt-4 font-mono">
          <div>SIH26183 • SUPABASE AUTH & BNSS §94 COMPLIANT</div>
          <div>BUILD 2026.09.24</div>
        </div>
      </div>
    </div>
  );
}
