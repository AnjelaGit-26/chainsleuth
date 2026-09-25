"use client";

import React, { useEffect } from "react";
import { useAppStore } from "@/lib/store";
import { UserRole } from "@/lib/types";
import { Shield, UserCheck, Building2 } from "lucide-react";

export function RoleSwitcher() {
  const { currentRole, setCurrentRole } = useAppStore();

  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("chainsleuth_role") as UserRole | null;
      if (saved) setCurrentRole(saved);
    }
  }, [setCurrentRole]);

  return (
    <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 p-1 rounded font-mono text-[11px]">
      <button
        type="button"
        onClick={() => setCurrentRole("investigating_officer")}
        className={`flex items-center gap-1.5 px-2 py-1 rounded transition-colors ${
          currentRole === "investigating_officer"
            ? "bg-slate-800 text-teal-400 font-bold border border-slate-700"
            : "text-slate-400 hover:text-slate-200"
        }`}
        title="Investigating Officer (IO)"
      >
        <UserCheck className="w-3.5 h-3.5" />
        <span>IO</span>
      </button>

      <button
        type="button"
        onClick={() => setCurrentRole("supervisory_officer")}
        className={`flex items-center gap-1.5 px-2 py-1 rounded transition-colors ${
          currentRole === "supervisory_officer"
            ? "bg-slate-800 text-amber-400 font-bold border border-slate-700"
            : "text-slate-400 hover:text-slate-200"
        }`}
        title="Supervisory Officer"
      >
        <Shield className="w-3.5 h-3.5" />
        <span>Supervisor</span>
      </button>

      <button
        type="button"
        onClick={() => setCurrentRole("vasp_nodal_officer")}
        className={`flex items-center gap-1.5 px-2 py-1 rounded transition-colors ${
          currentRole === "vasp_nodal_officer"
            ? "bg-slate-800 text-teal-300 font-bold border border-slate-700"
            : "text-slate-400 hover:text-slate-200"
        }`}
        title="VASP Nodal Officer"
      >
        <Building2 className="w-3.5 h-3.5" />
        <span>VASP Nodal</span>
      </button>
    </div>
  );
}
