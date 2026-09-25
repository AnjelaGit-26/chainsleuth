"use client";

import React, { useSyncExternalStore } from "react";
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
  ShieldAlert,
  ShieldCheck,
  UserCheck,
  Building2,
  Database,
  User,
} from "lucide-react";

const emptySubscribe = () => () => {};

export function Sidebar() {
  const pathname = usePathname();
  const { currentRole, user } = useAppStore();

  const isClient = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );

  const isSupervisor = isClient && currentRole === "supervisory_officer";

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
      href: "/case/test-verification-456/notice",
      icon: FileText,
    },
    {
      label: "NCRP Ingestion",
      href: "/ncrp",
      icon: Database,
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
      code: "IO (LEO)",
      icon: UserCheck,
      color: "text-teal-400 bg-teal-950/60 border-teal-800",
    },
    supervisory_officer: {
      name: "Supervisory Officer",
      code: "SUPERVISOR",
      icon: ShieldCheck,
      color: "text-amber-400 bg-amber-950/60 border-amber-800",
    },
    vasp_nodal_officer: {
      name: "VASP Nodal Officer",
      code: "VASP NODAL",
      icon: Building2,
      color: "text-teal-300 bg-slate-900 border-slate-700",
    },
  };

  const currentRoleInfo =
    roleLabelMap[currentRole] || roleLabelMap.investigating_officer;
  const RoleIcon = currentRoleInfo.icon;

  return (
    <aside className="w-56 shrink-0 bg-slate-950 border-r border-slate-800 flex flex-col justify-between font-mono text-xs select-none">
      <div className="flex flex-col">
        {/* Header Logo */}
        <div className="h-11 px-3 border-b border-slate-800 flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-slate-900 border border-slate-700 flex items-center justify-center text-teal-400 shrink-0">
            <ShieldAlert className="w-3.5 h-3.5" />
          </div>
          <div className="overflow-hidden">
            <div className="font-bold text-slate-100 text-xs tracking-wider uppercase font-sans truncate">
              ChainSleuth
            </div>
            <div className="text-[9px] text-slate-500 uppercase tracking-widest truncate">
              Fraud Ops Platform
            </div>
          </div>
        </div>

        {/* Authenticated Officer Profile */}
        {user && (
          <div className="p-2.5 border-b border-slate-800 bg-slate-900/50 flex items-center gap-2">
            {user.picture ? (
              <img
                src={user.picture}
                alt={user.name || "Officer"}
                className="w-6 h-6 rounded-full object-cover border border-slate-700 shrink-0"
              />
            ) : (
              <div className="w-6 h-6 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-teal-400 shrink-0">
                <User className="w-3.5 h-3.5" />
              </div>
            )}
            <div className="overflow-hidden">
              <div className="font-bold text-slate-100 text-[11px] truncate font-sans">
                {user.name || user.email || "Authenticated Officer"}
              </div>
              <div className="text-[9px] text-slate-400 truncate">
                {user.department || user.email || "Authorized Law Enforcement"}
              </div>
            </div>
          </div>
        )}

        {/* Role Indicator Banner */}
        <div className="p-2.5 border-b border-slate-800 bg-slate-900/30">
          <div className="text-[9px] text-slate-500 mb-1 uppercase font-semibold">
            Active Access Role
          </div>
          <div
            className={`flex items-center gap-1.5 px-2 py-1 rounded border text-[11px] font-semibold ${currentRoleInfo.color}`}
          >
            <RoleIcon className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">
              {isClient ? currentRoleInfo.name : "Loading..."}
            </span>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="p-2 space-y-0.5">
          {navItems.map((item, idx) => {
            const Icon = item.icon;
            const active = pathname === item.href;
            return (
              <Link
                key={`${item.href}-${idx}`}
                href={item.href}
                className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded transition-colors font-sans text-xs ${
                  active
                    ? "bg-slate-900 text-teal-400 font-semibold border border-slate-800"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-900/50"
                }`}
              >
                <Icon
                  className={`w-3.5 h-3.5 shrink-0 ${
                    active ? "text-teal-400" : "text-slate-500"
                  }`}
                />
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Role Switcher in Sidebar Footer */}
      <div className="p-2.5 border-t border-slate-800 space-y-1.5">
        <div className="text-[9px] text-slate-500 uppercase font-semibold">
          Switch Operational Role
        </div>
        <RoleSwitcher orientation="vertical" />
      </div>
    </aside>
  );
}
