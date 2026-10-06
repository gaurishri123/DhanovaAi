"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Clock,
  Lock,
  Unlock,
  RefreshCw,
  CheckCircle2,
  ExternalLink,
  Scale,
} from "lucide-react";
import {
  getAllHolds,
  releaseHoldAction,
  checkExpiredHoldsAction,
  placeHoldAction,
} from "@/lib/api";
import { HoldActionResponse } from "@/types/account";
import { formatTimeRemaining } from "@/lib/utils";
import { useOfficer } from "@/lib/officerContext";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";

export const HoldManagementComponent: React.FC = () => {
  const { officerId } = useOfficer();
  const [holds, setHolds] = useState<HoldActionResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedHoldForRelease, setSelectedHoldForRelease] = useState<HoldActionResponse | null>(null);
  const [releaseReason, setReleaseReason] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  // New Hold Modal
  const [isNewHoldModalOpen, setIsNewHoldModalOpen] = useState(false);
  const [newHoldAccountId, setNewHoldAccountId] = useState("");
  const [newHoldReason, setNewHoldReason] = useState("");

  const loadHolds = async () => {
    setLoading(true);
    try {
      const data = await getAllHolds();
      setHolds(data);
    } catch {
      // Handled
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHolds();
    // Live countdown update interval every minute
    const interval = setInterval(() => {
      setHolds((prev) => [...prev]);
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  const handleRelease = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedHoldForRelease) return;

    setActionLoading(true);
    try {
      const res = await releaseHoldAction(selectedHoldForRelease.action_id);
      setActionNotice(res.message);
      setSelectedHoldForRelease(null);
      setReleaseReason("");
      loadHolds();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to release hold";
      alert("Failed to release hold: " + msg);
    } finally {
      setActionLoading(false);
    }
  };

  const handleRunExpiredCheck = async () => {
    setActionLoading(true);
    try {
      const res = await checkExpiredHoldsAction();
      setActionNotice(res.message);
      loadHolds();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to check expired holds";
      alert("Failed to check expired holds: " + msg);
    } finally {
      setActionLoading(false);
    }
  };

  const handleCreateNewHold = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newHoldAccountId.trim() || !newHoldReason.trim()) return;

    setActionLoading(true);
    try {
      const res = await placeHoldAction(newHoldAccountId, newHoldReason, officerId);
      setActionNotice(`Hold ${res.data.action_id} established for account ${res.data.account_id}.`);
      setIsNewHoldModalOpen(false);
      setNewHoldAccountId("");
      setNewHoldReason("");
      loadHolds();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to create hold";
      alert("Failed to create hold: " + msg);
    } finally {
      setActionLoading(false);
    }
  };

  const filteredHolds = holds.filter((h) => {
    if (statusFilter === "all") return true;
    return h.status === statusFilter;
  });

  const activeCount = holds.filter((h) => h.status === "active").length;
  const releasedCount = holds.filter((h) => h.status === "released").length;
  const expiredCount = holds.filter((h) => h.status === "expired").length;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/80 pb-6">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              RBI 60-Day Hold Management
            </h1>
            <Badge variant="warning" size="sm">
              Statutory Enforcement
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Enforce and monitor statutory 60-day freezing orders under the 2026 RBI Digital Fraud Framework.
          </p>
        </div>

        {/* Action Buttons: Expired Trigger + New Hold */}
        <div className="flex items-center gap-2.5">
          <Button
            id="run-expired-check-btn"
            variant="outline"
            size="sm"
            onClick={handleRunExpiredCheck}
            isLoading={actionLoading}
            className="gap-2 border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800"
          >
            <RefreshCw className="h-4 w-4 text-blue-400" />
            <span>Process Expired Holds (/actions/holds/expired)</span>
          </Button>

          <Button
            id="open-new-hold-modal-btn"
            variant="destructive"
            size="sm"
            onClick={() => setIsNewHoldModalOpen(true)}
            className="gap-2"
          >
            <Lock className="h-4 w-4" />
            <span>Issue New Hold</span>
          </Button>
        </div>
      </div>

      {/* Action Notification */}
      {actionNotice && (
        <div className="p-4 rounded-xl bg-blue-950/60 border border-blue-800/50 text-blue-200 text-sm flex items-center justify-between animate-in fade-in">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="h-5 w-5 text-blue-400" />
            <span>{actionNotice}</span>
          </div>
          <button
            onClick={() => setActionNotice(null)}
            className="text-xs text-blue-400 hover:underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Metric KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-amber-900/30 bg-slate-900/60 p-5">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-xs uppercase font-semibold text-slate-400">
                Active 60-Day Holds
              </span>
              <p className="text-3xl font-black font-mono text-amber-400">{activeCount}</p>
              <p className="text-[11px] text-slate-400">Under active legal freeze</p>
            </div>
            <div className="h-12 w-12 rounded-xl bg-amber-600/10 border border-amber-500/20 flex items-center justify-center">
              <Clock className="h-6 w-6 text-amber-400" />
            </div>
          </div>
        </Card>

        <Card className="border-emerald-900/30 bg-slate-900/60 p-5">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-xs uppercase font-semibold text-slate-400">
                Officer Early Releases
              </span>
              <p className="text-3xl font-black font-mono text-emerald-400">{releasedCount}</p>
              <p className="text-[11px] text-slate-400">Legitimate merchant/citizen clearance</p>
            </div>
            <div className="h-12 w-12 rounded-xl bg-emerald-600/10 border border-emerald-500/20 flex items-center justify-center">
              <Unlock className="h-6 w-6 text-emerald-400" />
            </div>
          </div>
        </Card>

        <Card className="border-slate-800 bg-slate-900/60 p-5">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-xs uppercase font-semibold text-slate-400">
                Completed Statutory Lapses
              </span>
              <p className="text-3xl font-black font-mono text-slate-300">{expiredCount}</p>
              <p className="text-[11px] text-slate-400">Auto-expired after 60-day window</p>
            </div>
            <div className="h-12 w-12 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center">
              <Scale className="h-6 w-6 text-slate-400" />
            </div>
          </div>
        </Card>
      </div>

      {/* Holds Table */}
      <Card className="border-slate-800 bg-slate-900/80 shadow-2xl">
        <CardHeader className="border-b border-slate-800/80 pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <CardTitle>Statutory Freeze Records</CardTitle>
              <CardDescription>
                Live countdown clocks tracking the 60-day statutory holding limit for active accounts.
              </CardDescription>
            </div>

            {/* Filter */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">Filter Status:</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="h-8 rounded-lg bg-slate-950 border border-slate-700 px-3 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
              >
                <option value="all">All Records</option>
                <option value="active">Active Only</option>
                <option value="released">Released Early</option>
                <option value="expired">Expired Lapsed</option>
              </select>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/70 border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Action ID &amp; Target</th>
                  <th className="py-3 px-4">Officer Attribution</th>
                  <th className="py-3 px-4">Grounds / Reason</th>
                  <th className="py-3 px-4">Hold Timeline</th>
                  <th className="py-3 px-4">60-Day Countdown</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Enforcement Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-500">
                      <RefreshCw className="h-6 w-6 animate-spin mx-auto text-blue-500 mb-2" />
                      Loading statutory hold registers...
                    </td>
                  </tr>
                ) : filteredHolds.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-500">
                      No hold actions found matching the selected filter.
                    </td>
                  </tr>
                ) : (
                  filteredHolds.map((h) => {
                    const countdown = formatTimeRemaining(h.hold_expiry);

                    return (
                      <tr key={h.action_id} className="hover:bg-slate-800/30 transition-colors">
                        {/* Action ID & Target */}
                        <td className="py-3.5 px-4">
                          <span className="font-mono font-bold text-white block">
                            {h.action_id}
                          </span>
                          <Link
                            href={`/accounts/${h.account_id}`}
                            className="inline-flex items-center gap-1 font-mono text-xs text-blue-400 hover:underline"
                          >
                            <span>{h.account_id}</span>
                            <ExternalLink className="h-3 w-3" />
                          </Link>
                        </td>

                        {/* Officer Attribution */}
                        <td className="py-3.5 px-4 font-mono font-semibold text-slate-300">
                          {h.officer_id}
                        </td>

                        {/* Reason */}
                        <td className="py-3.5 px-4 max-w-xs text-slate-300 truncate" title={h.reason}>
                          {h.reason}
                        </td>

                        {/* Timeline */}
                        <td className="py-3.5 px-4 text-slate-400 space-y-0.5">
                          <span className="block text-[11px]">
                            Start: {new Date(h.hold_start).toLocaleDateString("en-IN")}
                          </span>
                          <span className="block text-[11px] text-amber-300">
                            Expiry: {new Date(h.hold_expiry).toLocaleDateString("en-IN")}
                          </span>
                        </td>

                        {/* Countdown */}
                        <td className="py-3.5 px-4">
                          {h.status === "active" ? (
                            <div className="space-y-1.5 w-36">
                              <div className="flex items-center justify-between text-[11px] font-mono">
                                <span
                                  className={
                                    countdown.isExpired
                                      ? "text-red-400 font-bold"
                                      : "text-amber-300 font-bold"
                                  }
                                >
                                  {countdown.text}
                                </span>
                              </div>
                              <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all ${
                                    countdown.isExpired ? "bg-red-500" : "bg-amber-500"
                                  }`}
                                  style={{ width: `${countdown.percentRemaining}%` }}
                                />
                              </div>
                            </div>
                          ) : (
                            <span className="text-slate-500 text-xs font-mono">—</span>
                          )}
                        </td>

                        {/* Status */}
                        <td className="py-3.5 px-4">
                          {h.status === "active" ? (
                            countdown.isExpired ? (
                              <Badge variant="destructive" size="sm" className="font-mono">
                                EXPIRED (NEEDS SYNC)
                              </Badge>
                            ) : (
                              <Badge variant="warning" size="sm" className="font-mono">
                                ACTIVE (60D)
                              </Badge>
                            )
                          ) : h.status === "released" ? (
                            <Badge variant="success" size="sm" className="font-mono">
                              RELEASED EARLY
                            </Badge>
                          ) : (
                            <Badge variant="secondary" size="sm" className="font-mono">
                              EXPIRED
                            </Badge>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="py-3.5 px-4 text-right">
                          {h.status === "active" && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setSelectedHoldForRelease(h)}
                              className="h-7 text-xs border-emerald-800/60 text-emerald-300 hover:bg-emerald-950/40"
                            >
                              <Unlock className="h-3 w-3 mr-1" />
                              <span>Release</span>
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Early Release Modal */}
      <Modal
        isOpen={!!selectedHoldForRelease}
        onClose={() => setSelectedHoldForRelease(null)}
        title={
          <span className="flex items-center gap-2 text-emerald-400">
            <Unlock className="h-5 w-5" />
            Early Hold Release Order
          </span>
        }
        description="Lift the 60-day freeze prior to its statutory expiry following forensic clearance."
      >
        {selectedHoldForRelease && (
          <form onSubmit={handleRelease} className="space-y-4 pt-2">
            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">Action ID:</span>
                <span className="font-mono font-bold text-white">{selectedHoldForRelease.action_id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Account ID:</span>
                <span className="font-mono font-bold text-white">
                  {selectedHoldForRelease.account_id}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Original Grounds:</span>
                <span className="text-slate-300 truncate max-w-xs">{selectedHoldForRelease.reason}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Releasing Officer:</span>
                <span className="font-mono text-blue-400 font-semibold">{officerId}</span>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">
                Official Release Reason / Verification Findings:
              </label>
              <textarea
                required
                rows={3}
                value={releaseReason}
                onChange={(e) => setReleaseReason(e.target.value)}
                placeholder="Legitimate transaction evidence provided, physical KYC verified, or grievance redressal completed..."
                className="w-full text-xs bg-slate-950 border border-slate-700 rounded-lg p-3 text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500 shadow-inner"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setSelectedHoldForRelease(null)}
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
        )}
      </Modal>

      {/* Place New Hold Modal */}
      <Modal
        isOpen={isNewHoldModalOpen}
        onClose={() => setIsNewHoldModalOpen(false)}
        title={
          <span className="flex items-center gap-2 text-red-400">
            <Lock className="h-5 w-5" />
            Issue Statutory 60-Day Freeze
          </span>
        }
        description="Creates an official hold record and updates account status across the network."
      >
        <form onSubmit={handleCreateNewHold} className="space-y-4 pt-2">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-300">Target Account ID:</label>
            <input
              type="text"
              required
              placeholder="e.g. ACC_00042"
              value={newHoldAccountId}
              onChange={(e) => setNewHoldAccountId(e.target.value)}
              className="w-full h-9 rounded-lg bg-slate-950 border border-slate-700 px-3 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-1 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-400">Authorizing Officer:</span>
              <span className="font-mono text-blue-400 font-semibold">{officerId}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Statutory Duration:</span>
              <span className="text-amber-400 font-semibold">60 Days (RBI Protocol)</span>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-300">
              Formal Justification / Reference:
            </label>
            <textarea
              required
              rows={3}
              value={newHoldReason}
              onChange={(e) => setNewHoldReason(e.target.value)}
              placeholder="Suspicious burst structuring under ₹10k, linkage to device farm, or 1930 victim report reference..."
              className="w-full text-xs bg-slate-950 border border-slate-700 rounded-lg p-3 text-white placeholder:text-slate-500 focus:outline-none focus:border-red-500 shadow-inner"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setIsNewHoldModalOpen(false)}
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
    </div>
  );
};
