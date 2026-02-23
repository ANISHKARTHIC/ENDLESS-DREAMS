"use client";

import React from "react";
import { cn, formatTime, getCategoryIcon, getCategoryColor } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  Clock,
  DollarSign,
  Lock,
  Unlock,
  GripVertical,
  MapPin,
  Star,
} from "lucide-react";
import type { ItineraryItem } from "@/types";
import { motion } from "framer-motion";

interface ItineraryCardProps {
  item: ItineraryItem;
  onToggleLock?: (itemId: string) => void;
  isDragging?: boolean;
  dragHandleProps?: Record<string, unknown>;
}

export function ItineraryCard({
  item,
  onToggleLock,
  isDragging,
  dragHandleProps,
}: ItineraryCardProps) {
  const statusColors: Record<string, string> = {
    scheduled: "default",
    in_progress: "info",
    completed: "success",
    skipped: "outline",
    replanned: "warning",
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "group relative rounded-2xl border border-border bg-card p-4 transition-all duration-200",
        "hover:shadow-lg hover:shadow-black/5 dark:hover:shadow-black/20 hover:border-primary/20",
        isDragging && "shadow-xl border-primary/30 rotate-1 scale-[1.02]",
        item.is_locked && "border-amber-500/30 bg-amber-500/5"
      )}
    >
      <div className="flex items-start gap-3">
        {/* Drag handle */}
        {dragHandleProps && (
          <div
            {...dragHandleProps}
            className="mt-1 cursor-grab active:cursor-grabbing text-muted-foreground/40 hover:text-muted-foreground transition"
          >
            <GripVertical className="h-5 w-5" />
          </div>
        )}

        {/* Time column */}
        <div className="flex flex-col items-center shrink-0 w-16">
          <span className="text-sm font-semibold text-foreground">
            {formatTime(item.start_time)}
          </span>
          <div className="h-8 w-px bg-border my-1" />
          <span className="text-xs text-muted-foreground">
            {formatTime(item.end_time)}
          </span>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-lg">
                  {getCategoryIcon(item.place.category)}
                </span>
                <h3 className="font-semibold text-foreground truncate">
                  {item.place.name}
                </h3>
              </div>
              <div className="flex items-center gap-3 mt-1.5">
                <span
                  className={cn(
                    "text-xs px-2 py-0.5 rounded-full",
                    getCategoryColor(item.place.category)
                  )}
                >
                  {item.place.category}
                </span>
                <Badge
                  variant={
                    statusColors[item.status] as
                      | "default"
                      | "success"
                      | "warning"
                      | "danger"
                      | "info"
                      | "outline"
                  }
                >
                  {item.status}
                </Badge>
              </div>
            </div>

            {/* Lock toggle */}
            {onToggleLock && (
              <button
                onClick={() => onToggleLock(item.id)}
                className={cn(
                  "p-1.5 rounded-lg transition-all",
                  item.is_locked
                    ? "text-amber-500 hover:bg-amber-500/10"
                    : "text-muted-foreground/40 hover:text-muted-foreground hover:bg-muted"
                )}
                title={item.is_locked ? "Unlock item" : "Lock item"}
              >
                {item.is_locked ? (
                  <Lock className="h-4 w-4" />
                ) : (
                  <Unlock className="h-4 w-4" />
                )}
              </button>
            )}
          </div>

          {/* Meta row */}
          <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              <span>{item.duration_minutes}m</span>
            </div>
            <div className="flex items-center gap-1">
              <DollarSign className="h-3.5 w-3.5" />
              <span>${item.estimated_cost_usd}</span>
            </div>
            {item.place.rating > 0 && (
              <div className="flex items-center gap-1">
                <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                <span>{item.place.rating.toFixed(1)}</span>
              </div>
            )}
            {item.travel_time_minutes > 0 && (
              <div className="flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" />
                <span>{item.travel_time_minutes}m travel</span>
              </div>
            )}
          </div>

          {/* Score bar */}
          <div className="mt-3">
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-muted-foreground">AI Score</span>
              <span className="font-medium text-primary">
                {(item.score * 100).toFixed(0)}
              </span>
            </div>
            <div className="h-1 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-primary to-accent transition-all duration-500"
                style={{ width: `${Math.min(item.score * 100, 100)}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
