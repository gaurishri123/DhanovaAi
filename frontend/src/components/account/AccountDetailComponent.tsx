"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Lock,
  Unlock,
  Network,
  Clock,
  Sparkles,
  ExternalLink,
  CheckCircle2,
} from "lucide-react";
import {
  getAccountById,
  checkUpiAccount,
  getAccountTransactions,
  placeHoldAction,
  releaseHoldAction,
  getAllHolds,
} from "@/lib/api";
import { Account, RiskScoreResponse, Transaction, HoldActionResponse } from "@/types/account";
import { formatDate } from "@/lib/utils";
import { useOfficer } from "@/lib/officerContext";
import { RiskGauge } from "@/components/account/RiskGauge";
import { ShapChart } from "@/components/account/ShapChart";
import { TransactionHistory } from "@/components/account/TransactionHistory";
import { CaseChatDrawer } from "@/components/account/CaseChatDrawer";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";

interface AccountDetailProps {
  accountId: string;
}

export const AccountDetailComponent: React.FC<AccountDetailProps> = ({ accountId }) => {
  const { officerId } = useOfficer();

  const [account, setAccount] = useState<Account | null>(null);
  const [riskData, setRiskData] = useState<RiskScoreResponse | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [activeHold, setActiveHold] = useState<HoldActionResponse | null>(null);
  const [loading, setLoading] = useState(true);

  // Modals & Chat Drawer
  const [isHoldModalOpen, setIsHoldModalOpen] = useState(false);
  const [isReleaseModalOpen, setIsReleaseModalOpen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);

  // Form states
  const [holdReason, setHoldReason] = useState("");
  const [releaseReason, setReleaseReason] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [acc, riskRes, txns, holds] = await Promise.all([
        getAccountById(accountId),
        checkUpiAccount(accountId),
        getAccountTransactions(accountId),
        getAllHolds(),
      ]);

      setAccount(acc);
      setRiskData(riskRes.data);
      setTransactions(txns);

      // Check if there is an active hold for this account
      const hold = holds.find((h) => h.account_id === accountId && h.status === "active");
      setActiveHold(hold || null);
    } catch {
      // Handled
    } finally {
      setLoading(false);
    }
  }, [accountId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handlePlaceHold = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!account || !holdReason.trim()) return;

    setActionLoading(true);
    try {
      await placeHoldAction(account.account_id, holdReason, officerId);
      setActionSuccessMsg(`Account ${account.account_id} placed on RBI 60-day statutory hold.`);
      setIsHoldModalOpen(false);
      setHoldReason("");
      loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to place hold";
      alert("Failed to place hold: " + msg);
    } finally {
      setActionLoading(false);
    }
  };

  const handleReleaseHold = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeHold) return;

    setActionLoading(true);
    try {
      await releaseHoldAction(activeHold.action_id);
      setActionSuccessMsg(`Hold ${activeHold.action_id} released successfully.`);
      setIsReleaseModalOpen(false);
      setReleaseReason("");
      loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to release hold";
      alert("Failed to release hold: " + msg);
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="py-20 text-center space-y-3">
        <div className="h-8 w-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-sm text-slate-400">Loading forensic case records for {accountId}...</p>
      </div>
    );
  }

  const score = riskData?.score ?? account?.risk_score ?? 15;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Top Breadcrumb & Actions Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard"
            className="p-2 rounded-lg bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs uppercase text-slate-400 font-semibold tracking-wider">
                Case Dossier
              </span>
              <span className="text-slate-600">•</span>
              <span className="font-mono text-xs text-blue-400 font-semibold">
                Officer {officerId}
              </span>
            </div>
            <h1 className="text-2xl font-black font-mono text-white tracking-tight flex items-center gap-2">
              {accountId}
            </h1>
          </div>
        </div>

        {/* Action Buttons: Hold/Release + Gemini Chat */}
        <div className="flex items-center gap-2.5">
          <Button
            id="open-gemini-chat-btn"
            variant="default"
            size="sm"
            onClick={() => setIsChatOpen(true)}
            className="gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-lg shadow-indigo-600/30 font-semibold"
          >
            <Sparkles className="h-4 w-4 text-indigo-200" />
            <span>Gemini Case Chat</span>
          </Button>

          {account?.status === "on_hold" || activeHold ? (
            <Button
              id="release-hold-btn"
              variant="outline"
              size="sm"
              onClick={() => setIsReleaseModalOpen(true)}
              className="gap-2 border-emerald-700/60 bg-emerald-950/40 text-emerald-300 hover:bg-emerald-900/50"
            >
              <Unlock className="h-4 w-4" />
              <span>Release Hold</span>
            </Button>
          ) : (
            <Button
              id="place-hold-btn"
              variant="destructive"
              size="sm"
              onClick={() => {
                setHoldReason(
                  `Mule score ${score}/100. Dispersal velocity and nocturnal structuring pattern warrant statutory hold.`
                );
                setIsHoldModalOpen(true);
              }}
              className="gap-2"
            >
              <Lock className="h-4 w-4" />
              <span>Place 60-Day Hold</span>
            </Button>
          )}
        </div>
      </div>

      {/* Action Notification */}
      {actionSuccessMsg && (
        <div className="p-4 rounded-xl bg-emerald-950/60 border border-emerald-800/50 text-emerald-200 text-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-400" />
            <span>{actionSuccessMsg}</span>
          </div>
          <button
            onClick={() => setActionSuccessMsg(null)}
            className="text-xs text-emerald-400 hover:underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Account Overview Header Card */}
      <Card className="border-slate-800 bg-slate-900/80 shadow-2xl">
        <CardContent className="p-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            <div className="space-y-1">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Account Holder
              </span>
              <p className="font-bold text-white text-sm truncate">{account?.holder_name}</p>
              <span className="text-[11px] text-slate-500 font-mono">{account?.upi_vpa}</span>
            </div>

            <div className="space-y-1">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Bank &amp; KYC
              </span>
              <p className="font-bold text-white text-sm">{account?.bank_name}</p>
              <span className="text-[11px] text-slate-400 uppercase font-mono">
                KYC: {account?.kyc_level}
              </span>
            </div>

            <div className="space-y-1">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Account Age
              </span>
              <p className="font-bold text-white text-sm">{account?.account_age_days} Days</p>
              <span className="text-[11px] text-slate-500">
                Created ~{account?.account_age_days ? Math.round(account.account_age_days / 30) : 1}m ago
              </span>
            </div>

            <div className="space-y-1">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Enforcement Status
              </span>
              <div>
                {account?.status === "on_hold" || activeHold ? (
                  <Badge variant="warning" size="sm" className="gap-1 font-mono">
                    <Lock className="h-3 w-3" />
                    ON 60D HOLD
                  </Badge>
                ) : account?.status === "flagged" ? (
                  <Badge variant="destructive" size="sm" className="font-mono">
                    FLAGGED
                  </Badge>
                ) : (
                  <Badge variant="success" size="sm" className="font-mono">
                    CLEAR
                  </Badge>
                )}
              </div>
            </div>

            <div className="space-y-1">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Syndicate Link
              </span>
              <div>
                {account?.ring_id ? (
                  <Link
                    href="/rings"
                    className="inline-flex items-center gap-1 font-mono text-purple-400 hover:text-purple-300 text-xs font-semibold hover:underline"
                  >
                    <Network className="h-3.5 w-3.5" />
                    <span>{account.ring_id}</span>
                  </Link>
                ) : (
                  <span className="text-slate-500 text-xs">No active ring</span>
                )}
              </div>
            </div>

            <div className="space-y-1">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Citizen Portal
              </span>
              <div>
                <Link
                  href={`/upi/check/${accountId}`}
                  className="inline-flex items-center gap-1 text-xs text-blue-400 hover:underline"
                >
                  <span>Public View</span>
                  <ExternalLink className="h-3 w-3" />
                </Link>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Grid: Left Column (Risk Gauge + Explanation) | Right Column (SHAP Features) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (5 Cols) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Risk Gauge Card */}
          <Card className="border-slate-800 bg-slate-900/80 shadow-2xl">
            <CardHeader className="pb-2">
              <CardTitle>AI Mule Risk Score</CardTitle>
              <CardDescription>
                Calibrated 0-100 risk probability from XGBoost inference model.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <RiskGauge score={score} />

              {/* Plain-Language Rationale Text */}
              <div className="mt-4 p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-indigo-400" />
                  Forensic Explanation Rationale
                </span>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {riskData?.explanation_text ||
                    "Account displays behavioral indicators consistent with trained fraud signatures. Top contributing factors include swift capital dispersal and nocturnal transfers."}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Active Hold Status Alert (if on hold) */}
          {activeHold && (
            <Card className="border-amber-800/60 bg-amber-950/30 shadow-xl p-4 space-y-2">
              <div className="flex items-center gap-2 text-amber-400 font-bold text-xs uppercase tracking-wider">
                <Clock className="h-4 w-4" />
                <span>Active RBI Statutory Hold</span>
              </div>
              <p className="text-xs text-slate-300">
                Action ID: <span className="font-mono text-white font-semibold">{activeHold.action_id}</span>
              </p>
              <p className="text-xs text-slate-300">
                Reason: {activeHold.reason}
              </p>
              <div className="text-[11px] text-amber-300/90 pt-1 flex justify-between">
                <span>Hold Start: {formatDate(activeHold.hold_start)}</span>
                <span className="font-bold">Expires: {formatDate(activeHold.hold_expiry)}</span>
              </div>
            </Card>
          )}
        </div>

        {/* Right Column (7 Cols): SHAP Feature Attribution */}
        <div className="lg:col-span-7 space-y-6">
          <Card className="border-slate-800 bg-slate-900/80 shadow-2xl">
            <CardHeader>
              <CardTitle>Explainable ML Factors (SHAP)</CardTitle>
              <CardDescription>
                Contribution breakdown showing which features elevate or reduce this account&apos;s mule risk.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ShapChart features={riskData?.top_features?.shap || []} />
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Transaction History Section */}
      <Card className="border-slate-800 bg-slate-900/80 shadow-2xl">
        <CardHeader className="border-b border-slate-800/80 pb-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Recent Point-in-Time Transactions</CardTitle>
              <CardDescription>
                Temporal transaction sequence analyzed by the feature engineering and graph pipeline.
              </CardDescription>
            </div>
            <Badge variant="secondary" size="sm" className="font-mono">
              {transactions.length} Records
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <TransactionHistory transactions={transactions} currentAccountId={accountId} />
        </CardContent>
      </Card>

      {/* Place Hold Modal */}
      <Modal
        isOpen={isHoldModalOpen}
        onClose={() => setIsHoldModalOpen(false)}
        title={
          <span className="flex items-center gap-2 text-red-400">
            <Lock className="h-5 w-5" />
            Place RBI 60-Day Hold
          </span>
        }
        description="RBI 2026 digital payment defense regulation allows immediate 60-day freezing of high-risk mule nodes."
      >
        <form onSubmit={handlePlaceHold} className="space-y-4 pt-2">
          <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-1.5 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-400">Account ID:</span>
              <span className="font-mono font-bold text-white">{accountId}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Holder Name:</span>
              <span className="text-white">{account?.holder_name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Officer Attestation:</span>
              <span className="font-mono text-blue-400 font-semibold">{officerId}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Expiry Window:</span>
              <span className="text-amber-400 font-semibold">60 Days From Today</span>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-300">
              Hold Grounds &amp; Case Notes:
            </label>
            <textarea
              required
              rows={3}
              value={holdReason}
              onChange={(e) => setHoldReason(e.target.value)}
              className="w-full text-xs bg-slate-950 border border-slate-700 rounded-lg p-3 text-white placeholder:text-slate-500 focus:outline-none focus:border-red-500 shadow-inner"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setIsHoldModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="destructive"
              isLoading={actionLoading}
              className="gap-2"
            >
              <Lock className="h-4 w-4" />
              <span>Confirm 60-Day Hold</span>
            </Button>
          </div>
        </form>
      </Modal>

      {/* Release Hold Modal */}
      <Modal
        isOpen={isReleaseModalOpen}
        onClose={() => setIsReleaseModalOpen(false)}
        title={
          <span className="flex items-center gap-2 text-emerald-400">
            <Unlock className="h-5 w-5" />
            Release Active Statutory Hold
          </span>
        }
        description="Lift the freeze on this account prior to statutory 60-day expiry following officer review."
      >
        <form onSubmit={handleReleaseHold} className="space-y-4 pt-2">
          <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-1.5 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-400">Hold Action ID:</span>
              <span className="font-mono font-bold text-white">{activeHold?.action_id}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Account ID:</span>
              <span className="font-mono font-bold text-white">{accountId}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Releasing Officer:</span>
              <span className="font-mono text-blue-400 font-semibold">{officerId}</span>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-300">
              Release Justification (e.g. KYC Verified / Mistaken Identity):
            </label>
            <textarea
              required
              rows={3}
              value={releaseReason}
              onChange={(e) => setReleaseReason(e.target.value)}
              placeholder="Officer findings certifying legitimacy of transactions..."
              className="w-full text-xs bg-slate-950 border border-slate-700 rounded-lg p-3 text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500 shadow-inner"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setIsReleaseModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="success"
              isLoading={actionLoading}
              className="gap-2"
            >
              <Unlock className="h-4 w-4" />
              <span>Confirm Release</span>
            </Button>
          </div>
        </form>
      </Modal>

      {/* Gemini Case Chat Drawer */}
      <CaseChatDrawer
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
        accountId={accountId}
        accountName={account?.holder_name || "Unknown"}
        riskScore={score}
      />
    </div>
  );
};
