"use client";

import React, { useEffect, useMemo, useState } from "react";
import { cn, formatTime } from "@/lib/utils";
import { CategoryIcon } from "@/components/ui/category-icon";
import { api } from "@/lib/api";
import {
  Lock,
  Unlock,
  GripVertical,
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
  TrendingUp,
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

export const CATEGORY_COLORS: Record<string, { bg: string; text: string }> = {
  food:        { bg: "bg-orange-100 dark:bg-orange-900/30",   text: "text-orange-700 dark:text-orange-300" },
  culture:     { bg: "bg-amber-100 dark:bg-amber-900/30",     text: "text-amber-700 dark:text-amber-300" },
  nature:      { bg: "bg-emerald-100 dark:bg-emerald-900/30", text: "text-emerald-700 dark:text-emerald-300" },
  adventure:   { bg: "bg-blue-100 dark:bg-blue-900/30",       text: "text-blue-700 dark:text-blue-300" },
  relaxation:  { bg: "bg-purple-100 dark:bg-purple-900/30",   text: "text-purple-700 dark:text-purple-300" },
  shopping:    { bg: "bg-pink-100 dark:bg-pink-900/30",       text: "text-pink-700 dark:text-pink-300" },
  nightlife:   { bg: "bg-indigo-100 dark:bg-indigo-900/30",   text: "text-indigo-700 dark:text-indigo-300" },
  landmark:    { bg: "bg-rose-100 dark:bg-rose-900/30",       text: "text-rose-700 dark:text-rose-300" },
  default:     { bg: "bg-slate-100 dark:bg-slate-800/50",     text: "text-slate-600 dark:text-slate-400" },
};

export const DAY_COLORS = [
  "#3b82f6","#8b5cf6","#ec4899","#f59e0b","#10b981",
  "#06b6d4","#ef4444","#84cc16","#f97316","#6366f1",
];

const STATUS_CONFIG: Record<string, { label: string; dotClass: string; textClass: string }> = {
  scheduled:   { label: "scheduled",  dotClass: "bg-slate-400",               textClass: "text-slate-500 dark:text-slate-400" },
  in_progress: { label: "live",       dotClass: "bg-blue-500 animate-pulse",  textClass: "text-blue-600 dark:text-blue-400" },
  completed:   { label: "done",       dotClass: "bg-emerald-500",             textClass: "text-emerald-600 dark:text-emerald-400" },
  skipped:     { label: "skipped",    dotClass: "bg-gray-300 dark:bg-gray-600", textClass: "text-gray-400 dark:text-gray-500" },
  replanned:   { label: "replanned",  dotClass: "bg-amber-400",               textClass: "text-amber-600 dark:text-amber-400" },
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
    return { label: "per person", icon: <Utensils className="h-3 w-3" /> };
  if (["landmark", "culture", "museum", "heritage", "monument"].includes(cat))
    return { label: "entry", icon: <Ticket className="h-3 w-3" /> };
  if (["adventure", "sport", "activity"].includes(cat))
    return { label: "per person", icon: <Zap className="h-3 w-3" /> };
  if (["relaxation", "spa", "wellness"].includes(cat))
    return { label: "per session", icon: <Sparkles className="h-3 w-3" /> };
  if (["shopping"].includes(cat))
    return { label: "avg spend", icon: <ShoppingBag className="h-3 w-3" /> };
  return { label: "est. cost", icon: <Ticket className="h-3 w-3" /> };
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

  const catKey     = (item.place.category || "default").toLowerCase();
  const catColors  = CATEGORY_COLORS[catKey] || CATEGORY_COLORS.default;
  const statusCfg  = STATUS_CONFIG[item.status] || STATUS_CONFIG.scheduled;
  const durationH  = Math.floor(item.duration_minutes / 60);
  const durationM  = item.duration_minutes % 60;
  const cost       = Number(item.estimated_cost_usd);
  const rating     = Number(item.place.rating);
  const aiScore    = Number(item.score);
  const priceInfo  = getPriceLabel(catKey);
  const hasPhoto   = photo?.url && !imgError;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.16 }}
      className={cn(
        "group relative flex gap-0 rounded-xl border bg-card overflow-hidden",
        "transition-all duration-200 hover:shadow-lg hover:shadow-black/[0.08] dark:hover:shadow-black/25",
        isDragging && "shadow-2xl scale-[1.01] opacity-95 z-50",
        item.is_locked
          ? "border-amber-300/50 dark:border-amber-700/30"
          : "border-border/50 hover:border-border/80"
      )}
    >
      {/* ── Left: drag + time ── */}
      <div className="flex flex-col items-center gap-1 pt-2.5 pb-2.5 px-2 shrink-0 w-[58px]">
        {/* Drag handle */}
        <div
          {...(dragHandleProps || {})}
          className={cn(
            "p-0.5 rounded text-muted-foreground/20 hover:text-muted-foreground/50 transition-colors",
            dragHandleProps ? "cursor-grab active:cursor-grabbing" : "invisible"
          )}
        >
          <GripVertical className="h-4 w-4" />
        </div>
        {/* Times */}
        <div className="flex flex-col items-center gap-0.5 mt-1 select-none">
          <span className="text-[10px] font-bold text-foreground/80 tabular-nums leading-none">
            {formatTime(item.start_time)}
          </span>
          <div className="flex flex-col items-center gap-0.5 my-0.5">
            <div className="w-px h-1.5 bg-border/40" />
            <div className="h-1 w-1 rounded-full bg-border/30" />
            <div className="w-px h-1.5 bg-border/40" />
          </div>
          <span className="text-[10px] text-muted-foreground/50 tabular-nums leading-none">
            {formatTime(item.end_time)}
          </span>
        </div>
      </div>

      {/* ── Right: full card content ── */}
      <div className="flex-1 min-w-0 flex flex-col">

        {/* Photo banner */}
        <div className="relative w-full h-[160px] overflow-hidden bg-muted/30">
          {hasPhoto ? (
            <img
              src={photo!.url}
              alt={item.place.name}
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
              onError={() => setImgError(true)}
              loading="lazy"
            />
          ) : (
            <div className="h-full w-full flex items-center justify-center bg-gradient-to-br from-muted/70 to-muted/30">
              <ImageOff className="h-8 w-8 text-muted-foreground/15" />
            </div>
          )}

          {/* gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/15 to-transparent" />

          {/* index badge — top left */}
          <div
            className="absolute top-2.5 left-2.5 h-5 w-5 rounded-full flex items-center justify-center text-white text-[9px] font-bold shadow"
            style={{ backgroundColor: dayColor }}
          >
            {index}
          </div>

          {/* lock button — top right (hover) */}
          <button
            onClick={() => onToggleLock?.(item.id)}
            className="absolute top-2.5 right-2.5 p-1 rounded-md bg-black/30 backdrop-blur-sm text-white/60 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"
            title={item.is_locked ? "Unlock" : "Lock"}
          >
            {item.is_locked ? <Lock className="h-3 w-3 text-amber-300" /> : <Unlock className="h-3 w-3" />}
          </button>

          {/* Name + city — bottom left */}
          <div className="absolute bottom-2.5 left-3 right-16">
            <div className="flex items-center gap-1.5">
              <CategoryIcon category={item.place.category} size="sm" />
              <p className="text-[13px] font-bold text-white leading-snug line-clamp-1 drop-shadow">
                {item.place.name}
              </p>
              {item.is_locked && <Lock className="h-2.5 w-2.5 text-amber-300 shrink-0" />}
            </div>
            <p className="text-[10px] text-white/60 mt-0.5 drop-shadow">{item.place.city}</p>
          </div>

          {/* Rating — bottom right */}
          {rating > 0 && (
            <div className="absolute bottom-2.5 right-3 flex items-center gap-0.5">
              <Star className="h-3 w-3 text-amber-400 fill-amber-400" />
              <span className="text-[11px] font-semibold text-white drop-shadow">{rating.toFixed(1)}</span>
            </div>
          )}
        </div>

        {/* Card body */}
        <div className="px-3 pt-2.5 pb-3">
          {/* Description */}
          {item.place.description && (
            <div className="mb-2">
              <AnimatePresence initial={false}>
                <p className={cn("text-[11px] text-muted-foreground/75 leading-relaxed", !expanded && "line-clamp-2")}>
                  {item.place.description}
                </p>
              </AnimatePresence>
              {item.place.description.length > 90 && (
                <button
                  onClick={() => setExpanded(!expanded)}
                  className="flex items-center gap-0.5 text-[10px] text-primary/40 hover:text-primary/80 mt-0.5 transition-colors"
                >
                  {expanded ? <><ChevronUp className="h-2.5 w-2.5" />less</> : <><ChevronDown className="h-2.5 w-2.5" />more</>}
                </button>
              )}
            </div>
          )}

          {/* Pills row */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {/* Category */}
            <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-semibold capitalize", catColors.bg, catColors.text)}>
              {item.place.category}
            </span>

            {/* Status — clickable */}
            <button
              onClick={() => onStatusChange?.(item.id, NEXT_STATUS[item.status] || "scheduled")}
              className={cn("flex items-center gap-1 text-[10px] font-medium transition-colors", statusCfg.textClass)}
              title="Click to advance status"
            >
              <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", statusCfg.dotClass)} />
              {statusCfg.label}
            </button>

            {/* Duration */}
            {item.duration_minutes > 0 && (
              <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground/60">
                <Clock className="h-2.5 w-2.5 shrink-0" />
                {durationH > 0 ? `${durationH}h` : ""}{durationM > 0 ? ` ${durationM}m` : ""}
              </span>
            )}

            {/* Price */}
            {cost > 0 ? (
              <span className="flex items-center gap-1">
                <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground/40">
                  {priceInfo.icon}
                </span>
                <span className="text-[11px] font-bold" style={{ color: dayColor }}>
                  {symbol}{Math.round(convertFromUsd(cost)).toLocaleString()}
                </span>
              </span>
            ) : (
              <span className="flex items-center gap-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                <Sparkles className="h-2.5 w-2.5" />
                Free
              </span>
            )}

            {/* Rating inline */}
            {rating > 0 && (
              <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground/60">
                <Star className="h-2.5 w-2.5 text-amber-400 fill-amber-400" />
                {rating.toFixed(1)}
              </span>
            )}
          </div>

          {/* AI score bar */}
          {aiScore > 0 && (
            <div className="mt-2.5 flex items-center gap-2">
              <div className="flex items-center gap-1 shrink-0">
                <TrendingUp className="h-2.5 w-2.5 text-muted-foreground/40" />
                <span className="text-[9px] text-muted-foreground/50 font-medium">AI Score</span>
              </div>
              <div className="flex-1 h-1 rounded-full bg-muted/60 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-1000"
                  style={{
                    width: `${Math.min(100, (aiScore / 100) * 100)}%`,
                    background: `linear-gradient(90deg, ${dayColor}99, ${dayColor})`,
                  }}
                />
              </div>
              <span className="text-[10px] font-bold shrink-0" style={{ color: dayColor }}>
                {Math.round(aiScore)}
              </span>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}