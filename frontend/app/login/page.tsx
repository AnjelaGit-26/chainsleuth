"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAppStore } from "@/lib/store";
import { UserRole } from "@/lib/types";
import {
  signInWithEmail,
  signUpWithEmail,
  getAuthSession,
  getCurrentAuthUserEmail,
} from "@/lib/supabase";
import {
  ShieldCheck,
  UserCheck,
  Building2,
  Lock,
  ArrowRight,
  ShieldAlert,
  KeyRound,
  Mail,
  User as UserIcon,
  CheckCircle2,
  AlertCircle,
  Sparkles,
} from "lucide-react";

const waveLayers = [
  { y: 30, amp: 48, phase: 0.0 },
  { y: 100, amp: 60, phase: 1.1 },
  { y: 180, amp: 44, phase: 2.2 },
  { y: 260, amp: 66, phase: 0.7 },
  { y: 340, amp: 50, phase: 1.9 },
  { y: 420, amp: 62, phase: 2.8 },
  { y: 500, amp: 46, phase: 1.4 },
  { y: 580, amp: 58, phase: 3.1 },
  { y: 660, amp: 48, phase: 0.9 },
];

function ridgePath(y: number, amp: number, phase: number): string {
  const width = 1440;
  const segments = 8;
  let d = "";
  let px = 0;
  let py = 0;
  let lx = 0;
  for (let i = 0; i <= segments; i++) {
    const x = Math.round((width / segments) * i);
    const yy = Math.round((y + Math.sin((i / segments) * Math.PI * 2 + phase) * amp) * 10) / 10;
    if (i === 0) {
      d = `M ${x} ${yy}`;
    } else {
      d += ` Q ${px} ${py} ${(px + x) / 2} ${(py + yy) / 2}`;
    }
    px = x;
    py = yy;
    lx = x;
  }
  d += ` L ${lx} ${py} L ${lx + 60} 960 L -60 960 Z`;
  return d;
}

export default function LoginPage() {
  const router = useRouter();
  const { currentRole, setCurrentRole, setUserEmail, setBadgeNumber } = useAppStore();

  const [authMode, setAuthMode] = useState<"signin" | "signup">("signin");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("rajesh.sharma@cybercrime.gov.in");
  const [badgeId, setBadgeId] = useState("CYBER-MH-4402");
  const [password, setPassword] = useState("SecurePass2026!");
  const [loading, setLoading] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function checkExistingSession() {
      const activeEmail = await getCurrentAuthUserEmail();
      if (!isMounted) return;

      if (activeEmail) {
        setUserEmail(activeEmail);
        const savedBadge = localStorage.getItem("chainsleuth_badge_number");
        if (savedBadge) setBadgeNumber(savedBadge);

        const session = await getAuthSession();
        if (session?.user?.user_metadata?.role) {
          setCurrentRole(session.user.user_metadata.role as UserRole);
        } else if (typeof window !== "undefined") {
          const savedRole = localStorage.getItem("chainsleuth_role") as UserRole | null;
          if (savedRole) setCurrentRole(savedRole);
        }

        router.replace("/dashboard");
        return;
      }

      if (typeof window !== "undefined") {
        const savedRole = localStorage.getItem("chainsleuth_role") as UserRole | null;
        if (savedRole) setCurrentRole(savedRole);
      }

      setCheckingAuth(false);
    }

    checkExistingSession();

    return () => {
      isMounted = false;
    };
  }, [router, setCurrentRole, setUserEmail, setBadgeNumber]);

  const handleRoleSelect = (role: UserRole) => {
    setCurrentRole(role);
  };

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);
    setLoading(true);

    try {
      if (authMode === "signin") {
        const { data, error } = await signInWithEmail(email, password);
        if (error) {
          // If credentials don't exist yet, give friendly message
          setErrorMessage(error.message);
          setLoading(false);
          return;
        }

        if (data.user) {
          setUserEmail(data.user.email ?? email);
          const metaRole = data.user.user_metadata?.role as UserRole | undefined;
          if (metaRole) setCurrentRole(metaRole);
          if (data.user.user_metadata?.badge_number) {
            setBadgeNumber(data.user.user_metadata.badge_number);
          }
          router.push("/dashboard");
        }
      } else {
        const { data, error } = await signUpWithEmail(email, password, {
          role: currentRole,
          badgeNumber: badgeId,
          fullName: fullName || "Officer",
        });

        if (error) {
          setErrorMessage(error.message);
          setLoading(false);
          return;
        }

        if (data.session) {
          setUserEmail(data.user?.email ?? email);
          setBadgeNumber(badgeId);
          setSuccessMessage("Officer account registered successfully! Initializing workspace…");
          setTimeout(() => router.push("/dashboard"), 800);
        } else {
          setSuccessMessage("Officer account registered! Check your email inbox to verify your credentials.");
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Authentication error occurred";
      setErrorMessage(msg);
    } finally {
      setLoading(false);
    }
  };

  // Instant demo bypass for examiners/reviewers
  const handleQuickDemoAccess = () => {
    setUserEmail(email);
    setBadgeNumber(badgeId);
    router.push("/dashboard");
  };

  const rolesConfig: {
    id: UserRole;
    title: string;
    code: string;
    description: string;
    icon: React.ElementType;
  }[] = [
    {
      id: "investigating_officer",
      title: "Investigating Officer",
      code: "ROLE_IO_LEO",
      description:
        "Execute automated TRON / EVM money-flow traces, inspect transaction graph nodes, flag suspect burner addresses.",
      icon: UserCheck,
    },
    {
      id: "supervisory_officer",
      title: "Supervisory Officer",
      code: "ROLE_SUPERVISOR",
      description:
        "Review investigation case files, approve & sign Section 94 BNSS legal freeze notices, inspect system audit logs.",
      icon: ShieldCheck,
    },
    {
      id: "vasp_nodal_officer",
      title: "VASP Nodal Officer",
      code: "ROLE_VASP_NODAL",
      description:
        "Exchange compliance interface for receiving court-ordered freeze directives & verifying Section 63 BSA evidence certificates.",
      icon: Building2,
    },
  ];

  if (checkingAuth) {
    return (
      <div className="min-h-screen w-screen bg-[var(--background)] flex items-center justify-center">
        <div className="flex items-center gap-3 text-sm text-[var(--muted-foreground)] font-mono">
          <div className="size-4 animate-spin rounded-full border-2 border-[var(--primary)] border-t-transparent" />
          <span>Verifying security session…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen w-screen overflow-hidden bg-[var(--background)] text-[var(--foreground)] flex items-center justify-center p-4 sm:p-8">
      {/* Animated wave background */}
      <div aria-hidden className="absolute -inset-[10%] animate-bg-drift pointer-events-none">
        <svg className="h-full w-full" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice" role="presentation">
          <defs>
            <linearGradient id="wave-login-a" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#FFFFFF" />
              <stop offset="100%" stopColor="#E2EBDD" />
            </linearGradient>
            <linearGradient id="wave-login-b" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#F5F8F3" />
              <stop offset="100%" stopColor="#D9E5D0" />
            </linearGradient>
          </defs>
          {waveLayers.map((layer, i) => (
            <path
              key={i}
              d={ridgePath(layer.y, layer.amp, layer.phase)}
              fill={i % 2 ? "url(#wave-login-a)" : "url(#wave-login-b)"}
              stroke="#FFFFFF"
              strokeOpacity={0.85}
              strokeWidth={2}
            />
          ))}
        </svg>
      </div>

      <div className="relative z-10 w-full max-w-2xl space-y-6">
        {/* Header */}
        <div className="workspace-in text-center space-y-2">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-[color-mix(in_oklab,var(--primary)_20%,transparent)] bg-[color-mix(in_oklab,var(--primary)_10%,transparent)] px-3 py-1 text-xs font-bold text-[var(--primary)]">
            <ShieldAlert className="size-3.5" />
            <span>Supabase Secured · Law Enforcement Portal</span>
          </div>
          <h1 className="font-display text-2xl font-bold sm:text-3xl text-[var(--foreground)]">
            Officer Authentication &amp; Access Control
          </h1>
          <p className="text-xs text-[var(--muted-foreground)] sm:text-sm max-w-xl mx-auto">
            Multi-tiered role-based access control under the Bharatiya Nagarik Suraksha Sanhita (BNSS) &amp; Digital Personal Data Protection Act.
          </p>
        </div>

        {/* Role Selection Cards */}
        <div className="glass-panel workspace-in p-5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted-foreground)]">
              Operational Authorization Profile
            </span>
            <span className="text-[10px] font-mono text-[var(--primary)] font-bold">
              ACTIVE: {rolesConfig.find((r) => r.id === currentRole)?.code}
            </span>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            {rolesConfig.map((roleItem) => {
              const Icon = roleItem.icon;
              const isSelected = currentRole === roleItem.id;

              return (
                <button
                  key={roleItem.id}
                  type="button"
                  onClick={() => handleRoleSelect(roleItem.id)}
                  className={[
                    "flex flex-col text-left p-3.5 rounded-2xl border transition-all text-xs space-y-2 group cursor-pointer",
                    isSelected
                      ? "border-[var(--primary)] bg-[color-mix(in_oklab,var(--primary)_10%,transparent)] shadow-sm"
                      : "border-white/50 bg-white/40 hover:bg-white hover:border-[color-mix(in_oklab,var(--primary)_40%,transparent)]",
                  ].join(" ")}
                >
                  <div className="flex items-center justify-between">
                    <div
                      className={[
                        "grid size-8 place-items-center rounded-xl",
                        isSelected
                          ? "bg-[var(--primary)] text-white"
                          : "bg-white text-[var(--foreground)]",
                      ].join(" ")}
                    >
                      <Icon className="size-4" />
                    </div>
                    {isSelected && (
                      <span className="size-2 rounded-full bg-[var(--primary)] ring-2 ring-[color-mix(in_oklab,var(--primary)_30%,transparent)]" />
                    )}
                  </div>
                  <div>
                    <div className="font-bold text-[var(--foreground)] truncate">
                      {roleItem.title}
                    </div>
                    <span className="text-[9px] font-mono font-bold text-[var(--primary)] block uppercase mt-0.5">
                      {roleItem.code}
                    </span>
                  </div>
                  <p className="text-[11px] leading-relaxed text-[var(--muted-foreground)] line-clamp-2">
                    {roleItem.description}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Credentials Form */}
        <form onSubmit={handleAuthSubmit} className="glass-panel workspace-in p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-white/40 pb-3">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted-foreground)]">
              {authMode === "signin" ? "Supabase Official Verification" : "Register New Officer / Nodal Profile"}
            </span>

            {/* Auth Mode Toggle Pill */}
            <div className="inline-flex rounded-full bg-white/60 p-0.5 border border-white/60 text-[11px] font-semibold">
              <button
                type="button"
                onClick={() => { setAuthMode("signin"); setErrorMessage(null); }}
                className={[
                  "px-3 py-1 rounded-full transition-colors cursor-pointer",
                  authMode === "signin"
                    ? "bg-[var(--primary)] text-white font-bold"
                    : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]",
                ].join(" ")}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => { setAuthMode("signup"); setErrorMessage(null); }}
                className={[
                  "px-3 py-1 rounded-full transition-colors cursor-pointer",
                  authMode === "signup"
                    ? "bg-[var(--primary)] text-white font-bold"
                    : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]",
                ].join(" ")}
              >
                Sign Up
              </button>
            </div>
          </div>

          {errorMessage && (
            <div className="flex items-center gap-2 rounded-xl bg-rose-500/10 border border-rose-300 p-3 text-xs text-rose-700">
              <AlertCircle className="size-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="flex items-center gap-2 rounded-xl bg-emerald-500/10 border border-emerald-300 p-3 text-xs text-emerald-800">
              <CheckCircle2 className="size-4 shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            {authMode === "signup" && (
              <div className="sm:col-span-2">
                <label className="text-[11px] font-semibold text-[var(--muted-foreground)] mb-1 block">
                  Full Name / Designation
                </label>
                <div className="relative">
                  <UserIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-[var(--muted-foreground)]" />
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. Inspector Rajesh Sharma"
                    className="field pl-9.5 text-xs"
                    required={authMode === "signup"}
                  />
                </div>
              </div>
            )}

            <div>
              <label className="text-[11px] font-semibold text-[var(--muted-foreground)] mb-1 block">
                Official Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-[var(--muted-foreground)]" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="officer@cybercrime.gov.in"
                  className="field pl-9.5 text-xs font-mono"
                  required
                />
              </div>
            </div>

            <div>
              <label className="text-[11px] font-semibold text-[var(--muted-foreground)] mb-1 block">
                Badge / Station ID
              </label>
              <div className="relative">
                <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-[var(--muted-foreground)]" />
                <input
                  type="text"
                  value={badgeId}
                  onChange={(e) => setBadgeId(e.target.value)}
                  placeholder="e.g. CYBER-MH-4402"
                  className="field pl-9.5 text-xs font-mono"
                  required
                />
              </div>
            </div>

            <div className="sm:col-span-2">
              <label className="text-[11px] font-semibold text-[var(--muted-foreground)] mb-1 block">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-[var(--muted-foreground)]" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="field pl-9.5 text-xs font-mono"
                  required
                />
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-3 border-t border-white/30">
            <button
              type="button"
              onClick={handleQuickDemoAccess}
              className="inline-flex items-center gap-1.5 text-xs text-[var(--muted-foreground)] hover:text-[var(--primary)] transition-colors cursor-pointer"
            >
              <Sparkles className="size-3.5 text-[var(--primary)]" />
              <span>Instant Reviewer / Demo Access</span>
            </button>

            <button
              type="submit"
              disabled={loading}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-full bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white px-6 py-2.5 text-xs font-bold transition-all shadow-sm cursor-pointer"
            >
              <span>{loading ? "Authenticating with Supabase…" : authMode === "signin" ? "Enter Workspace" : "Register Officer Account"}</span>
              <ArrowRight className="size-3.5" />
            </button>
          </div>
        </form>

        {/* Footer info */}
        <div className="flex items-center justify-between text-[11px] text-[var(--muted-foreground)] px-2 font-mono">
          <div>BNSS §94 · BSA §63 · SUPABASE AUTH</div>
          <div>BUILD 2026.09.25</div>
        </div>
      </div>
    </div>
  );
}
