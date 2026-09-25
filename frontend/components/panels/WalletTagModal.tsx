"use client";

import React, { useState } from "react";
import { CustomTagEntityType, CustomWalletTagPayload } from "@/lib/types";
import { tagCustomWallet } from "@/lib/api";
import { Tag, X, Loader2, AlertCircle, CheckCircle2, Shield } from "lucide-react";

interface WalletTagModalProps {
  isOpen: boolean;
  onClose: () => void;
  address: string;
  chain?: string;
  onTagSuccess?: () => void;
}

export function WalletTagModal({
  isOpen,
  onClose,
  address,
  chain = "tron",
  onTagSuccess,
}: WalletTagModalProps) {
  const [entityName, setEntityName] = useState("");
  const [entityType, setEntityType] = useState<CustomTagEntityType | "">("");
  const [confidence, setConfidence] = useState<string>("");
  const [source, setSource] = useState("");
  const [caseReference, setCaseReference] = useState("");
  const [notes, setNotes] = useState("");
  const [tagsInput, setTagsInput] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!entityName.trim()) {
      setErrorMsg("Please enter an Entity Name.");
      return;
    }

    if (!entityType) {
      setErrorMsg("Please select an Entity Type.");
      return;
    }

    let parsedConfidence: number | undefined = undefined;
    if (confidence.trim() !== "") {
      const num = parseFloat(confidence);
      if (isNaN(num) || num < 0 || num > 1) {
        setErrorMsg("Confidence must be a numeric value between 0.0 and 1.0.");
        return;
      }
      parsedConfidence = num;
    }

    const tagsArray = tagsInput
      ? tagsInput
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean)
      : undefined;

    const payload: CustomWalletTagPayload = {
      address,
      chain,
      entity_name: entityName.trim(),
      entity_type: entityType,
      confidence: parsedConfidence,
      source: source.trim() || undefined,
      case_reference: caseReference.trim() || undefined,
      notes: notes.trim() || undefined,
      tags: tagsArray,
    };

    setIsSubmitting(true);
    try {
      await tagCustomWallet(payload);
      setSuccessMsg("Wallet tag saved successfully.");
      if (onTagSuccess) onTagSuccess();
      setTimeout(() => {
        onClose();
      }, 1200);
    } catch (err: unknown) {
      console.error("[WalletTagModal] Error tagging wallet:", err);
      const msg = err instanceof Error ? err.message : "Unable to save wallet tag.";
      setErrorMsg(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 font-mono text-xs select-none">
      <div className="w-full max-w-lg bg-slate-950 border border-slate-800 rounded shadow-2xl space-y-4 p-5 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2 text-slate-100 font-sans font-bold text-sm tracking-wider uppercase">
            <Tag className="w-4 h-4 text-teal-400" />
            <span>Annotate Wallet Address</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 p-1 rounded hover:bg-slate-900"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Error / Success Banners */}
        {errorMsg && (
          <div className="p-3 bg-red-950/90 border border-red-700 rounded text-red-200 font-mono text-xs space-y-1">
            <div className="flex items-center gap-1.5 font-bold font-sans text-red-400">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>TAG SAVING ERROR</span>
            </div>
            <p className="text-[11px] text-red-300 leading-normal">{errorMsg}</p>
          </div>
        )}

        {successMsg && (
          <div className="p-3 bg-emerald-950/90 border border-emerald-700 rounded text-emerald-200 font-mono text-xs space-y-1">
            <div className="flex items-center gap-1.5 font-bold font-sans text-emerald-400">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>SAVED</span>
            </div>
            <p className="text-[11px] text-emerald-300">{successMsg}</p>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-3 font-sans">
          {/* Address (Read Only) */}
          <div className="space-y-1 font-mono">
            <label className="text-[11px] text-slate-400 uppercase font-semibold">Wallet Address (Read-Only)</label>
            <input
              type="text"
              readOnly
              value={address}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded text-slate-300 text-xs font-mono select-all"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Chain */}
            <div className="space-y-1 font-mono">
              <label className="text-[11px] text-slate-400 uppercase font-semibold">Blockchain Network</label>
              <input
                type="text"
                readOnly
                value={chain.toUpperCase()}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded text-slate-300 text-xs font-mono uppercase"
              />
            </div>

            {/* Entity Type */}
            <div className="space-y-1 font-mono">
              <label className="text-[11px] text-slate-300 uppercase font-semibold">Entity Type *</label>
              <select
                required
                value={entityType}
                onChange={(e) => setEntityType(e.target.value as CustomTagEntityType)}
                className="w-full px-3 py-2 bg-slate-900/90 border border-slate-800 rounded text-slate-100 text-xs font-mono focus:outline-none focus:border-teal-500 cursor-pointer"
              >
                <option value="">Select type</option>
                <option value="exchange">Exchange</option>
                <option value="mule">Mule Wallet</option>
                <option value="scam">Scam / Fraud</option>
                <option value="mixer">Mixer / Tumbler</option>
                <option value="darknet">Darknet Market</option>
                <option value="gambling">Illegal Gambling</option>
                <option value="seized">Seized Funds</option>
              </select>
            </div>
          </div>

          {/* Entity Name */}
          <div className="space-y-1 font-mono">
            <label className="text-[11px] text-slate-300 uppercase font-semibold">Entity Name *</label>
            <input
              type="text"
              required
              value={entityName}
              onChange={(e) => setEntityName(e.target.value)}
              placeholder="e.g. Suspect Burner Cluster B"
              className="w-full px-3 py-2 bg-slate-900/90 border border-slate-800 rounded text-slate-100 text-xs font-mono placeholder-slate-600 focus:outline-none focus:border-teal-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3 font-mono">
            {/* Confidence Score */}
            <div className="space-y-1">
              <label className="text-[11px] text-slate-400 uppercase font-semibold">Confidence (0.0 - 1.0)</label>
              <input
                type="number"
                step="0.1"
                min="0"
                max="1"
                value={confidence}
                onChange={(e) => setConfidence(e.target.value)}
                placeholder="e.g. 0.85"
                className="w-full px-3 py-2 bg-slate-900/90 border border-slate-800 rounded text-slate-100 text-xs font-mono placeholder-slate-600 focus:outline-none focus:border-teal-500"
              />
            </div>

            {/* Case Reference */}
            <div className="space-y-1">
              <label className="text-[11px] text-slate-400 uppercase font-semibold">Case Reference</label>
              <input
                type="text"
                value={caseReference}
                onChange={(e) => setCaseReference(e.target.value)}
                placeholder="e.g. NCRP-2026-0923"
                className="w-full px-3 py-2 bg-slate-900/90 border border-slate-800 rounded text-slate-100 text-xs font-mono placeholder-slate-600 focus:outline-none focus:border-teal-500"
              />
            </div>
          </div>

          {/* Source */}
          <div className="space-y-1 font-mono">
            <label className="text-[11px] text-slate-400 uppercase font-semibold">Source / Intelligence Provider</label>
            <input
              type="text"
              value={source}
              onChange={(e) => setSource(e.target.value)}
              placeholder="e.g. Cyber Cell IO Analysis"
              className="w-full px-3 py-2 bg-slate-900/90 border border-slate-800 rounded text-slate-100 text-xs font-mono placeholder-slate-600 focus:outline-none focus:border-teal-500"
            />
          </div>

          {/* Tags */}
          <div className="space-y-1 font-mono">
            <label className="text-[11px] text-slate-400 uppercase font-semibold">Tags (Comma-separated)</label>
            <input
              type="text"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="e.g. telegram_scam, high_risk_peel"
              className="w-full px-3 py-2 bg-slate-900/90 border border-slate-800 rounded text-slate-100 text-xs font-mono placeholder-slate-600 focus:outline-none focus:border-teal-500"
            />
          </div>

          {/* Notes */}
          <div className="space-y-1 font-mono">
            <label className="text-[11px] text-slate-400 uppercase font-semibold">Investigator Notes</label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Additional case analysis notes..."
              className="w-full px-3 py-2 bg-slate-900/90 border border-slate-800 rounded text-slate-100 text-xs font-mono placeholder-slate-600 focus:outline-none focus:border-teal-500 resize-none"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800 font-mono">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-2 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded font-semibold border border-slate-800 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold rounded flex items-center gap-1.5 cursor-pointer border border-teal-400 disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Shield className="w-3.5 h-3.5" />
                  <span>Save Annotation</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
