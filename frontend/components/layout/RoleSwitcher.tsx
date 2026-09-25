"use client";

import React, { useSyncExternalStore } from "react";
import { useAppStore } from "@/lib/store";
import { UserRole } from "@/lib/types";
import { Shield, UserCheck, Building2 } from "lucide-react";

const emptySubscribe = () => () => {};

interface RoleSwitcherProps {
  orientation?: "horizontal" | "vertical";
}

export function RoleSwitcher({ orientation = "vertical" }: RoleSwitcherProps) {
  const { currentRole, setCurrentRole } = useAppStore();

  const isClient = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );

  const isVertical = orientation === "vertical";

  if (!isClient) {
    return (
      <div
        className={`${
          isVertical ? "flex flex-col h-24 w-full" : "flex items-center h-7 w-44"
        } gap-1 bg-slate-900 border border-slate-800 p-1 rounded font-mono text-[11px] animate-pulse`}
      />
    );
  }

  const rolesConfig: {
    id: UserRole;
    label: string;
    fullLabel: string;
    icon: React.ElementType;
    activeStyle: string;
  }[] = [
    {
      id: "investigating_officer",
      label: "IO",
      fullLabel: "Investigating Officer",
      icon: UserCheck,
      activeStyle: "bg-slate-800 text-teal-400 font-bold border border-teal-500/30",
    },
    {
      id: "supervisory_officer",
      label: "Supervisor",
      fullLabel: "Supervisory Officer",
      icon: Shield,
      activeStyle: "bg-slate-800 text-amber-400 font-bold border border-amber-500/30",
    },
    {
      id: "vasp_nodal_officer",
      label: "VASP Nodal",
      fullLabel: "VASP Nodal Officer",
      icon: Building2,
      activeStyle: "bg-slate-800 text-teal-300 font-bold border border-teal-500/30",
    },
  ];

  return (
    <div
      className={`flex ${
        isVertical ? "flex-col w-full gap-1.5" : "flex-row items-center gap-1"
      } bg-slate-900 border border-slate-800 p-1.5 rounded-lg font-mono text-[11px] select-none`}
    >
      {rolesConfig.map((r) => {
        const Icon = r.icon;
        const isActive = currentRole === r.id;

        return (
          <button
            key={r.id}
            type="button"
            onClick={() => setCurrentRole(r.id)}
            className={`flex items-center gap-2 px-2.5 py-1.5 rounded transition-all cursor-pointer ${
              isVertical ? "w-full justify-start text-left" : ""
            } ${
              isActive
                ? `${r.activeStyle} shadow-sm`
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 border border-transparent"
            }`}
            title={r.fullLabel}
          >
            <Icon className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">{r.label}</span>
          </button>
        );
      })}
    </div>
  );
}
