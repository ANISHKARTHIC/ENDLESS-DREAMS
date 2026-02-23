"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { AlertTriangle, Zap, Cloud, Ban, Clock, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { ReplanEvent } from "@/types";
import { motion, AnimatePresence } from "framer-motion";

interface ReplanEventsPanelProps {
  events: ReplanEvent[];
  className?: string;
}

const triggerIcons: Record<string, React.ReactNode> = {
  weather: <Cloud className="h-4 w-4" />,
  traffic: <Zap className="h-4 w-4" />,
  closure: <Ban className="h-4 w-4" />,
  user: <User className="h-4 w-4" />,
  schedule: <Clock className="h-4 w-4" />,
};

const severityVariants: Record<string, "default" | "info" | "warning" | "danger"> = {
  low: "default",
  medium: "info",
  high: "warning",
  critical: "danger",
};

export function ReplanEventsPanel({ events, className }: ReplanEventsPanelProps) {
  if (!events.length) {
    return (
      <div className={cn("glass-card p-6 text-center", className)}>
        <div className="h-12 w-12 rounded-xl bg-success/10 flex items-center justify-center mx-auto mb-3">
          <Zap className="h-6 w-6 text-success" />
        </div>
        <p className="font-medium text-foreground">All Clear</p>
        <p className="text-sm text-muted-foreground mt-1">
          No replanning events detected
        </p>
      </div>
    );
  }

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center gap-2 mb-2">
        <AlertTriangle className="h-4 w-4 text-warning" />
        <h3 className="font-semibold text-foreground text-sm">
          Replan Events ({events.length})
        </h3>
      </div>
      <AnimatePresence>
        {events.map((event, idx) => (
          <motion.div
            key={event.id}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 10 }}
            transition={{ delay: idx * 0.05 }}
            className={cn(
              "p-4 rounded-xl border border-border bg-card",
              event.severity === "critical" && "border-red-500/30 bg-red-500/5",
              event.severity === "high" && "border-amber-500/20 bg-amber-500/5"
            )}
          >
            <div className="flex items-start gap-3">
              <div className="mt-0.5 text-muted-foreground">
                {triggerIcons[event.trigger_type] || <Zap className="h-4 w-4" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant={severityVariants[event.severity]}>
                    {event.severity}
                  </Badge>
                  <span className="text-xs text-muted-foreground capitalize">
                    {event.trigger_type}
                  </span>
                  {event.was_applied && (
                    <span className="text-xs text-success font-medium">Applied</span>
                  )}
                </div>
                <p className="text-sm text-foreground">{event.description}</p>
                {event.affected_items.length > 0 && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {event.affected_items.length} item(s) affected
                  </p>
                )}
              </div>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
