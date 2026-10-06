import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { RingArchetype, RiskBand } from "@/types/account";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number): string {
  if (isNaN(amount)) return "₹0";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatCompactCurrency(amount: number): string {
  if (amount >= 10000000) {
    return `₹${(amount / 10000000).toFixed(2)} Cr`;
  }
  if (amount >= 100000) {
    return `₹${(amount / 100000).toFixed(2)} L`;
  }
  if (amount >= 1000) {
    return `₹${(amount / 1000).toFixed(1)}k`;
  }
  return `₹${amount.toFixed(0)}`;
}

export function formatDate(dateString: string): string {
  try {
    const d = new Date(dateString);
    return new Intl.DateTimeFormat("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    }).format(d);
  } catch {
    return dateString;
  }
}

export function formatTimeRemaining(expiryDateString: string): {
  days: number;
  hours: number;
  minutes: number;
  isExpired: boolean;
  text: string;
  percentRemaining: number;
} {
  const expiry = new Date(expiryDateString).getTime();
  const now = Date.now();
  const diff = expiry - now;

  if (diff <= 0) {
    return {
      days: 0,
      hours: 0,
      minutes: 0,
      isExpired: true,
      text: "Expired (Action Required)",
      percentRemaining: 0,
    };
  }

  const total60DaysMs = 60 * 24 * 60 * 60 * 1000;
  const percentRemaining = Math.max(0, Math.min(100, Math.round((diff / total60DaysMs) * 100)));

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  let text = "";
  if (days > 0) {
    text = `${days}d ${hours}h remaining`;
  } else if (hours > 0) {
    text = `${hours}h ${minutes}m remaining`;
  } else {
    text = `${minutes}m remaining`;
  }

  return {
    days,
    hours,
    minutes,
    isExpired: false,
    text,
    percentRemaining,
  };
}

export function getRiskDetails(score: number): {
  band: RiskBand;
  label: string;
  color: string;
  textColor: string;
  bgColor: string;
  borderColor: string;
  glowClass: string;
} {
  if (score >= 70) {
    return {
      band: "high",
      label: "HIGH RISK / MULE SUSPECT",
      color: "#ef4444",
      textColor: "text-red-400",
      bgColor: "bg-red-950/40",
      borderColor: "border-red-500/40",
      glowClass: "shadow-[0_0_20px_rgba(239,68,68,0.35)]",
    };
  }
  if (score >= 40) {
    return {
      band: "medium",
      label: "SUSPICIOUS / ELEVATED RISK",
      color: "#f59e0b",
      textColor: "text-amber-400",
      bgColor: "bg-amber-950/40",
      borderColor: "border-amber-500/40",
      glowClass: "shadow-[0_0_20px_rgba(245,158,11,0.3)]",
    };
  }
  return {
    band: "low",
    label: "LOW RISK / VERIFIED CLEAR",
    color: "#10b981",
    textColor: "text-emerald-400",
    bgColor: "bg-emerald-950/40",
    borderColor: "border-emerald-500/40",
    glowClass: "shadow-[0_0_20px_rgba(16,185,129,0.25)]",
  };
}

export function getArchetypeInfo(archetype: RingArchetype) {
  switch (archetype) {
    case "fan_out_dispersal":
      return {
        label: "Fan-out Dispersal",
        shortDesc: "1 source disperses large funds to multiple mules in minutes",
        color: "text-indigo-400 border-indigo-500/30 bg-indigo-950/40",
      };
    case "circular_layering":
      return {
        label: "Circular Layering",
        shortDesc: "Cyclical flow (A→B→C→D→A) designed to break audit trails",
        color: "text-cyan-400 border-cyan-500/30 bg-cyan-950/40",
      };
    case "device_farm":
      return {
        label: "Device Farm",
        shortDesc: "Multiple high-velocity accounts bound to single physical device",
        color: "text-purple-400 border-purple-500/30 bg-purple-950/40",
      };
    case "burst_mule":
      return {
        label: "Burst Mule",
        shortDesc: "New account with rapid transactions structured under ₹10,000",
        color: "text-amber-400 border-amber-500/30 bg-amber-950/40",
      };
    case "fan_in_collector":
      return {
        label: "Fan-in Collector",
        shortDesc: "Multiple mule feeds consolidating into a single cashout point",
        color: "text-rose-400 border-rose-500/30 bg-rose-950/40",
      };
  }
}
