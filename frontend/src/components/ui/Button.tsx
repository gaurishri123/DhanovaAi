import React from "react";
import { cn } from "@/lib/utils";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link" | "success";
  size?: "sm" | "md" | "lg" | "icon";
  isLoading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "md", isLoading, children, disabled, ...props }, ref) => {
    const variantStyles = {
      default:
        "bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-900/30 border border-blue-500/40 active:translate-y-0.5",
      destructive:
        "bg-red-600 hover:bg-red-500 text-white shadow-md shadow-red-900/30 border border-red-500/40 active:translate-y-0.5",
      outline:
        "border border-slate-700 hover:border-slate-500 bg-slate-900/60 hover:bg-slate-800/80 text-slate-200 active:translate-y-0.5",
      secondary:
        "bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700 active:translate-y-0.5",
      ghost: "hover:bg-slate-800/60 text-slate-300 hover:text-white",
      link: "text-blue-400 underline-offset-4 hover:underline p-0 h-auto",
      success:
        "bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-900/30 border border-emerald-500/40 active:translate-y-0.5",
    };

    const sizeStyles = {
      sm: "h-8 px-3 text-xs rounded-md",
      md: "h-9 px-4 py-2 text-sm rounded-lg",
      lg: "h-11 px-6 py-3 text-base rounded-lg font-medium",
      icon: "h-9 w-9 p-0 rounded-lg justify-center",
    };

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={cn(
          "inline-flex items-center justify-center font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:pointer-events-none disabled:opacity-50 select-none cursor-pointer",
          variantStyles[variant],
          sizeStyles[size],
          className
        )}
        {...props}
      >
        {isLoading ? (
          <span className="flex items-center gap-2">
            <svg
              className="animate-spin -ml-1 mr-1 h-4 w-4 text-current"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              ></circle>
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
            <span>Processing...</span>
          </span>
        ) : (
          children
        )}
      </button>
    );
  }
);

Button.displayName = "Button";
