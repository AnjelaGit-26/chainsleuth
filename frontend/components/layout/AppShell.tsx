"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAppStore } from "@/lib/store";
import { UserRole } from "@/lib/types";
import { signOutUser } from "@/lib/supabase";
import {
  LayoutDashboard,
  Plus,
  FolderSearch,
  FileText,
  Activity,
  ShieldCheck,
  UserRoundCog,
  Building2,
  Lock,
  ChevronLeft,
  Menu,
  X,
  Info,
  LogOut,
} from "lucide-react";

const navItems = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "New Investigation", href: "/trace/new", icon: Plus },
  { label: "Investigations", href: "/dashboard", icon: FolderSearch },
  { label: "Legal Notices", href: "/case/CS-2026-8891/notice", icon: FileText },
  { label: "Supervisory Audit", href: "/dashboard/audit", icon: Lock },
];

const roles: { value: UserRole; label: string }[] = [
  { value: "investigating_officer", label: "Investigating Officer" },
  { value: "supervisory_officer", label: "Supervisory Officer" },
  { value: "vasp_nodal_officer", label: "VASP Nodal Officer" },
];

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

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { currentRole, setCurrentRole, userEmail, setUserEmail, setBadgeNumber } = useAppStore();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [roleMenuOpen, setRoleMenuOpen] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("chainsleuth_role") as UserRole | null;
      if (saved) setCurrentRole(saved);
    }
  }, [setCurrentRole]);

  const currentRoleLabel = roles.find((r) => r.value === currentRole)?.label ?? "Investigating Officer";

  return (
    <div className="flex min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      {/* Mobile overlay */}
      {mobileOpen && (
        <button
          aria-label="Close navigation overlay"
          className="fixed inset-0 z-30 bg-black/20 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={[
          "fixed inset-y-0 left-0 z-40 flex h-screen flex-col border-r border-[color-mix(in_oklab,var(--border)_60%,transparent)] bg-white/80 backdrop-blur-md transition-[transform,width] duration-300",
          mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0",
          sidebarOpen ? "w-64" : "md:w-16",
        ].join(" ")}
      >
        {/* Brand */}
        <div className="flex h-16 items-center gap-3 border-b border-[color-mix(in_oklab,var(--border)_60%,transparent)] px-4">
          <div className="grid size-9 shrink-0 place-items-center rounded-md bg-[var(--primary)] text-white cursor-pointer">
            <ShieldCheck className="size-5" />
          </div>
          {sidebarOpen && (
            <div className="min-w-0">
              <p className="truncate font-display text-base font-bold uppercase tracking-tight text-[var(--foreground)]">
                Chainsleuth
              </p>
              <p className="font-mono text-[10px] text-[var(--muted-foreground)]">Fraud Ops Platform</p>
            </div>
          )}
          <button
            className="ml-auto hidden size-8 items-center justify-center rounded-md hover:bg-[var(--muted)] transition-colors md:inline-flex cursor-pointer"
            onClick={() => setSidebarOpen((v) => !v)}
            aria-label={sidebarOpen ? "Collapse navigation" : "Expand navigation"}
          >
            <ChevronLeft
              className={`size-4 transition-transform text-[var(--muted-foreground)] ${!sidebarOpen ? "rotate-180" : ""}`}
            />
          </button>
          <button
            className="ml-auto size-8 inline-flex items-center justify-center rounded-md hover:bg-[var(--muted)] md:hidden cursor-pointer"
            onClick={() => setMobileOpen(false)}
            aria-label="Close navigation"
          >
            <X className="size-4 text-[var(--muted-foreground)]" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {sidebarOpen && (
            <p className="px-3 pb-2 text-[10px] font-bold uppercase text-[var(--muted-foreground)] tracking-wider">
              Forensic Command
            </p>
          )}
          {navItems.map(({ label, href, icon: Icon }) => {
            const active = pathname === href;
            return (
              <Link
                key={href + label}
                href={href}
                title={!sidebarOpen ? label : undefined}
                className={[
                  "nav-fill group relative flex w-full h-10 items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors",
                  active
                    ? "border-l-2 border-[var(--primary)] bg-[color-mix(in_oklab,var(--primary)_5%,transparent)] font-semibold text-[var(--primary)]"
                    : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]",
                  !sidebarOpen ? "justify-center px-0" : "",
                ].join(" ")}
              >
                <Icon className="nav-reveal-icon size-4 shrink-0" />
                {sidebarOpen && <span>{label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Role Switcher Footer */}
        <div className="relative border-t border-[color-mix(in_oklab,var(--border)_60%,transparent)] bg-white/50 p-3">
          {roleMenuOpen && (
            <button
              aria-label="Close role menu"
              className="fixed inset-0 z-40 cursor-default"
              onClick={() => setRoleMenuOpen(false)}
            />
          )}
          <div className="flex items-center gap-2">
            <button
              className="size-8 shrink-0 inline-flex items-center justify-center rounded-md hover:bg-[var(--muted)] transition-colors cursor-pointer"
              onClick={() => setRoleMenuOpen((v) => !v)}
              aria-label="Switch operational role"
            >
              <Info className={`size-4 transition-colors ${roleMenuOpen ? "text-[var(--primary)]" : "text-[var(--muted-foreground)]"}`} />
            </button>
            {sidebarOpen && (
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold text-[var(--foreground)]">{currentRoleLabel}</p>
                <p className="truncate text-[10px] text-[var(--muted-foreground)]">Click to switch role</p>
              </div>
            )}
          </div>

          {roleMenuOpen && (
            <div
              className="glass-panel animate-select-pop absolute bottom-full left-3 z-50 mb-2 w-60 p-2 shadow-xl"
              style={{ backgroundColor: "color-mix(in oklab, white 96%, transparent)" }}
            >
              {userEmail && (
                <div className="border-b border-black/10 px-3 py-1.5 mb-1.5">
                  <p className="text-[10px] font-bold uppercase text-[var(--muted-foreground)]">Authenticated Officer</p>
                  <p className="font-mono text-xs font-semibold text-[var(--foreground)] truncate">{userEmail}</p>
                </div>
              )}
              <p className="px-3 pb-1 pt-1 text-[10px] font-bold uppercase text-[var(--muted-foreground)]">
                Operational role
              </p>
              <div className="space-y-0.5">
                {roles.map(({ value, label }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => { setCurrentRole(value); setRoleMenuOpen(false); }}
                    className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs font-medium text-[var(--muted-foreground)] transition-colors hover:bg-[color-mix(in_oklab,var(--primary)_10%,transparent)] hover:text-[var(--foreground)] cursor-pointer"
                  >
                    <UserRoundCog className="size-4 shrink-0" />
                    <span className={`truncate ${currentRole === value ? "font-semibold text-[var(--primary)]" : ""}`}>
                      {label}
                    </span>
                    {currentRole === value && <span className="ml-auto size-1.5 shrink-0 rounded-full bg-[var(--primary)]" />}
                  </button>
                ))}
              </div>

              <div className="pt-1.5 mt-1.5 border-t border-black/10">
                <button
                  type="button"
                  onClick={async () => {
                    await signOutUser();
                    setUserEmail(null);
                    setBadgeNumber(null);
                    setRoleMenuOpen(false);
                    router.push("/login");
                  }}
                  className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs font-semibold text-rose-600 transition-colors hover:bg-rose-50 cursor-pointer"
                >
                  <LogOut className="size-4 shrink-0 text-rose-500" />
                  <span>Sign Out Session</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* Main content */}
      <div className={`flex min-w-0 flex-1 flex-col transition-[margin] duration-300 ${sidebarOpen ? "md:ml-64" : "md:ml-16"}`}>
        <section className="relative min-h-screen overflow-hidden p-5 sm:p-8 lg:p-10">
          {/* Animated wave background */}
          <div aria-hidden className="absolute -inset-[10%] animate-bg-drift pointer-events-none">
            <svg className="h-full w-full" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice" role="presentation">
              <defs>
                <linearGradient id="wave-a" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#FFFFFF" />
                  <stop offset="100%" stopColor="#E2EBDD" />
                </linearGradient>
                <linearGradient id="wave-b" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#F5F8F3" />
                  <stop offset="100%" stopColor="#D9E5D0" />
                </linearGradient>
              </defs>
              {waveLayers.map((layer, i) => (
                <path
                  key={i}
                  d={ridgePath(layer.y, layer.amp, layer.phase)}
                  fill={i % 2 ? "url(#wave-a)" : "url(#wave-b)"}
                  stroke="#FFFFFF"
                  strokeOpacity={0.85}
                  strokeWidth={2}
                />
              ))}
            </svg>
          </div>

          {/* Mobile menu toggle */}
          <div className="relative z-10 mb-4 md:hidden">
            <button
              className="inline-flex items-center justify-center size-9 rounded-md hover:bg-white/60 transition-colors cursor-pointer"
              onClick={() => setMobileOpen(true)}
              aria-label="Open navigation"
            >
              <Menu className="size-5 text-[var(--foreground)]" />
            </button>
          </div>

          {/* Page content */}
          <div className="relative z-10">{children}</div>
        </section>
      </div>
    </div>
  );
}
