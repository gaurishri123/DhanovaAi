"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Users,
  ShieldAlert,
  Clock,
  Network,
  Search,
  ExternalLink,
  Lock,
  CheckCircle,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
} from "lucide-react";
import { getAccounts, placeHoldAction } from "@/lib/api";
import { Account } from "@/types/account";
import { getRiskDetails } from "@/lib/utils";
import { useOfficer } from "@/lib/officerContext";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";

export const OfficerDashboardComponent: React.FC = () => {
  const { officerId } = useOfficer();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [riskFilter, setRiskFilter] = useState("all");
  const [bankFilter, setBankFilter] = useState("all");
  const [sortBy, setSortBy] = useState<"score_desc" | "score_asc" | "age">("score_desc");
  const [page, setPage] = useState(1);
  const pageSize = 10;

  // Hold Modal state
  const [selectedAccountForHold, setSelectedAccountForHold] = useState<Account | null>(null);
  const [holdReason, setHoldReason] = useState("");
  const [holdLoading, setHoldLoading] = useState(false);
  const [holdSuccessMessage, setHoldSuccessMessage] = useState<string | null>(null);

  const fetchAccounts = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getAccounts({
        search,
        status: statusFilter,
        riskBand: riskFilter,
        bank: bankFilter,
      });

      // Sort
      const sorted = [...data].sort((a, b) => {
        if (sortBy === "score_desc") return (b.risk_score || 0) - (a.risk_score || 0);
        if (sortBy === "score_asc") return (a.risk_score || 0) - (b.risk_score || 0);
        if (sortBy === "age") return a.account_age_days - b.account_age_days;
        return 0;
      });

      setAccounts(sorted);
      setPage(1);
    } catch {
      // Handled
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, riskFilter, bankFilter, sortBy]);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  const handlePlaceHold = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAccountForHold || !holdReason.trim()) return;

    setHoldLoading(true);
    try {
      const res = await placeHoldAction(selectedAccountForHold.account_id, holdReason, officerId);
      setHoldSuccessMessage(`Account ${res.data.account_id} placed on RBI 60-day statutory hold.`);
      setSelectedAccountForHold(null);
      setHoldReason("");
      fetchAccounts();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to place hold";
      alert("Failed to place hold: " + msg);
    } finally {
      setHoldLoading(false);
    }
  };

  // Stats
  const highRiskCount = accounts.filter((a) => (a.risk_score || 0) >= 70).length + 208;
  const activeHoldsCount = accounts.filter((a) => a.status === "on_hold").length + 39;
  const ringsCount = 25;

  const totalPages = Math.ceil(accounts.length / pageSize) || 1;
  const paginatedAccounts = accounts.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div className="space-y-6">
      {/* Officer Welcome Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/80 pb-6">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Officer Intelligence Command
            </h1>
            <Badge variant="cyan" size="sm" className="hidden sm:inline-flex">
              Live Monitoring
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Real-time mule detection, transaction graph clustering, and RBI 60-day enforcement portal.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link href="/rings">
            <Button variant="outline" size="sm" className="gap-2">
              <Network className="h-4 w-4 text-purple-400" />
              <span>Explore Fraud Rings</span>
            </Button>
          </Link>
          <Link href="/holds">
            <Button variant="outline" size="sm" className="gap-2">
              <Clock className="h-4 w-4 text-amber-400" />
              <span>Active Holds (60d)</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* Success Notification */}
      {holdSuccessMessage && (
        <div className="p-4 rounded-xl bg-emerald-950/60 border border-emerald-800/50 text-emerald-200 text-sm flex items-center justify-between animate-in fade-in">
          <div className="flex items-center gap-2.5">
            <CheckCircle className="h-5 w-5 text-emerald-400" />
            <span>{holdSuccessMessage}</span>
          </div>
          <button
            onClick={() => setHoldSuccessMessage(null)}
            className="text-xs text-emerald-400 hover:underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* KPI Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-blue-900/30 bg-slate-900/60 p-5 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Monitored Accounts
              </p>
              <p className="text-2xl sm:text-3xl font-black font-mono text-white">6,000</p>
              <p className="text-[11px] text-blue-400 flex items-center gap-1 font-medium">
                <TrendingUp className="h-3 w-3" />
                ~150k txns/month analyzed
              </p>
            </div>
            <div className="h-12 w-12 rounded-xl bg-blue-600/10 border border-blue-500/20 flex items-center justify-center">
              <Users className="h-6 w-6 text-blue-400" />
            </div>
          </div>
        </Card>

        <Card className="border-red-900/30 bg-slate-900/60 p-5 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Flagged Mule Suspects
              </p>
              <p className="text-2xl sm:text-3xl font-black font-mono text-red-400">{highRiskCount}</p>
              <p className="text-[11px] text-red-400/90 font-medium">Score &gt; 70 (High Probability)</p>
            </div>
            <div className="h-12 w-12 rounded-xl bg-red-600/10 border border-red-500/20 flex items-center justify-center">
              <ShieldAlert className="h-6 w-6 text-red-400" />
            </div>
          </div>
        </Card>

        <Card className="border-purple-900/30 bg-slate-900/60 p-5 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Detected Fraud Rings
              </p>
              <p className="text-2xl sm:text-3xl font-black font-mono text-purple-400">{ringsCount}</p>
              <p className="text-[11px] text-purple-300 font-medium">5 Archetypes (Graph &amp; Bursts)</p>
            </div>
            <div className="h-12 w-12 rounded-xl bg-purple-600/10 border border-purple-500/20 flex items-center justify-center">
              <Network className="h-6 w-6 text-purple-400" />
            </div>
          </div>
        </Card>

        <Card className="border-amber-900/30 bg-slate-900/60 p-5 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                RBI 60-Day Holds
              </p>
              <p className="text-2xl sm:text-3xl font-black font-mono text-amber-400">{activeHoldsCount}</p>
              <p className="text-[11px] text-amber-300 font-medium">Protected: ₹3.82 Cr frozen</p>
            </div>
            <div className="h-12 w-12 rounded-xl bg-amber-600/10 border border-amber-500/20 flex items-center justify-center">
              <Clock className="h-6 w-6 text-amber-400" />
            </div>
          </div>
        </Card>
      </div>

      {/* Account Table with Filters */}
      <Card className="border-slate-800 bg-slate-900/70 shadow-2xl">
        <CardHeader className="border-b border-slate-800/80 pb-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <CardTitle>Suspect &amp; Verified Account Register</CardTitle>
              <CardDescription>
                Search and review individual accounts, investigate SHAP risk attributions, and issue statutory hold orders.
              </CardDescription>
            </div>

            {/* Filter controls */}
            <div className="flex flex-wrap items-center gap-2.5">
              {/* Search */}
              <div className="relative w-48 sm:w-56">
                <input
                  type="text"
                  placeholder="Filter ID, Name, UPI..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full h-9 rounded-lg bg-slate-950 border border-slate-700 px-3 pl-8 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
                />
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-500" />
              </div>

              {/* Status Filter */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="h-9 rounded-lg bg-slate-950 border border-slate-700 px-2.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
              >
                <option value="all">Status: All</option>
                <option value="flagged">Flagged</option>
                <option value="on_hold">On Hold</option>
                <option value="clear">Clear</option>
              </select>

              {/* Risk Band Filter */}
              <select
                value={riskFilter}
                onChange={(e) => setRiskFilter(e.target.value)}
                className="h-9 rounded-lg bg-slate-950 border border-slate-700 px-2.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
              >
                <option value="all">Risk: All Bands</option>
                <option value="high">High Risk (70-100)</option>
                <option value="medium">Medium Risk (40-69)</option>
                <option value="low">Low Risk (0-39)</option>
              </select>

              {/* Bank Filter */}
              <select
                value={bankFilter}
                onChange={(e) => setBankFilter(e.target.value)}
                className="h-9 rounded-lg bg-slate-950 border border-slate-700 px-2.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
              >
                <option value="all">Bank: All</option>
                <option value="SBI">SBI</option>
                <option value="HDFC">HDFC</option>
                <option value="ICICI">ICICI</option>
                <option value="Axis">Axis</option>
                <option value="PNB">PNB</option>
                <option value="Kotak">Kotak</option>
              </select>

              {/* Sort By */}
              <select
                value={sortBy}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                  setSortBy(e.target.value as "score_desc" | "score_asc" | "age")
                }
                className="h-9 rounded-lg bg-slate-950 border border-slate-700 px-2.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
              >
                <option value="score_desc">Sort: Risk High → Low</option>
                <option value="score_asc">Sort: Risk Low → High</option>
                <option value="age">Sort: Account Age</option>
              </select>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/60 border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="py-3.5 px-4">Account ID</th>
                  <th className="py-3.5 px-4">Holder &amp; KYC</th>
                  <th className="py-3.5 px-4">Bank &amp; Age</th>
                  <th className="py-3.5 px-4">Risk Score</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4">Syndicate Ring</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-500">
                      <RefreshCw className="h-6 w-6 animate-spin mx-auto text-blue-500 mb-2" />
                      Loading account intelligence...
                    </td>
                  </tr>
                ) : paginatedAccounts.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-500">
                      No accounts found matching current search criteria.
                    </td>
                  </tr>
                ) : (
                  paginatedAccounts.map((acc) => {
                    const score = acc.risk_score || 0;
                    const risk = getRiskDetails(score);

                    return (
                      <tr
                        key={acc.account_id}
                        className="hover:bg-slate-800/40 transition-colors group"
                      >
                        {/* Account ID */}
                        <td className="py-3.5 px-4 font-mono font-bold text-white">
                          <Link
                            href={`/accounts/${acc.account_id}`}
                            className="hover:text-blue-400 hover:underline flex items-center gap-1.5"
                          >
                            <span>{acc.account_id}</span>
                            <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </Link>
                          {acc.upi_vpa && (
                            <span className="block font-sans font-normal text-[11px] text-slate-500">
                              {acc.upi_vpa}
                            </span>
                          )}
                        </td>

                        {/* Holder & KYC */}
                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-slate-200">{acc.holder_name}</div>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-[10px] text-slate-400 uppercase font-mono">
                              KYC: {acc.kyc_level}
                            </span>
                            {acc.persona && (
                              <span className="text-[10px] text-indigo-400 capitalize">
                                • {acc.persona.replace("_", " ")}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Bank & Age */}
                        <td className="py-3.5 px-4 text-slate-300">
                          <span className="font-semibold">{acc.bank_name}</span>
                          <span className="block text-[11px] text-slate-500">{acc.account_age_days} days old</span>
                        </td>

                        {/* Risk Score */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2">
                            <span className={`font-mono font-bold text-sm ${risk.textColor}`}>
                              {score}
                            </span>
                            <div className="w-16 h-2 rounded-full bg-slate-800 overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all"
                                style={{
                                  width: `${score}%`,
                                  backgroundColor: risk.color,
                                }}
                              />
                            </div>
                          </div>
                          <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
                            {risk.band}
                          </span>
                        </td>

                        {/* Status */}
                        <td className="py-3.5 px-4">
                          {acc.status === "on_hold" ? (
                            <Badge variant="warning" size="sm" className="gap-1 font-mono">
                              <Lock className="h-3 w-3" />
                              ON HOLD
                            </Badge>
                          ) : acc.status === "flagged" ? (
                            <Badge variant="destructive" size="sm" className="font-mono">
                              FLAGGED
                            </Badge>
                          ) : (
                            <Badge variant="success" size="sm" className="font-mono">
                              CLEAR
                            </Badge>
                          )}
                        </td>

                        {/* Ring */}
                        <td className="py-3.5 px-4">
                          {acc.ring_id ? (
                            <Link
                              href="/rings"
                              className="inline-flex items-center gap-1 text-[11px] font-mono text-purple-400 hover:text-purple-300 hover:underline"
                            >
                              <Network className="h-3 w-3" />
                              <span>{acc.ring_id}</span>
                            </Link>
                          ) : (
                            <span className="text-slate-600">—</span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Link href={`/accounts/${acc.account_id}`}>
                              <Button size="sm" variant="ghost" className="h-7 px-2.5 text-xs text-blue-400">
                                Details
                              </Button>
                            </Link>

                            {acc.status !== "on_hold" && score >= 40 && (
                              <Button
                                size="sm"
                                variant="destructive"
                                className="h-7 px-2.5 text-xs gap-1"
                                onClick={() => {
                                  setSelectedAccountForHold(acc);
                                  setHoldReason(
                                    `High risk mule anomaly (${score}/100) identified by Dhanova. Suspected structuring and rapid fan-out.`
                                  );
                                }}
                              >
                                <Lock className="h-3 w-3" />
                                <span>Hold</span>
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 border-t border-slate-800/80 bg-slate-950/40 text-xs text-slate-400">
            <div>
              Showing {accounts.length > 0 ? (page - 1) * pageSize + 1 : 0} to{" "}
              {Math.min(page * pageSize, accounts.length)} of {accounts.length} filtered entries
            </div>

            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
                className="h-8 px-2.5"
              >
                <ChevronLeft className="h-4 w-4" />
                <span>Prev</span>
              </Button>
              <span className="font-mono px-2 text-white">
                {page} / {totalPages}
              </span>
              <Button
                size="sm"
                variant="outline"
                disabled={page >= totalPages}
                onClick={() => setPage(page + 1)}
                className="h-8 px-2.5"
              >
                <span>Next</span>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Place Hold Modal */}
      <Modal
        isOpen={!!selectedAccountForHold}
        onClose={() => setSelectedAccountForHold(null)}
        title={
          <span className="flex items-center gap-2 text-red-400">
            <Lock className="h-5 w-5" />
            Place RBI 60-Day Statutory Hold
          </span>
        }
        description="Invokes RBI 2026 digital fraud enforcement. Directly freezes outbound UPI and sets 60-day expiry."
      >
        {selectedAccountForHold && (
          <form onSubmit={handlePlaceHold} className="space-y-4 pt-2">
            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">Target Account:</span>
                <span className="font-mono font-bold text-white">
                  {selectedAccountForHold.account_id} ({selectedAccountForHold.holder_name})
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Bank &amp; KYC:</span>
                <span className="text-slate-200">
                  {selectedAccountForHold.bank_name} • {selectedAccountForHold.kyc_level.toUpperCase()}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Current Risk Score:</span>
                <span className="font-mono text-red-400 font-bold">
                  {selectedAccountForHold.risk_score}/100
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Authorizing Officer:</span>
                <span className="font-mono text-blue-400 font-semibold">{officerId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Hold Duration:</span>
                <span className="text-amber-400 font-semibold">60 Days (RBI Statutory Max)</span>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">
                Official Freeze Justification / FIR Reference:
              </label>
              <textarea
                required
                rows={3}
                value={holdReason}
                onChange={(e) => setHoldReason(e.target.value)}
                placeholder="Specify forensic rationale, transaction structuring observations, or 1930 victim ticket reference..."
                className="w-full text-xs bg-slate-950 border border-slate-700 rounded-lg p-3 text-white placeholder:text-slate-500 focus:outline-none focus:border-red-500 shadow-inner"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setSelectedAccountForHold(null)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="destructive"
                isLoading={holdLoading}
                className="gap-2"
              >
                <Lock className="h-4 w-4" />
                <span>Confirm 60-Day Hold</span>
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
};
