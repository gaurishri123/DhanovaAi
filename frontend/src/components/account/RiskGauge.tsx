"use client";

import React from "react";
import { getRiskDetails } from "@/lib/utils";
import { ShieldAlert, AlertTriangle, ShieldCheck } from "lucide-react";

interface RiskGaugeProps {
  score: number;
}

export const RiskGauge: React.FC<RiskGaugeProps> = ({ score }) => {
  const risk = getRiskDetails(score);

  // Gauge calculation: semi-circle from -180 deg to 0 deg
  const radius = 80;
  const strokeWidth = 14;
  const normalizedScore = Math.max(0, Math.min(100, score));
  const circumference = Math.PI * radius; // Half-circle
  const strokeDashoffset = circumference - (normalizedScore / 100) * circumference;

  // Needle angle: 0 score = -180 deg (left), 100 score = 0 deg (right)
  const needleAngle = -180 + (normalizedScore / 100) * 180;

  return (
    <div className="flex flex-col items-center justify-center p-4">
      <div className="relative flex items-center justify-center">
        <svg width="220" height="130" viewBox="0 0 220 130" className="overflow-visible">
          {/* Background Track Arc */}
          <path
            d="M 20 110 A 80 80 0 0 1 200 110"
            fill="none"
            stroke="#1e293b"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />

          {/* Active Filled Arc with Gradient */}
          <path
            d="M 20 110 A 80 80 0 0 1 200 110"
            fill="none"
            stroke={risk.color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            className="transition-all duration-1000 ease-out"
            style={{
              filter: `drop-shadow(0 0 8px ${risk.color}88)`,
            }}
          />

          {/* Needle Center Pin */}
          <circle cx="110" cy="110" r="8" fill="#334155" stroke="#64748b" strokeWidth="2" />

          {/* Needle Pointer */}
          <g
            style={{
              transform: `rotate(${needleAngle}deg)`,
              transformOrigin: "110px 110px",
              transition: "transform 1s cubic-bezier(0.34, 1.56, 0.64, 1)",
            }}
          >
            <polygon points="107,110 113,110 110,40" fill={risk.color} />
            <circle cx="110" cy="40" r="2.5" fill="#ffffff" />
          </g>
        </svg>

        {/* Numeric Score Overlay in Center */}
        <div className="absolute bottom-0 flex flex-col items-center">
          <div className="flex items-baseline">
            <span
              className="text-4xl font-black font-mono tracking-tight"
              style={{ color: risk.color }}
            >
              {score}
            </span>
            <span className="text-slate-500 font-mono text-sm ml-0.5">/100</span>
          </div>
        </div>
      </div>

      {/* Label and Risk Level */}
      <div className="mt-3 flex flex-col items-center gap-1">
        <div
          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border ${risk.borderColor} ${risk.bgColor} ${risk.textColor}`}
        >
          {score >= 70 ? (
            <ShieldAlert className="h-3.5 w-3.5" />
          ) : score >= 40 ? (
            <AlertTriangle className="h-3.5 w-3.5" />
          ) : (
            <ShieldCheck className="h-3.5 w-3.5" />
          )}
          <span>{risk.label}</span>
        </div>
        <p className="text-[11px] text-slate-400 font-medium">
          {score >= 70
            ? "Mule syndicate activity identified"
            : score >= 40
            ? "Atypical transaction signals detected"
            : "Consistent benign payment activity"}
        </p>
      </div>
    </div>
  );
};
