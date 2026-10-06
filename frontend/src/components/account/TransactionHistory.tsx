"use client";

import React from "react";
import { Transaction } from "@/types/account";
import { formatCurrency, formatDate } from "@/lib/utils";
import { ArrowUpRight, ArrowDownLeft, AlertCircle, Smartphone } from "lucide-react";
import { Badge } from "@/components/ui/Badge";

interface TransactionHistoryProps {
  transactions: Transaction[];
  currentAccountId: string;
}

export const TransactionHistory: React.FC<TransactionHistoryProps> = ({
  transactions,
  currentAccountId,
}) => {
  if (!transactions || transactions.length === 0) {
    return (
      <div className="p-8 text-center text-xs text-slate-500">
        No recent transaction activity recorded for this account.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-xs">
        <thead className="bg-slate-950/70 border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider">
          <tr>
            <th className="py-3 px-4">Txn ID / Time</th>
            <th className="py-3 px-4">Flow</th>
            <th className="py-3 px-4">Counterparty</th>
            <th className="py-3 px-4">Amount</th>
            <th className="py-3 px-4">Channel &amp; Device</th>
            <th className="py-3 px-4">Forensic Flag</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800/50">
          {transactions.map((tx) => {
            const isOutbound = tx.sender_account_id === currentAccountId;
            const counterparty = isOutbound ? tx.receiver_account_id : tx.sender_account_id;

            return (
              <tr key={tx.txn_id} className="hover:bg-slate-800/30 transition-colors">
                <td className="py-3 px-4">
                  <span className="font-mono font-bold text-slate-200 block">{tx.txn_id}</span>
                  <span className="text-[11px] text-slate-500">{formatDate(tx.timestamp)}</span>
                </td>

                <td className="py-3 px-4">
                  {isOutbound ? (
                    <span className="inline-flex items-center gap-1 text-red-400 font-semibold">
                      <ArrowUpRight className="h-3.5 w-3.5" />
                      Debit Out
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-emerald-400 font-semibold">
                      <ArrowDownLeft className="h-3.5 w-3.5" />
                      Credit In
                    </span>
                  )}
                </td>

                <td className="py-3 px-4 font-mono font-medium text-slate-300">
                  {counterparty}
                </td>

                <td className="py-3 px-4">
                  <span
                    className={`font-mono font-bold text-sm ${
                      isOutbound ? "text-red-400" : "text-emerald-400"
                    }`}
                  >
                    {isOutbound ? "-" : "+"}
                    {formatCurrency(tx.amount)}
                  </span>
                </td>

                <td className="py-3 px-4 text-slate-300">
                  <Badge variant="outline" size="sm" className="font-mono text-[10px]">
                    {tx.channel}
                  </Badge>
                  {tx.device_id && (
                    <span className="flex items-center gap-1 text-[11px] text-slate-500 font-mono mt-0.5">
                      <Smartphone className="h-3 w-3" />
                      {tx.device_id}
                    </span>
                  )}
                </td>

                <td className="py-3 px-4">
                  {tx.is_flagged ? (
                    <Badge variant="destructive" size="sm" className="gap-1">
                      <AlertCircle className="h-3 w-3" />
                      {tx.tag || "Anomalous"}
                    </Badge>
                  ) : (
                    <span className="text-slate-500 text-[11px]">{tx.tag || "Verified"}</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
