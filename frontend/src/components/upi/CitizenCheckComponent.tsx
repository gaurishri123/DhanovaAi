"use client";

import React, { useState, useEffect } from "react";
import {
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  Search,
  PhoneCall,
  ExternalLink,
  Info,
  Clock,
  RefreshCw,
  CheckCircle2,
  FileWarning,
} from "lucide-react";
import { checkUpiAccount } from "@/lib/api";
import { RiskScoreResponse } from "@/types/account";
import { getRiskDetails } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

interface Props {
  initialAccountId?: string;
}

export const CitizenCheckComponent: React.FC<Props> = ({ initialAccountId }) => {
  const [searchInput, setSearchInput] = useState(initialAccountId || "");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<RiskScoreResponse | null>(null);
  const [dataSource, setDataSource] = useState<"live" | "mock" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const sampleAccounts = [
    { id: "ACC_00042", label: "ACC_00042 (High Risk Mule)", type: "danger" },
    { id: "ACC_00108", label: "ACC_00108 (Circular Ring)", type: "danger" },
    { id: "ACC_00078", label: "ACC_00078 (Caution Student)", type: "warning" },
    { id: "ACC_00001", label: "ACC_00001 (Safe Salaried)", type: "safe" },
  ];

  const handleSearch = async (targetId: string) => {
    if (!targetId.trim()) return;
    setLoading(true);
    setError(null);

    try {
      const res = await checkUpiAccount(targetId);
      setResult(res.data);
      setDataSource(res.source);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to verify UPI account. Please try again.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (initialAccountId) {
      handleSearch(initialAccountId);
    }
  }, [initialAccountId]);

  const riskDetails = result ? getRiskDetails(result.score) : null;

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-300">
      {/* Header section */}
      <div className="text-center space-y-3">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-950/60 border border-blue-800/40 text-blue-400 text-xs font-semibold">
          <ShieldAlert className="h-4 w-4" />
          <span>Citizen UPI Safety Verification Portal</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
          Verify Before You Pay
        </h1>
        <p className="text-slate-400 max-w-xl mx-auto text-sm leading-relaxed">
          Check any UPI ID or bank account against Dhanova&apos;s real-time AI mule detection engine.
          Protects citizens from phishing, payment fraud, and digital extortion scams.
        </p>
      </div>

      {/* Search Input Box */}
      <Card className="border-blue-900/40 bg-slate-900/80 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-600 via-indigo-500 to-purple-600" />
        <CardContent className="pt-6">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSearch(searchInput);
            }}
            className="flex flex-col sm:flex-row gap-3"
          >
            <div className="relative flex-1">
              <input
                type="text"
                id="upi-account-input"
                placeholder="Enter Account ID (e.g. ACC_00042) or UPI VPA..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="w-full h-12 rounded-xl bg-slate-950 border border-slate-700 px-4 pl-11 text-base text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all shadow-inner"
              />
              <Search className="absolute left-3.5 top-3.5 h-5 w-5 text-slate-500" />
            </div>
            <Button
              id="verify-upi-button"
              type="submit"
              size="lg"
              isLoading={loading}
              className="h-12 px-8 font-semibold rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 shadow-lg shadow-blue-600/30"
            >
              Verify Safety
            </Button>
          </form>

          {/* Quick Clickable Samples */}
          <div className="mt-4 flex flex-wrap items-center gap-2 pt-3 border-t border-slate-800/60">
            <span className="text-xs text-slate-400 font-medium">Try Sample Accounts:</span>
            {sampleAccounts.map((sample) => (
              <button
                key={sample.id}
                type="button"
                onClick={() => {
                  setSearchInput(sample.id);
                  handleSearch(sample.id);
                }}
                className={`text-xs px-2.5 py-1 rounded-lg border font-mono transition-all ${
                  sample.type === "danger"
                    ? "bg-red-950/40 border-red-800/40 text-red-300 hover:bg-red-900/50"
                    : sample.type === "warning"
                    ? "bg-amber-950/40 border-amber-800/40 text-amber-300 hover:bg-amber-900/50"
                    : "bg-emerald-950/40 border-emerald-800/40 text-emerald-300 hover:bg-emerald-900/50"
                }`}
              >
                {sample.label}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Loading State */}
      {loading && (
        <Card className="p-8 text-center border-slate-800 bg-slate-900/50 animate-pulse">
          <div className="flex flex-col items-center justify-center space-y-3">
            <RefreshCw className="h-8 w-8 text-blue-400 animate-spin" />
            <p className="text-sm font-semibold text-slate-200">
              Querying ML Risk Model & Graph Intelligence...
            </p>
            <p className="text-xs text-slate-500">Checking nocturnal burst history and pass-through ratios</p>
          </div>
        </Card>
      )}

      {/* Error State */}
      {error && !loading && (
        <div className="p-4 rounded-xl bg-red-950/40 border border-red-800/50 text-red-200 text-sm flex items-center gap-3">
          <FileWarning className="h-5 w-5 text-red-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Result Presentation */}
      {result && !loading && riskDetails && (
        <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-300">
          <Card
            className={`border ${riskDetails.borderColor} ${riskDetails.bgColor} shadow-2xl relative overflow-hidden`}
          >
            <CardHeader className="pb-2">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs uppercase tracking-wider text-slate-400 font-semibold">
                      Account Under Review
                    </span>
                    {dataSource === "live" ? (
                      <Badge variant="success" size="sm">
                        FastAPI Live Scored
                      </Badge>
                    ) : (
                      <Badge variant="secondary" size="sm">
                        Forensic Simulator
                      </Badge>
                    )}
                  </div>
                  <h2 className="text-2xl font-bold font-mono text-white mt-1">
                    {result.account_id}
                  </h2>
                </div>

                {/* Risk Score Pill */}
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className="text-xs text-slate-400 font-semibold uppercase">Risk Score</div>
                    <div className="text-3xl font-black font-mono" style={{ color: riskDetails.color }}>
                      {result.score}
                      <span className="text-lg font-normal text-slate-500">/100</span>
                    </div>
                  </div>
                  <div
                    className={`h-14 w-14 rounded-2xl flex items-center justify-center border ${riskDetails.borderColor} ${riskDetails.glowClass}`}
                    style={{ backgroundColor: `${riskDetails.color}22` }}
                  >
                    {result.score >= 70 ? (
                      <ShieldAlert className="h-8 w-8 text-red-400 animate-bounce" />
                    ) : result.score >= 40 ? (
                      <AlertTriangle className="h-8 w-8 text-amber-400" />
                    ) : (
                      <ShieldCheck className="h-8 w-8 text-emerald-400" />
                    )}
                  </div>
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-6 pt-4">
              {/* Verdict Banner */}
              <div
                className={`p-4 rounded-xl border flex items-center gap-3 font-semibold text-sm ${riskDetails.borderColor} ${
                  result.score >= 70
                    ? "bg-red-950/70 text-red-200"
                    : result.score >= 40
                    ? "bg-amber-950/70 text-amber-200"
                    : "bg-emerald-950/70 text-emerald-200"
                }`}
              >
                {result.score >= 70 ? (
                  <ShieldAlert className="h-6 w-6 text-red-400 shrink-0" />
                ) : result.score >= 40 ? (
                  <AlertTriangle className="h-6 w-6 text-amber-400 shrink-0" />
                ) : (
                  <CheckCircle2 className="h-6 w-6 text-emerald-400 shrink-0" />
                )}
                <div>
                  <div className="font-bold tracking-wide uppercase text-xs">{riskDetails.label}</div>
                  <div className="text-xs font-normal opacity-90 mt-0.5">
                    {result.score >= 70
                      ? "DO NOT TRANSFER MONEY. This account demonstrates strong signals of being a mule account used by cyber criminals."
                      : result.score >= 40
                      ? "PROCEED WITH CAUTION. Account exhibits unusual transaction patterns. Verify recipient identity through secondary channels."
                      : "SAFE. Account activity aligns with verified legitimate Indian banking behavioral patterns."}
                  </div>
                </div>
              </div>

              {/* Plain-Language Rationale */}
              <div className="space-y-2 bg-slate-950/60 p-4 rounded-xl border border-slate-800">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-300 uppercase tracking-wider">
                  <Info className="h-4 w-4 text-blue-400" />
                  <span>Plain-Language AI Rationale</span>
                </div>
                <p className="text-sm text-slate-200 leading-relaxed">
                  {result.explanation_text ||
                    "This account has been verified against our digital payment fraud models with no suspicious pass-through or structuring anomalies found."}
                </p>
              </div>

              {/* Top Key Drivers */}
              {result.top_features?.shap && result.top_features.shap.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-xs font-semibold uppercase text-slate-400 tracking-wider">
                    Key Assessment Factors:
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {result.top_features.shap.map((f, i) => (
                      <div
                        key={i}
                        className="p-3 rounded-lg bg-slate-900/90 border border-slate-800 flex items-start gap-2.5 text-xs"
                      >
                        <div
                          className={`mt-0.5 h-2 w-2 rounded-full shrink-0 ${
                            f.direction === "increases_risk" ? "bg-red-400" : "bg-emerald-400"
                          }`}
                        />
                        <div>
                          <span className="font-semibold text-slate-200 capitalize">
                            {f.description || f.feature.replace(/_/g, " ")}
                          </span>
                          <span className="block text-[11px] text-slate-400 mt-0.5">
                            {f.direction === "increases_risk"
                              ? "Elevates fraud probability"
                              : "Reduces risk profile"}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Timestamp & Ring ID */}
              <div className="flex flex-wrap items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-800">
                <span className="flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" />
                  Scored at: {new Date(result.computed_at).toLocaleString("en-IN")}
                </span>
                {result.ring_id && (
                  <span className="text-red-400 font-mono font-medium">
                    Associated Fraud Ring: {result.ring_id}
                  </span>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Cyber Crime Helpline 1930 Emergency Card */}
          <Card className="border-red-900/60 bg-gradient-to-r from-red-950/70 via-slate-900 to-red-950/70 p-6 shadow-2xl relative overflow-hidden">
            <div className="flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="flex items-start gap-4">
                <div className="h-14 w-14 rounded-2xl bg-red-600/20 border border-red-500/40 flex items-center justify-center shrink-0 shadow-[0_0_20px_rgba(239,68,68,0.3)]">
                  <PhoneCall className="h-7 w-7 text-red-400 animate-pulse" />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-red-400">
                      Victim of Fraud or Extortion?
                    </span>
                    <Badge variant="destructive" size="sm">
                      Toll-Free 24x7
                    </Badge>
                  </div>
                  <h3 className="text-2xl font-black text-white flex items-center gap-3">
                    Dial <span className="text-red-400 underline underline-offset-4">1930</span>
                  </h3>
                  <p className="text-xs text-slate-300 max-w-lg leading-relaxed">
                    Immediately report fraudulent UPI transfers to the National Cyber Crime Reporting Portal.
                    Calling 1930 within the &quot;Golden Hour&quot; (first 2 hours) enables rapid inter-bank freeze
                    protocols before funds are withdrawn by mule networks.
                  </p>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto shrink-0">
                <a
                  href="tel:1930"
                  className="inline-flex items-center justify-center gap-2 h-11 px-6 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-sm shadow-lg shadow-red-600/30 transition-all active:translate-y-0.5"
                >
                  <PhoneCall className="h-4 w-4" />
                  <span>Call 1930 Now</span>
                </a>
                <a
                  href="https://cybercrime.gov.in"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 h-11 px-5 rounded-xl border border-slate-700 bg-slate-900/80 hover:bg-slate-800 text-slate-200 font-semibold text-sm transition-all"
                >
                  <span>File Online Complaint</span>
                  <ExternalLink className="h-4 w-4" />
                </a>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};
