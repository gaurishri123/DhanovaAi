import React from "react";
import { cn } from "@/lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  icon?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = "text", icon, ...props }, ref) => {
    return (
      <div className="relative w-full">
        {icon && (
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
            {icon}
          </div>
        )}
        <input
          type={type}
          ref={ref}
          className={cn(
            "flex h-9 w-full rounded-lg border border-slate-700/80 bg-slate-900/80 px-3 py-1 text-sm text-slate-100 placeholder:text-slate-500 shadow-inner focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:border-transparent disabled:cursor-not-allowed disabled:opacity-50 transition-colors",
            icon && "pl-9",
            className
          )}
          {...props}
        />
      </div>
    );
  }
);

Input.displayName = "Input";
