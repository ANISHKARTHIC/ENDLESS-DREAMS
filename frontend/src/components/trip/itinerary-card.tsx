"use client";

import React, { useEffect, useMemo, useState } from "react";
import { cn, formatTime } from "@/lib/utils";
import { CategoryIcon } from "@/components/ui/category-icon";
import { api } from "@/lib/api";
import {
  Lock,
  Unlock,
  GripVertical,
  MapPin,
  Star,
  Clock,
  DollarSign,
  ImageOff,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import type { ItineraryItem } from "@/types";
import { motion } from "framer-motion";
import { useCurrency } from "@/contexts/currency-context";

interface ItineraryCardProps {
  item: ItineraryItem;
  index: number;
  dayColor: string;
  onToggleLock?: (itemId: string) => void;
  onStatusChange?: (itemId: string, status: string) => void;
  isDragging?: boolean;
  dragHandleProps?: Record<string, unknown>;
}

type PlacePhoto = { url: string };
const placePhotoCache: Record<string, PlacePhoto | null> = {};

export const CATEGORY_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  food:       { bg: "bg-orange-50 dark:bg-orange-950/20",   text: "text-orange-600 dark:text-orange-400",  dot: "#f97316" },
  culture:    { bg: "bg-amber-50 dark:bg-amber-950/20",     text: "text-amber-600 dark:text-amber-400",    dot: "#f59e0b" },
  nature:     { bg: "bg-emerald-50 dark:bg-emerald-950/20", text: "text-emerald-600 dark:text-emerald-400",dot: "#10b981" },
  adventure:  { bg: "bg-blue-50 dark:bg-blue-950/20",       text: "text-blue-600 dark:text-blue-400",      dot: "#3b82f6" },
  relaxation: { bg: "bg-purple-50 dark:bg-purple-950/20",   text: "text-purple-600 dark:text-purple-400",  dot: "#8b5cf6" },
  shopping:   { bg: "bg-pink-50 dark:bg-pink-950/20",       text: "text-pink-600 dark:text-pink-400",      dot: "#ec4899" },
  nightlife:  { bg: "bg-indigo-50 dark:bg-indigo-950/20",   text: "text-indigo-600 dark:text-indigo-400",  dot: "#6366f1" },
  landmark:   { bg: "bg-rose-50 dark:bg-rose-950/20",       text: "text-rose-600 dark:text-rose-400",      dot: "#f43f5e" },
  default:    { bg: "bg-slate-50 dark:bg-slate-900/30",     text: "text-slate-600 dark:text-slate-400",    dot: "#64748b" },
};

export const DAY_COLORS = [
  "#3b82f6","#8b5cf6","#ec4899","#f59e0b","#10b981",
  "#06b6d4","#ef4444","#84cc16","#f97316","#6366f1",
];

const STATUS_CONFIG: Record<string, { label: string; ring: string }> = {
  scheduled:   { label: "Planned",     ring: "ring-slate-300 dark:ring-slate-600" },
  in_progress: { label: "Live",        ring: "ring-blue-400" },
  completed:   { label: "Done",        ring: "ring-emerald-400" },
  skipped:     { label: "Skipped",     ring: "ring-gray-300 dark:ring-gray-600" },
  replanned:   { label: "Replanned",   ring: "ring-amber-400" },
};

const NEXT_STATUS: Record<string, string> = {
  scheduled:   "in_progress",
  in_progress: "completed",
  completed:   "scheduled",
  skipped:     "scheduled",
  replanned:   "scheduled",
};

export function ItineraryCard({
  item,
  index,
  dayColor,
  onToggleLock,
  onStatusChange,
  isDragging,
  dragHandleProps,
}: ItineraryCardProps) {
  const { convertFromUsd, symbol } = useCurrency();
  const cacheKey = useMemo(
    () => `${item.place.name.toLowerCase()}|${item.place.city.toLowerCase()}`,
    [item.place.name, item.place.city]
  );
  const [photo, setPhoto] = useState<PlacePhoto | null>(
    item.place.image_url ? { url: item.place.image_url } : placePhotoCache[cacheKey] ?? null
  );
  const [imgError, setImgError] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    let isMounted = true;
    if (item.place.image_url) {
      placePhotoCache[cacheKey] = { url: item.place.image_url };
      setPhoto({ url: item.place.image_url });
      return () => { isMounted = false; };
    }
    if (cacheKey in placePhotoCache) {
      setPhoto(placePhotoCache[cacheKey]);
      return () => { isMounted = false; };
    }
    api.getUnsplashPhotos({ place: item.place.name, city: item.place.city, count: 1 })
      .then((result) => {
        const first = result.photos?.[0];
        const resolved = first ? { url: first.url_regular || first.url_small || first.url_thumb || "" } : null;
        placePhotoCache[cacheKey] = resolved;
        if (isMounted) setPhoto(resolved);
      })
      .catch(() => {
        placePhotoCache[cacheKey] = null;
        if (isMounted) setPhoto(null);
      });
    return () => { isMounted = false; };
  }, [cacheKey, item.place.city, item.place.image_url, item.place.name]);

  const catKey = (item.place.category || "default").toLowerCase();
  const catColors = CATEGORY_COLORS[catKey] || CATEGORY_COLORS.default;
  const statusCfg = STATUS_CONFIG[item.status] || STATUS_CONFIG.scheduled;
  const durationH = Math.floor(item.duration_minutes / 60);
  const durationM = item.duration_minutes % 60;
  const cost = Number(item.estimated_cost_usd);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      className={cn(
        "group relative flex rounded-xl border bg-card overflow-hidden",
        "transition-all duration-200 hover:shadow-md hover:shadow-black/[0.06] dark:hover:shadow-black/20",
        isDragging && "shadow-2xl rotate-1 scale-[1.02] opacity-90 z-50",
        item.is_locked
          ? "border-amber-300/60 dark:border-amber-700/40"
          : "border-border/70 hover:border-border"
      )}
    >
      {/* Left category color bar */}
      <div
        className="w-[3px] shrink-0 transition-all duration-300 group-hover:w-1"
        style={{ backgroundColor: dayColor }}
      />

      {/* Main card content */}
      <div className="flex flex-1 min-w-0 px-3 py-2.5 gap-3">

        {/* Time column */}
        <div className="flex flex-col items-end shrink-0 w-[52px] select-none pt-0.5">
          <span className="text-[11px] font-bold text-foreground/90 tabular-nums leading-none">
            {formatTime(item.start_time)}
          </span>
          <div className="flex-1 w-px bg-border/40 my-1 self-center min-h-[12px]" />
          <span className="text-[10px] text-muted-foreground/60 tabular-nums leading-none">
            {formatTime(item.end_time)}
          </span>
        </div>

        {/* Status dot */}
        <div className="flex flex-col items-center shrink-0 w-3 mt-[3px]">
          <button
            onClick={() => onStatusChange?.(item.id, NEXT_STATUS[item.status] || "scheduled")}
            title={`Status: ${statusCfg.label} � click to advance`}
            className={cn(
              "h-3 w-3 rounded-full border-2 border-background shrink-0 transition-all duration-200",
              "ring-2 hover:scale-125 cursor-pointer",
              statusCfg.ring
            )}
            style={{ backgroundColor: dayColor }}
          />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Name row */}
          <div className="flex items-start gap-1.5">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 min-w-0">
                <CategoryIcon category={item.place.category} size="sm" />
                <h3 className="text-sm font-semibold text-foreground/95 leading-tight truncate">
                  {item.place.name}
                </h3>
                {item.is_locked && (
                  <Lock className="h-3 w-3 text-amber-500 shrink-0 ml-0.5" />
                )}
              </div>
              <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                <MapPin className="h-2.5 w-2.5 text-muted-foreground/40 shrink-0" />
                <span className="text-[10px] text-muted-foreground/60 truncate">{item.place.city}</span>
                {Number(item.place.rating) > 0 && (
                  <>
                    <span className="text-muted-foreground/30 text-[10px]">�</span>
                    <Star className="h-2.5 w-2.5 text-amber-400 fill-amber-400 shrink-0" />
                    <span className="text-[10px] text-muted-foreground/80">{Number(item.place.rating).toFixed(1)}</span>
                  </>
                )}
              </div>
            </div>
            {/* Drag handle */}
            {dragHandleProps && (
              <div
                {...dragHandleProps}
                className="shrink-0 cursor-grab active:cursor-grabbing text-muted-foreground/20 hover:text-muted-foreground/60 transition-colors p-0.5 mt-0.5"
              >
                <GripVertical className="h-4 w-4" />
              </div>
            )}
          </div>

          {/* Meta pills row */}
          <div className="flex items-center gap-1.5 mt-2 flex-wrap">
            <span className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded-full capitalize", catColors.bg, catColors.text)}>
              {item.place.category}
            </span>
            <span className={cn(
              "text-[10px] px-1.5 py-0.5 rounded-full font-medium",
              item.status === "completed" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" :
              item.status === "in_progress" ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" :
              item.status === "skipped" ? "bg-gray-100 text-gray-500 dark:bg-gray-800/40 dark:text-gray-400" :
              "bg-muted text-muted-foreground"
            )}>
              {statusCfg.label}
            </span>
            {item.duration_minutes > 0 && (
              <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground/70">
                <Clock className="h-2.5 w-2.5" />
                {durationH > 0 ? `${durationH}h ` : ""}{durationM > 0 ? `${durationM}m` : ""}
              </span>
            )}
            {cost > 0 && (
              <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground/70">
                <DollarSign className="h-2.5 w-2.5" />
                {symbol}{Math.round(convertFromUsd(cost)).toLocaleString()}
              </span>
            )}
            {Number(item.score) > 0 && (
              <span className="text-[10px] text-primary/60 font-medium ml-auto">
                AI {Number(item.score).toFixed(1)}
              </span>
            )}
          </div>

          {/* Description */}
          {item.place.description && (
            <div className="mt-1.5">
              <p className={cn("text-[11px] text-muted-foreground/80 leading-relaxed", !expanded && "line-clamp-2")}>
                {item.place.description}
              </p>
              {item.place.description.length > 100 && (
                <button
                  onClick={() => setExpanded(!expanded)}
                  className="flex items-center gap-0.5 text-[10px] text-primary/60 hover:text-primary mt-0.5 transition-colors"
                >
                  {expanded ? <><ChevronUp className="h-2.5 w-2.5" />Less</> : <><ChevronDown className="h-2.5 w-2.5" />More</>}
                </button>
              )}
            </div>
          )}
        </div>

        {/* Right side: photo + lock */}
        <div className="flex flex-col items-end justify-between shrink-0 gap-1.5">
          {photo?.url && !imgError ? (
            <div className="h-[60px] w-[60px] rounded-lg overflow-hidden border border-border/30 shrink-0">
              <img
                src={photo.url}
                alt={item.place.name}
                className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-500"
                onError={() => setImgError(true)}
                loading="lazy"
              />
            </div>
          ) : (
            <div className="h-[60px] w-[60px] rounded-lg bg-muted/40 flex items-center justify-center shrink-0">
              <ImageOff className="h-4 w-4 text-muted-foreground/20" />
            </div>
          )}
          <button
            onClick={() => onToggleLock?.(item.id)}
            className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-md hover:bg-muted text-muted-foreground/40 hover:text-foreground"
            title={item.is_locked ? "Unlock item" : "Lock item"}
          >
            {item.is_locked ? <Lock className="h-3 w-3 text-amber-500" /> : <Unlock className="h-3 w-3" />}
          </button>
        </div>
      </div>
    </motion.div>
  );
}
