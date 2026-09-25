"use client";

import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { FIRCreate, FIRResponse, Chain } from "@/lib/types";
import { createFir, downloadFir } from "@/lib/api";
import {
  FileText,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Download,
  X,
  FileCheck,
} from "lucide-react";

interface FirFormInputs {
  case_id: string;
  complainant_name: string;
  complainant_designation?: string;
  incident_description: string;
  suspect_addresses_raw: string;
  estimated_loss_inr?: string;
  date_of_incident: string;
}

interface FirGenerationFormProps {
  initialCaseId?: string;
  initialSuspectAddress?: string;
  chain?: Chain;
  onSuccess?: (response: FIRResponse) => void;
  onCancel?: () => void;
}

export function FirGenerationForm({
  initialCaseId = "",
  initialSuspectAddress = "",
  chain = "tron",
  onSuccess,
  onCancel,
}: FirGenerationFormProps) {
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [firResponse, setFirResponse] = useState<FIRResponse | null>(null);

  const defaultDate = new Date().toISOString().split("T")[0];

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FirFormInputs>({
    defaultValues: {
      case_id: initialCaseId,
      complainant_name: "",
      complainant_designation: "",
      incident_description: "",
      suspect_addresses_raw: initialSuspectAddress,
      estimated_loss_inr: "",
      date_of_incident: defaultDate,
    },
  });

  const validateChainAddress = (address: string, chainType: Chain): boolean => {
    const trimmed = address.trim();
    if (!trimmed) return false;
    switch (chainType) {
      case "tron":
        return trimmed.startsWith("T") && trimmed.length === 34;
      case "ethereum":
        return trimmed.startsWith("0x") && trimmed.length === 42;
      case "solana":
        return trimmed.length >= 32 && trimmed.length <= 44;
      case "bitcoin":
        return (
          (trimmed.startsWith("1") || trimmed.startsWith("3") || trimmed.startsWith("bc1")) &&
          trimmed.length >= 26 &&
          trimmed.length <= 62
        );
      default:
        return trimmed.length > 5;
    }
  };

  const onSubmit = async (data: FirFormInputs) => {
    setSubmitError(null);

    // Parse suspect addresses
    const addresses = data.suspect_addresses_raw
      .split(/[\n,]+/)
      .map((a) => a.trim())
      .filter((a) => a.length > 0);

    if (addresses.length === 0) {
      setSubmitError("At least one valid suspect wallet address is required.");
      return;
    }

    // Validate addresses according to chain where applicable
    const invalidAddresses = addresses.filter((addr) => !validateChainAddress(addr, chain));
    if (invalidAddresses.length > 0) {
      setSubmitError(
        `Invalid address format for ${chain.toUpperCase()}: ${invalidAddresses.join(", ")}`
      );
      return;
    }

    // Parse estimated loss if provided
    let lossNum: number | undefined = undefined;
    if (data.estimated_loss_inr && data.estimated_loss_inr.trim() !== "") {
      lossNum = Number(data.estimated_loss_inr);
      if (isNaN(lossNum) || lossNum < 0) {
        setSubmitError("Estimated loss must be a valid positive number.");
        return;
      }
    }

    const payload: FIRCreate = {
      case_id: data.case_id.trim(),
      complainant_name: data.complainant_name.trim(),
      complainant_designation: data.complainant_designation?.trim() || undefined,
      incident_description: data.incident_description.trim(),
      suspect_addresses: addresses,
      estimated_loss_inr: lossNum,
      date_of_incident: data.date_of_incident,
    };

    setSubmitting(true);
    try {
      const response = await createFir(payload);
      setFirResponse(response);
      onSuccess?.(response);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Connection error: Unable to reach backend server.";
      setSubmitError(message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDownloadPdf = () => {
    if (firResponse) {
      downloadFir(firResponse.fir_id, firResponse.pdf_url || firResponse.download_url);
    }
  };

  return (
    <div className="w-full max-w-2xl bg-slate-950 border border-slate-800 rounded-lg p-6 font-mono text-xs text-slate-300 space-y-5 shadow-2xl select-none relative overflow-hidden">
      {/* Top Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-3.5">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded bg-teal-950 border border-teal-600 text-teal-300">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <div className="text-sm font-bold font-sans text-slate-100 uppercase tracking-wider">
              Cybercrime First Information Report (FIR)
            </div>
            <div className="text-[11px] text-slate-500 font-mono">
              Official Police Registration & Digital Evidence Docket
            </div>
          </div>
        </div>

        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="text-slate-500 hover:text-slate-200 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* SUCCESS VIEW AFTER POST SUCCEEDS */}
      {firResponse ? (
        <div className="space-y-4 py-2">
          <div className="p-4 bg-teal-950/80 border border-teal-600 rounded space-y-3 shadow-lg">
            <div className="flex items-center gap-2 text-teal-300 font-bold font-sans text-sm uppercase tracking-wider">
              <CheckCircle2 className="w-5 h-5 text-teal-400 shrink-0" />
              <span>Cybercrime FIR Successfully Generated</span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs pt-2 border-t border-teal-800/80">
              <div>
                <span className="text-slate-400 text-[10px] block">FIR ID</span>
                <span className="font-bold text-slate-100 font-mono">{firResponse.fir_id}</span>
              </div>
              <div>
                <span className="text-slate-400 text-[10px] block">FIR / Complaint Reference</span>
                <span className="font-bold text-teal-300 font-mono">
                  {firResponse.fir_number || firResponse.complaint_id || firResponse.fir_id}
                </span>
              </div>
              <div>
                <span className="text-slate-400 text-[10px] block">Case Reference ID</span>
                <span className="font-bold text-slate-200 font-mono">{firResponse.case_id}</span>
              </div>
              <div>
                <span className="text-slate-400 text-[10px] block">Generated Timestamp</span>
                <span className="text-slate-300 font-mono">
                  {firResponse.generated_at || firResponse.created_at
                    ? new Date(
                        firResponse.generated_at || firResponse.created_at || ""
                      ).toLocaleString()
                    : new Date().toLocaleString()}
                </span>
              </div>
            </div>

            {firResponse.sha256_hash && (
              <div className="pt-2 border-t border-teal-800/80">
                <span className="text-slate-400 text-[10px] block">SHA-256 Evidence Hash</span>
                <span className="text-[10px] text-teal-200 font-mono break-all">
                  {firResponse.sha256_hash}
                </span>
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={handleDownloadPdf}
              className="flex items-center gap-2 px-5 py-2.5 bg-teal-500 hover:bg-teal-400 text-slate-950 font-sans font-bold text-xs rounded transition-colors shadow-lg cursor-pointer"
            >
              <Download className="w-4 h-4" />
              Download Official FIR PDF
            </button>
          </div>
        </div>
      ) : (
        /* FORM INPUT VIEW */
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {submitError && (
            <div className="p-3 bg-red-950/90 border border-red-700/80 rounded text-red-200 text-xs font-mono flex items-start gap-2 shadow">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <span>{submitError}</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            {/* Case ID */}
            <div className="space-y-1">
              <label className="text-[10px] text-slate-400 uppercase font-semibold block">
                Case ID <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                {...register("case_id", { required: "Case ID is required" })}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded text-slate-100 font-mono text-xs focus:outline-none focus:border-teal-500"
              />
              {errors.case_id && (
                <span className="text-[10px] text-rose-400 block">{errors.case_id.message}</span>
              )}
            </div>

            {/* Date of Incident */}
            <div className="space-y-1">
              <label className="text-[10px] text-slate-400 uppercase font-semibold block">
                Date of Incident <span className="text-rose-400">*</span>
              </label>
              <input
                type="date"
                {...register("date_of_incident", {
                  required: "Incident date is required",
                  validate: (val) => !isNaN(Date.parse(val)) || "Invalid date format",
                })}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded text-slate-100 font-mono text-xs focus:outline-none focus:border-teal-500"
              />
              {errors.date_of_incident && (
                <span className="text-[10px] text-rose-400 block font-mono">
                  {errors.date_of_incident.message}
                </span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Complainant Name */}
            <div className="space-y-1">
              <label className="text-[10px] text-slate-400 uppercase font-semibold block">
                Complainant / Officer Name <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                placeholder="e.g. Insp. Rajesh Kumar"
                {...register("complainant_name", { required: "Complainant name is required" })}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded text-slate-100 font-mono text-xs focus:outline-none focus:border-teal-500"
              />
              {errors.complainant_name && (
                <span className="text-[10px] text-rose-400 block">
                  {errors.complainant_name.message}
                </span>
              )}
            </div>

            {/* Complainant Designation */}
            <div className="space-y-1">
              <label className="text-[10px] text-slate-400 uppercase font-semibold block">
                Designation / Police Unit (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. Cyber Crime Cell, Special Branch"
                {...register("complainant_designation")}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded text-slate-100 font-mono text-xs focus:outline-none focus:border-teal-500"
              />
            </div>
          </div>

          {/* Suspect Addresses */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-[10px] text-slate-400 uppercase font-semibold block">
                Suspect Wallet Addresses ({chain.toUpperCase()}) <span className="text-rose-400">*</span>
              </label>
              <span className="text-[9px] text-slate-500">Separate multiple with commas or newlines</span>
            </div>
            <textarea
              rows={2}
              placeholder={`e.g. ${
                chain === "tron"
                  ? "T..."
                  : chain === "ethereum"
                  ? "0x..."
                  : chain === "bitcoin"
                  ? "1..., 3..., bc1..."
                  : "Base58"
              }`}
              {...register("suspect_addresses_raw", {
                required: "At least one suspect wallet address is required",
              })}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded text-slate-100 font-mono text-xs focus:outline-none focus:border-teal-500"
            />
            {errors.suspect_addresses_raw && (
              <span className="text-[10px] text-rose-400 block">
                {errors.suspect_addresses_raw.message}
              </span>
            )}
          </div>

          {/* Estimated Loss INR */}
          <div className="space-y-1">
            <label className="text-[10px] text-slate-400 uppercase font-semibold block">
              Estimated Financial Loss (INR) (Optional)
            </label>
            <input
              type="number"
              step="any"
              placeholder="e.g. 485000"
              {...register("estimated_loss_inr", {
                validate: (val) =>
                  !val || !isNaN(Number(val)) || "Estimated loss must be numeric",
              })}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded text-slate-100 font-mono text-xs focus:outline-none focus:border-teal-500"
            />
            {errors.estimated_loss_inr && (
              <span className="text-[10px] text-rose-400 block">
                {errors.estimated_loss_inr.message}
              </span>
            )}
          </div>

          {/* Incident Description */}
          <div className="space-y-1">
            <label className="text-[10px] text-slate-400 uppercase font-semibold block">
              Incident Summary & Modus Operandi <span className="text-rose-400">*</span>
            </label>
            <textarea
              rows={4}
              placeholder="Detailed description of cyber fraud, Telegram investment scam, phishing URL, or illicit fund diversion trail..."
              {...register("incident_description", {
                required: "Incident description is required",
                minLength: {
                  value: 10,
                  message: "Description must be at least 10 characters long",
                },
              })}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded text-slate-100 font-sans text-xs focus:outline-none focus:border-teal-500 leading-normal"
            />
            {errors.incident_description && (
              <span className="text-[10px] text-rose-400 block">
                {errors.incident_description.message}
              </span>
            )}
          </div>

          {/* Form Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                disabled={submitting}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-slate-300 font-sans font-semibold text-xs rounded transition-colors border border-slate-700 cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="flex items-center gap-2 px-5 py-2.5 bg-teal-500 hover:bg-teal-400 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 font-sans font-bold text-xs rounded transition-colors shadow-lg cursor-pointer disabled:cursor-not-allowed"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-teal-400" />
                  <span className="text-slate-200">Generating Cybercrime FIR...</span>
                </>
              ) : (
                <>
                  <FileCheck className="w-4 h-4 text-slate-950" />
                  <span>Generate Cybercrime FIR</span>
                </>
              )}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
