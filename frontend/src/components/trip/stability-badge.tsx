"use client";

import React from "react";
import { cn, getStabilityColor, getStabilityBg } from "@/lib/utils";
import { Shield, TrendingUp, Cloud, Clock } from "lucide-react";
import type { TripHealth } from "@/types";
import { motion } from "framer-motion";

interface StabilityBadgeProps {
  health: TripHealth;
  size?: "sm" | "md" | "lg";
  showDetails?: boolean;
}

export function StabilityBadge({
  health,
  size = "md",
  showDetails = false,
}: StabilityBadgeProps) {
  const percentage = Math.round(health.stability_index * 100);
  const color = getStabilityColor(health.stability_index);
  const bg = getStabilityBg(health.stability_index);

  const statusLabels: Record<string, string> = {
    excellent: "Excellent",
    good: "Good",
    fair: "Fair",
    poor: "Poor",
    critical: "Critical",
  };

  return (
    <div className="space-y-3">
      <div
        className={cn(
          "inline-flex items-center gap-2 rounded-full px-3 py-1.5",
          bg
        )}
      >
        <Shield className={cn("h-4 w-4", color)} />
        <span className={cn("font-semibold text-sm", color)}>
          {percentage}%
        </span>
        <span className={cn("text-xs", color)}>
          {statusLabels[health.status]}
        </span>
      </div>

      {showDetails && health.components && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="grid grid-cols-2 gap-2"
        >
          <HealthComponent
            icon={<TrendingUp className="h-3.5 w-3.5" />}
            label="Budget"
            value={health.components.budget_health}
          />
          <HealthComponent
            icon={<Shield className="h-3.5 w-3.5" />}
            label="Risk"
            value={health.components.risk_health}
          />
          <HealthComponent
            icon={<Cloud className="h-3.5 w-3.5" />}
            label="Weather"
            value={health.components.weather_health}
          />
          <HealthComponent
            icon={<Clock className="h-3.5 w-3.5" />}
            label="Schedule"
            value={health.components.time_buffer_health}
          />
        </motion.div>
      )}
    </div>
  );
}

function HealthComponent({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  const pct = Math.round(value * 100);
  const color = getStabilityColor(value);

  return (
    <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
      <span className={color}>{icon}</span>
      <div className="flex-1 min-w-0">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className={cn("text-sm font-medium", color)}>{pct}%</div>
      </div>
    </div>
  );
}
