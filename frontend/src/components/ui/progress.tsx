"use client";

import React from "react";
import { cn } from "@/lib/utils";

interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value: number;
  max?: number;
  variant?: "default" | "success" | "warning" | "danger" | "gradient";
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
  label?: string;
}

const variantClasses: Record<string, string> = {
  default: "bg-primary",
  success: "bg-emerald-500",
  warning: "bg-amber-500",
  danger: "bg-red-500",
  gradient: "bg-gradient-to-r from-primary via-accent to-emerald-500",
};

const sizeClasses: Record<string, string> = {
  sm: "h-1.5",
  md: "h-2.5",
  lg: "h-4",
};

export function Progress({
  value,
  max = 100,
  variant = "default",
  size = "md",
  showLabel = false,
  label,
  className,
  ...props
}: ProgressProps) {
  const percentage = Math.min(Math.max((value / max) * 100, 0), 100);

  return (
    <div className={cn("w-full", className)} {...props}>
      {(showLabel || label) && (
        <div className="flex justify-between items-center mb-1.5">
          {label && (
            <span className="text-sm font-medium text-foreground">{label}</span>
          )}
          {showLabel && (
            <span className="text-xs text-muted-foreground">
              {Math.round(percentage)}%
            </span>
          )}
        </div>
      )}
      <div
        className={cn(
          "w-full rounded-full bg-muted overflow-hidden",
          sizeClasses[size]
        )}
      >
        <div
          className={cn(
            "h-full rounded-full transition-all duration-700 ease-out",
            variantClasses[variant]
          )}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

interface BudgetProgressProps {
  spent: string | number;
  total: string | number;
  currency?: string;
}

export function BudgetProgress({
  spent: spentRaw,
  total: totalRaw,
  currency = "$",
}: BudgetProgressProps) {
  const spent = Number(spentRaw);
  const total = Number(totalRaw);
  const percentage = total > 0 ? Math.min((spent / total) * 100, 100) : 0;
  const remaining = Math.max(total - spent, 0);

  const statusColor =
    percentage > 90
      ? "text-red-500"
      : percentage > 70
      ? "text-amber-500"
      : "text-emerald-500";

  const barVariant =
    percentage > 90 ? "danger" : percentage > 70 ? "warning" : "gradient";

  const statusLabel =
    percentage > 90 ? "Over budget" : percentage > 70 ? "Watch your spend" : "On track";

  return (
    <div className="space-y-2">
      <div className="flex items-end justify-between">
        <div>
          <span className="text-sm font-semibold text-foreground">Budget</span>
          <span className={cn("ml-2 text-xs font-medium", statusColor)}>
            · {statusLabel}
          </span>
        </div>
        <div className="text-right leading-tight">
          <span className="text-lg font-bold text-foreground tabular-nums">
            {currency}{Math.round(spent).toLocaleString()}
          </span>
          <span className="text-sm text-muted-foreground">
            {" / "}{currency}{Math.round(total).toLocaleString()}
          </span>
        </div>
      </div>
      <div className="relative h-2.5 w-full rounded-full bg-muted overflow-hidden">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-1000 ease-out",
            variantClasses[barVariant]
          )}
          style={{ width: `${percentage}%` }}
        />
        {/* Subtle shimmer on the bar */}
        {percentage > 0 && percentage < 100 && (
          <div
            className="absolute inset-y-0 left-0 rounded-full opacity-25"
            style={{
              width: `${percentage}%`,
              background:
                "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.5) 50%, transparent 100%)",
              backgroundSize: "200% 100%",
              animation: "shimmer-bar 2s linear infinite",
            }}
          />
        )}
      </div>
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{Math.round(percentage)}% used</span>
        <span className={cn("font-medium", remaining === 0 ? "text-red-500" : "text-muted-foreground")}>
          {currency}{Math.round(remaining).toLocaleString()} left
        </span>
      </div>
    </div>
  );
}
