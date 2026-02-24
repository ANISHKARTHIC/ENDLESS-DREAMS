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
  ChevronDown,
  ChevronUp,
  Ticket,
  Utensils,
  ShoppingBag,
  Zap,
  Sparkles,
  ImageOff,
  ArrowRight,
} from "lucide-react";
import type { ItineraryItem } from "@/types";
import { motion, AnimatePresence } from "framer-motion";
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

export const CATEGORY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  food:        { bg: "bg-orange-100/80 dark:bg-orange-900/30", text: "text-orange-700 dark:text-orange-300", border: "border-orange-200 dark:border-orange-800/40" },
  culture:     { bg: "bg-amber-100/80 dark:bg-amber-900/30",   text: "text-amber-700 dark:text-amber-300",   border: "border-amber-200 dark:border-amber-800/40" },
  nature:      { bg: "bg-emerald-100/80 dark:bg-emerald-900/30", text: "text-emerald-700 dark:text-emerald-300", border: "border-emerald-200 dark:border-emerald-800/40" },
  adventure:   { bg: "bg-blue-100/80 dark:bg-blue-900/30",     text: "text-blue-700 dark:text-blue-300",     border: "border-blue-200 dark:border-blue-800/40" },
  relaxation:  { bg: "bg-purple-100/80 dark:bg-purple-900/30", text: "text-purple-700 dark:text-purple-300", border: "border-purple-200 dark:border-purple-800/40" },
  shopping:    { bg: "bg-pink-100/80 dark:bg-pink-900/30",     text: "text-pink-700 dark:text-pink-300",     border: "border-pink-200 dark:border-pink-800/40" },
  nightlife:   { bg: "bg-indigo-100/80 dark:bg-indigo-900/30", text: "text-indigo-700 dark:text-indigo-300", border: "border-indigo-200 dark:border-indigo-800/40" },
  landmark:    { bg: "bg-rose-100/80 dark:bg-rose-900/30",     text: "text-rose-700 dark:text-rose-300",     border: "border-rose-200 dark:border-rose-800/40" },
  default:     { bg: "bg-slate-100/80 dark:bg-slate-800/40",   text: "text-slate-600 dark:text-slate-400",   border: "border-slate-200 dark:border-slate-700/40" },
};

export const DAY_COLORS = [
  "#3b82f6","#8b5cf6","#ec4899","#f59e0b","#10b981",
  "#06b6d4","#ef4444","#84cc16","#f97316","#6366f1",
];

const STATUS_CONFIG: Record<string, { label: string; color: string; pulse?: boolean }> = {
  scheduled:   { label: "Planned",   color: "bg-slate-400 dark:bg-slate-500" },
  in_progress: { label: "Live",      color: "bg-blue-500", pulse: true },
  completed:   { label: "Done",      color: "bg-emerald-500" },
  skipped:     { label: "Skipped",   color: "bg-gray-300 dark:bg-gray-600" },
  replanned:   { label: "Replanned", color: "bg-amber-400" },
};

const NEXT_STATUS: Record<string, string> = {
  scheduled:   "in_progress",
  in_progress: "completed",
  completed:   "scheduled",
  skipped:     "scheduled",
  replanned:   "scheduled",
};

function getPriceLabel(category: string): { label: string; icon: React.ReactNode } {
  const cat = category.toLowerCase();
  if (["food", "cafe", "restaurant", "dining"].includes(cat))
    return { label: "Per person", icon: <Utensils className="h-2.5 w-2.5" /> };
  if (["landmark", "culture", "museum", "heritage", "monument"].includes(cat))
    return { label: "Entry fee", icon: <Ticket className="h-2.5 w-2.5" /> };
  if (["adventure", "sport", "activity"].includes(cat))
    return { label: "Per person", icon: <Zap className="h-2.5 w-2.5" /> };
  if (["relaxation", "spa", "wellness"].includes(cat))
    return { label: "Per session", icon: <Sparkles className="h-2.5 w-2.5" /> };
  if (["shopping"].includes(cat))
    return { label: "Avg spend", icon: <ShoppingBag className="h-2.5 w-2.5" /> };
  if (["nightlife", "bar", "club"].includes(cat))
    return { label: "Cover charge", icon: <Ticket className="h-2.5 w-2.5" /> };
  return { label: "Est. cost", icon: <Ticket className="h-2.5 w-2.5" /> };
}

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
    item.place.image_url ? { url: item.place.image_url } : (placePhotoCache[cacheKey] ?? null)
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
        const resolved = first
          ? { url: first.url_regular || first.url_small || first.url_thumb || "" }
          : null;
        placePhotoCache[cacheKey] = resolved;
        if (isMounted) setPhoto(resolved);
      })
      .catch(() => {
        placePhotoCache[cacheKey] = null;
        if (isMounted) setPhoto(null);
      });
    return () => { isMounted = false; };
  }, [cacheKey, item.place.city, item.place.image_url, item.place.name]);

  const catKey    = (item.place.category || "default").toLowerCase();
  const catColors = CATEGORY_COLORS[catKey] || CATEGORY_COLORS.default;
  const statusCfg = STATUS_CONFIG[item.status] || STATUS_CONFIG.scheduled;
  const durationH = Math.floor(item.duration_minutes / 60);
  const durationM = item.duration_minutes % 60;
  const cost      = Number(item.estimated_cost_usd);
  const priceInfo = getPriceLabel(catKey);
  const hasPhoto  = photo?.url && !imgError;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.18 }}
      className={cn(
        "group relative rounded-2xl border bg-card overflow-hidden",
        "transition-all duration-200 hover:shadow-lg hover:shadow-black/[0.07] dark:hover:shadow-black/25",
        isDragging && "shadow-2xl rotate-[0.8deg] scale-[1.02] opacity-90 z-50",
        item.is_locked
          ? "border-amber-300/50 dark:border-amber-700/30"
          : "border-border/60 hover:border-border/90"
      )}
    >
      {/* Top accent line */}
      <div className="h-[2px] w-full" style={{ backgroundColor: dayColor }} />

      {/* Photo banner */}
      <div className="relative w-full h-[130px] bg-muted/30 overflow-hidden">
        {hasPhoto ? (
          <img
            src={photo!.url}
            alt={item.place.name}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
            onError={() => setImgError(true)}
            loading="lazy"
          />
        ) : (
          <div className="h-full w-full flex items-center justify-center bg-gradient-to-br from-muted/60 to-muted/20">
            <ImageOff className="h-7 w-7 text-muted-foreground/15" />
          </div>
        )}

        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent" />

        {/* Index badge */}
        <div
          className="absolute top-2.5 left-2.5 h-6 w-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold shadow-md"
          style={{ backgroundColor: dayColor }}
        >
          {index}
        </div>

        {/* Drag + lock */}
        <div className="absolute top-2 right-2 flex items-center gap-1">
          {dragHandleProps && (
            <div
              {...dragHandleProps}
              className="p-1 rounded-lg bg-black/30 backdrop-blur-sm text-white/70 hover:text-white cursor-grab active:cursor-grabbing transition-colors"
            >
              <GripVertical className="h-3.5 w-3.5" />
            </div>
          )}
          <button
            onClick={() => onToggleLock?.(item.id)}
            className="p-1 rounded-lg bg-black/30 backdrop-blur-sm text-white/70 hover:text-white transition-colors opacity-0 group-hover:opacity-100"
            title={item.is_locked ? "Unlock" : "Lock"}
          >
            {item.is_locked
              ? <Lock className="h-3.5 w-3.5 text-amber-300" />
              : <Unlock className="h-3.5 w-3.5" />}
          </button>
        </div>

        {/* Time range */}
        <div className="absolute bottom-2.5 left-3 flex items-center gap-1.5">
          <span className="text-[11px] font-semibold text-white tabular-nums drop-shadow">
            {formatTime(item.start_time)}
          </span>
          <ArrowRight className="h-2.5 w-2.5 text-white/50" />
          <span className="text-[10px] text-white/70 tabular-nums drop-shadow">
            {formatTime(item.end_time)}
          </span>
        </div>

        {/* Status pill */}
        <button
          onClick={() => onStatusChange?.(item.id, NEXT_STATUS[item.status] || "scheduled")}
          className="absolute bottom-2.5 right-3 flex items-center gap-1 px-2 py-0.5 rounded-full bg-black/30 backdrop-blur-sm hover:bg-black/50 transition-colors"
          title={`${statusCfg.label} -- click to advance`}
        >
          <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", statusCfg.color, statusCfg.pulse && "animate-pulse")} />
          <span className="text-[10px] text-white/90 font-medium">{statusCfg.label}</span>
        </button>
      </div>

      {/* Card body */}
      <div className="px-3.5 pt-2.5 pb-3">
        {/* Name row */}
        <div className="flex items-start gap-2 min-w-0">
          <CategoryIcon category={item.place.category} size="sm" />
          <div className="flex-1 min-w-0">
            <h3 className="text-[13px] font-semibold text-foreground leading-snug truncate">
              {item.place.name}
              {item.is_locked && <Lock className="inline h-2.5 w-2.5 text-amber-500 ml-1 mb-0.5" />}
            </h3>
            <div className="flex items-center gap-1 mt-0.5 flex-wrap">
              <MapPin className="h-2.5 w-2.5 text-muted-foreground/40 shrink-0" />
              <span className="text-[10px] text-muted-foreground/60 truncate">{item.place.city}</span>
              {Number(item.place.rating) > 0 && (
                <>
                  <span className="text-muted-foreground/25 text-[9px]">&#183;</span>
                  <Star className="h-2.5 w-2.5 text-amber-400 fill-amber-400 shrink-0" />
                  <span className="text-[10px] text-muted-foreground/80 font-medium">
                    {Number(item.place.rating).toFixed(1)}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="my-2 h-px bg-border/40" />

        {/* Stats row */}
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className={cn(
              "inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-medium border capitalize",
              catColors.bg, catColors.text, catColors.border
            )}
          >
            {item.place.category}
          </span>

          {item.duration_minutes > 0 && (
            <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground/70">
              <Clock className="h-2.5 w-2.5 shrink-0" />
              {durationH > 0 ? `${durationH}h` : ""}{durationM > 0 ? ` ${durationM}m` : ""}
            </span>
          )}

          {cost > 0 ? (
            <span className="inline-flex items-center gap-1 ml-auto">
              <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground/50">
                {priceInfo.icon}
                <span>{priceInfo.label}:</span>
              </span>
              <span className="text-[11px] font-semibold text-foreground/80">
                {symbol}{Math.round(convertFromUsd(cost)).toLocaleString()}
              </span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-0.5 ml-auto text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
              <Sparkles className="h-2.5 w-2.5" />
              Free
            </span>
          )}
        </div>

        {/* Description */}
        {item.place.description && (
          <div className="mt-2">
            <AnimatePresence initial={false}>
              <p className={cn("text-[11px] text-muted-foreground/70 leading-relaxed", !expanded && "line-clamp-2")}>
                {item.place.description}
              </p>
            </AnimatePresence>
            {item.place.description.length > 90 && (
              <button
                onClick={() => setExpanded(!expanded)}
                className="flex items-center gap-0.5 text-[10px] text-primary/50 hover:text-primary mt-0.5 transition-colors"
              >
                {expanded
                  ? <><ChevronUp className="h-2.5 w-2.5" />Show less</>
                  : <><ChevronDown className="h-2.5 w-2.5" />Show more</>}
              </button>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}