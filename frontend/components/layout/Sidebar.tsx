"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAppStore } from "@/lib/store";
import { RoleSwitcher } from "./RoleSwitcher";
import {
  LayoutDashboard,
  PlusCircle,
  FolderOpen,
  FileText,
  Activity,
  ShieldCheck,
  UserCheck,
  Building2,
} from "lucide-react";

export function Sidebar() {
  const pathname = usePathname();
  const { currentRole } = useAppStore();

  const isSupervisor = currentRole === "supervisory_officer";

  const navItems = [
    {
      label: "Dashboard",
      href: "/dashboard",
      icon: LayoutDashboard,
    },
    {
      label: "New Investigation",
      href: "/trace/new",
      icon: PlusCircle,
    },
    {
      label: "Investigations",
      href: "/dashboard",
      icon: FolderOpen,
    },
    {
      label: "Legal Notices",
      href: "/case/CS-2026-8891/notice",
      icon: FileText,
    },
  ];

  if (isSupervisor) {
    navItems.push({
      label: "Audit Log",
      href: "/dashboard/audit",
      icon: Activity,
    });
  }

  const roleLabelMap = {
    investigating_officer: {
      name: "Investigating Officer",
      code: "ROLE_IO_LEO",
      icon: UserCheck,
      color: "text-[var(--primary)] bg-[color-mix(in_oklab,var(--primary)_10%,transparent)] border-[color-mix(in_oklab,var(--primary)_30%,transparent)]",
    },
    supervisory_officer: {
      name: "Supervisory Officer",
      code: "SUPERVISOR",
      icon: ShieldCheck,
      color: "text-[var(--amber)] bg-[color-mix(in_oklab,var(--amber)_10%,transparent)] border-[color-mix(in_oklab,var(--amber)_30%,transparent)]",
    },
    vasp_nodal_officer: {
      name: "VASP Nodal Officer",
      code: "VASP NODAL",
      icon: Building2,
      color: "text-blue-600 bg-blue-50 border-blue-200",
    },
  };

  const currentRoleInfo = roleLabelMap[currentRole] || roleLabelMap.investigating_officer;
  const RoleIcon = currentRoleInfo.icon;

  return (
    <aside className="w-64 shrink-0 bg-white/80 backdrop-blur-md border-r border-[color-mix(in_oklab,var(--border)_60%,transparent)] flex flex-col justify-between font-sans text-xs select-none">
      <div className="flex flex-col">
        {/* Header Logo */}
        <div className="h-16 px-4 border-b border-[color-mix(in_oklab,var(--border)_60%,transparent)] flex items-center gap-3">
          <div className="grid size-9 shrink-0 place-items-center rounded-md bg-[var(--primary)] text-white">
            <ShieldCheck className="size-5" />
          </div>
          <div className="overflow-hidden">
            <div className="font-display font-bold text-[var(--foreground)] text-sm tracking-tight uppercase truncate">
              Chainsleuth
            </div>
            <div className="font-mono text-[10px] text-[var(--muted-foreground)] uppercase tracking-wider truncate">
              Fraud Ops Platform
            </div>
          </div>
        </div>

        {/* Role Indicator Banner */}
        <div className="p-3 border-b border-[color-mix(in_oklab,var(--border)_60%,transparent)] bg-white/40">
          <div className="text-[10px] font-bold text-[var(--muted-foreground)] mb-1.5 uppercase tracking-wider">
            Active Access Role
          </div>
          <div
            className={`flex items-center gap-2 px-2.5 py-1.5 rounded-xl border text-xs font-semibold ${currentRoleInfo.color}`}
          >
            <RoleIcon className="size-4 shrink-0" />
            <span className="truncate">{currentRoleInfo.name}</span>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="p-3 space-y-1">
          <p className="px-3 pb-2 text-[10px] font-bold uppercase text-[var(--muted-foreground)] tracking-wider">
            Forensic Command
          </p>
          {navItems.map((item, idx) => {
            const Icon = item.icon;
            const active = pathname === item.href;
            return (
              <Link
                key={`${item.href}-${idx}`}
                href={item.href}
                className={`nav-fill group relative flex w-full h-10 items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors ${
                  active
                    ? "border-l-2 border-[var(--primary)] bg-[color-mix(in_oklab,var(--primary)_5%,transparent)] font-semibold text-[var(--primary)]"
                    : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                }`}
              >
                <Icon className={`nav-reveal-icon size-4 shrink-0 ${active ? "text-[var(--primary)]" : "text-[var(--muted-foreground)]"}`} />
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Role Switcher in Sidebar Footer */}
      <div className="p-3 border-t border-[color-mix(in_oklab,var(--border)_60%,transparent)] bg-white/50 space-y-1.5">
        <div className="text-[10px] font-bold text-[var(--muted-foreground)] uppercase tracking-wider">
          Switch Operational Role
        </div>
        <RoleSwitcher />
      </div>
    </aside>
  );
}
