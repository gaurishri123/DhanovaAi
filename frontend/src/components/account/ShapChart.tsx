"use client";

import React from "react";
import { ShapReason } from "@/types/account";
import { TrendingUp, TrendingDown, BarChart3 } from "lucide-react";

interface ShapChartProps {
  features: ShapReason[];
}

export const ShapChart: React.FC<ShapChartProps> = ({ features }) => {
  if (!features || features.length === 0) {
    return (
      <div className="p-6 text-center text-xs text-slate-500">
        No SHAP feature attribution data available for this account.
      </div>
    );
  }

  // Find max absolute contribution to normalize bar widths
  const maxAbsContrib = Math.max(...features.map((f) => Math.abs(f.contribution)), 0.1);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-xs text-slate-400">
        <div className="flex items-center gap-1.5 font-semibold text-slate-300">
          <BarChart3 className="h-4 w-4 text-blue-400" />
          <span>SHAP Feature Attribution (TreeExplainer)</span>
        </div>
        <div className="flex items-center gap-4 text-[11px]">
          <span className="flex items-center gap-1 text-red-400">
            <span className="h-2 w-2 rounded-full bg-red-500 inline-block" />
            Increases Risk (+)
          </span>
          <span className="flex items-center gap-1 text-emerald-400">
            <span className="h-2 w-2 rounded-full bg-emerald-500 inline-block" />
            Decreases Risk (-)
          </span>
        </div>
      </div>

      <div className="space-y-3">
        {features.map((feat, idx) => {
          const isIncrease = feat.direction === "increases_risk";
          const percentWidth = Math.min(100, Math.round((Math.abs(feat.contribution) / maxAbsContrib) * 100));

          return (
            <div
              key={idx}
              className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/80 hover:border-slate-700 transition-colors space-y-2"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono font-bold text-xs text-slate-200">
                      {feat.feature}
                    </span>
                    <span className="text-[10px] font-mono text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded">
                      val: {typeof feat.value === "number" ? feat.value.toFixed(2) : feat.value}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {feat.description || feat.feature.replace(/_/g, " ")}
                  </p>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {isIncrease ? (
                    <span className="flex items-center gap-1 text-xs font-mono font-bold text-red-400">
                      <TrendingUp className="h-3.5 w-3.5" />
                      +{feat.contribution.toFixed(3)}
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-xs font-mono font-bold text-emerald-400">
                      <TrendingDown className="h-3.5 w-3.5" />
                      {feat.contribution.toFixed(3)}
                    </span>
                  )}
                </div>
              </div>

              {/* Relative impact bar */}
              <div className="w-full h-1.5 bg-slate-800/80 rounded-full overflow-hidden flex">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${
                    isIncrease ? "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]" : "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"
                  }`}
                  style={{ width: `${percentWidth}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      <div className="p-3 rounded-lg bg-blue-950/30 border border-blue-900/40 text-[11px] text-blue-300/90 leading-relaxed">
        <strong>Explainability Note:</strong> Dhanova uses TreeSHAP feature attributions computed directly from
        the trained XGBoost classifier. Grounded in exact behavioral metrics (dwell time, structuring ratio, and
        nocturnal transfers) rather than unconstrained LLM hallucination.
      </div>
    </div>
  );
};
