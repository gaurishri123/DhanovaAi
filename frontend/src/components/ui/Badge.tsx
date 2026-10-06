import React from "react";
import { cn } from "@/lib/utils";

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "secondary" | "destructive" | "outline" | "success" | "warning" | "cyan" | "purple";
  size?: "sm" | "md" | "lg";
}

export const Badge: React.FC<BadgeProps> = ({
  className,
  variant = "default",
  size = "sm",
  children,
  ...props
}) => {
  const variantStyles = {
    default: "bg-blue-600/20 text-blue-300 border-blue-500/30",
    secondary: "bg-slate-800 text-slate-300 border-slate-700",
    destructive: "bg-red-500/20 text-red-300 border-red-500/30 shadow-[0_0_10px_rgba(239,68,68,0.2)]",
    outline: "text-slate-300 border-slate-700 bg-transparent",
    success: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30 shadow-[0_0_10px_rgba(16,185,129,0.2)]",
    warning: "bg-amber-500/20 text-amber-300 border-amber-500/30 shadow-[0_0_10px_rgba(245,158,11,0.2)]",
    cyan: "bg-cyan-500/20 text-cyan-300 border-cyan-500/30 shadow-[0_0_10px_rgba(6,182,212,0.2)]",
    purple: "bg-purple-500/20 text-purple-300 border-purple-500/30 shadow-[0_0_10px_rgba(168,85,247,0.2)]",
  };

  const sizeStyles = {
    sm: "px-2 py-0.5 text-xs font-medium",
    md: "px-2.5 py-1 text-xs font-semibold tracking-wide",
    lg: "px-3 py-1.5 text-sm font-bold tracking-wide",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border transition-colors",
        variantStyles[variant],
        sizeStyles[size],
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
};
