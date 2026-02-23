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
  spent: number;
  total: number;
  currency?: string;
}

export function BudgetProgress({
  spent,
  total,
  currency = "$",
}: BudgetProgressProps) {
  const percentage = (spent / total) * 100;
  const variant =
    percentage > 90 ? "danger" : percentage > 70 ? "warning" : "gradient";

  return (
    <div className="space-y-2">
      <div className="flex justify-between items-baseline">
        <span className="text-sm font-medium text-foreground">Budget</span>
        <div className="text-right">
          <span className="text-lg font-bold text-foreground">
            {currency}
            {spent.toLocaleString()}
          </span>
          <span className="text-sm text-muted-foreground">
            {" "}
            / {currency}
            {total.toLocaleString()}
          </span>
        </div>
      </div>
      <Progress value={spent} max={total} variant={variant} size="md" />
      <p className="text-xs text-muted-foreground text-right">
        {currency}
        {(total - spent).toLocaleString()} remaining
      </p>
    </div>
  );
}
