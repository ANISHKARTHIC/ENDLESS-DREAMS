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

// Gradient fallbacks per category when no photo found
const CATEGORY_GRADIENTS: Record<string, string> = {
  food:        "from-orange-400 to-red-500",
  culture:     "from-amber-400 to-yellow-600",
  nature:      "from-emerald-400 to-green-600",
  adventure:   "from-blue-500 to-cyan-600",
  relaxation:  "from-purple-400 to-indigo-500",
  shopping:    "from-pink-400 to-rose-500",
  nightlife:   "from-indigo-500 to-violet-700",
  landmark:    "from-rose-400 to-pink-600",
  default:     "from-slate-400 to-slate-600",
};

export const DAY_COLORS = [
  "#3b82f6","#8b5cf6","#ec4899","#f59e0b","#10b981",
  "#06b6d4","#ef4444","#84cc16","#f97316","#6366f1",
];

const STATUS_CONFIG: Record<string, { label: string; dotClass: string; textClass: string; badgeBg: string }> = {
  scheduled:   { label: "Planned",   dotClass: "bg-slate-400",                badgeBg: "bg-slate-100 dark:bg-slate-800/60",  textClass: "text-slate-500 dark:text-slate-400" },
  in_progress: { label: "Live",      dotClass: "bg-blue-500 animate-pulse",   badgeBg: "bg-blue-100 dark:bg-blue-900/40",   textClass: "text-blue-600 dark:text-blue-400" },
  completed:   { label: "Done",      dotClass: "bg-emerald-500",              badgeBg: "bg-emerald-100 dark:bg-emerald-900/40", textClass: "text-emerald-600 dark:text-emerald-400" },
  skipped:     { label: "Skipped",   dotClass: "bg-gray-400 dark:bg-gray-600",badgeBg: "bg-gray-100 dark:bg-gray-800/40",   textClass: "text-gray-500 dark:text-gray-400" },
  replanned:   { label: "Replanned", dotClass: "bg-amber-400",                badgeBg: "bg-amber-100 dark:bg-amber-900/40", textClass: "text-amber-600 dark:text-amber-400" },
};

const NEXT_STATUS: Record<string, string> = {
  scheduled: "in_progress", in_progress: "completed",
  completed: "scheduled",  skipped: "scheduled", replanned: "scheduled",
};

function getPriceLabel(category: string): { label: string; icon: React.ReactNode } {
  const cat = category.toLowerCase();
  if (["food", "cafe", "restaurant", "dining"].includes(cat))
    return { label: "Per person", icon: <Utensils className="h-3 w-3" /> };
  if (["landmark", "culture", "museum", "heritage", "monument"].includes(cat))
    return { label: "Entry fee", icon: <Ticket className="h-3 w-3" /> };
  if (["adventure", "sport", "activity"].includes(cat))
    return { label: "Per person", icon: <Zap className="h-3 w-3" /> };
  if (["relaxation", "spa", "wellness"].includes(cat))
    return { label: "Per session", icon: <Sparkles className="h-3 w-3" /> };
  if (["shopping"].includes(cat))
    return { label: "Avg spend", icon: <ShoppingBag className="h-3 w-3" /> };
  return { label: "Est. cost", icon: <Ticket className="h-3 w-3" /> };
}

async function resolvePhoto(
  cacheKey: string,
  place: string,
  city: string,
  imageUrl: string | null
): Promise<PlacePhoto | null> {
  if (imageUrl) return { url: imageUrl };
  if (cacheKey in placePhotoCache) return placePhotoCache[cacheKey];

  // Try place-specific photo first
  try {
    const r1 = await api.getUnsplashPhotos({ place, city, count: 1 });
    const f1 = r1.photos?.[0];
    if (f1) {
      const url = f1.url_regular || f1.url_small || f1.url_thumb || "";
      if (url) { placePhotoCache[cacheKey] = { url }; return { url }; }
    }
  } catch { /* fall through */ }

  // Fallback: city-level photo
  try {
    const r2 = await api.getUnsplashPhotos({ city, count: 1 });
    const f2 = r2.photos?.[0];
    if (f2) {
      const url = f2.url_regular || f2.url_small || f2.url_thumb || "";
      if (url) { placePhotoCache[cacheKey] = { url }; return { url }; }
    }
  } catch { /* fall through */ }

  placePhotoCache[cacheKey] = null;
  return null;
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
    item.place.image_url
      ? { url: item.place.image_url }
      : (placePhotoCache[cacheKey] ?? null)
  );
  const [imgError, setImgError] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    let isMounted = true;
    resolvePhoto(cacheKey, item.place.name, item.place.city, item.place.image_url)
      .then((resolved) => { if (isMounted) setPhoto(resolved); });
    return () => { isMounted = false; };
  }, [cacheKey, item.place.city, item.place.image_url, item.place.name]);

  const catKey    = (item.place.category || "default").toLowerCase();
  const catColors = CATEGORY_COLORS[catKey] || CATEGORY_COLORS.default;
  const catGrad   = CATEGORY_GRADIENTS[catKey] || CATEGORY_GRADIENTS.default;
  const statusCfg = STATUS_CONFIG[item.status] || STATUS_CONFIG.scheduled;
  const durationH = Math.floor(item.duration_minutes / 60);
  const durationM = item.duration_minutes % 60;
  const cost      = Number(item.estimated_cost_usd);
  const rating    = Number(item.place.rating);
  const aiScore   = Number(item.score);
  const priceInfo = getPriceLabel(catKey);
  const hasPhoto  = photo?.url && !imgError;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.18 }}
      className={cn(
        "group relative flex rounded-2xl border bg-card overflow-hidden",
        "transition-all duration-200 hover:shadow-xl hover:shadow-black/[0.10] dark:hover:shadow-black/30",
        isDragging && "shadow-2xl scale-[1.01] opacity-95 z-50 rotate-[0.5deg]",
        item.is_locked
          ? "border-amber-300/50 dark:border-amber-700/30"
          : "border-border/50 hover:border-border/80"
      )}
    >
      {/* ── Left column: drag + time ── */}
      <div className="flex flex-col items-center gap-2 pt-3 pb-3 px-2.5 shrink-0 w-[62px] border-r border-border/30">
        <div
          {...(dragHandleProps || {})}
          className={cn(
            "p-0.5 rounded text-muted-foreground/25 hover:text-muted-foreground/60 transition-colors",
            dragHandleProps ? "cursor-grab active:cursor-grabbing" : "invisible"
          )}
        >
          <GripVertical className="h-4 w-4" />
        </div>
        <div className="flex flex-col items-center gap-0 select-none mt-0.5">
          <span className="text-xs font-extrabold text-foreground/85 tabular-nums tracking-tight leading-none">
            {formatTime(item.start_time)}
          </span>
          <div className="flex flex-col items-center my-1.5 gap-[3px]">
            <div className="w-0.5 h-2 rounded-full bg-border/50" />
            <div className="h-1 w-1 rounded-full" style={{ backgroundColor: dayColor + "99" }} />
            <div className="w-0.5 h-2 rounded-full bg-border/50" />
          </div>
          <span className="text-[10px] text-muted-foreground/50 tabular-nums leading-none">
            {formatTime(item.end_time)}
          </span>
        </div>
      </div>

      {/* ── Right: photo + body ── */}
      <div className="flex-1 min-w-0 flex flex-col">

        {/* Photo banner */}
        <div className="relative w-full h-[175px] overflow-hidden">
          {hasPhoto ? (
            <img
              src={photo!.url}
              alt={item.place.name}
              className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.04]"
              onError={() => {
                setImgError(true);
                // clear cache so retry can happen with next render
                delete placePhotoCache[cacheKey];
              }}
              loading="lazy"
            />
          ) : (
            // Rich gradient fallback by category
            <div className={cn("h-full w-full bg-gradient-to-br", catGrad)}>
              <div className="h-full w-full flex flex-col items-center justify-center gap-2 bg-black/20">
                <CategoryIcon category={item.place.category} size="lg" />
                <span className="text-white/80 text-sm font-semibold drop-shadow">{item.place.city}</span>
              </div>
            </div>
          )}

          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent" />

          {/* Index badge */}
          <div
            className="absolute top-3 left-3 h-6 w-6 rounded-full flex items-center justify-center text-white text-[10px] font-black shadow-lg"
            style={{ backgroundColor: dayColor }}
          >
            {index}
          </div>

          {/* Lock button */}
          <button
            onClick={() => onToggleLock?.(item.id)}
            className="absolute top-3 right-3 p-1.5 rounded-lg bg-black/35 backdrop-blur-sm text-white/60 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"
            title={item.is_locked ? "Unlock" : "Lock"}
          >
            {item.is_locked ? <Lock className="h-3.5 w-3.5 text-amber-300" /> : <Unlock className="h-3.5 w-3.5" />}
          </button>

          {/* Name + city bottom-left */}
          <div className="absolute bottom-3 left-3 right-16">
            <p className="text-[15px] font-black text-white leading-tight line-clamp-1 drop-shadow-md tracking-tight">
              {item.place.name}
            </p>
            <div className="flex items-center gap-1 mt-0.5">
              <CategoryIcon category={item.place.category} size="sm" />
              <span className="text-[11px] text-white/65 drop-shadow">{item.place.city}</span>
            </div>
          </div>

          {/* Rating bottom-right */}
          {rating > 0 && (
            <div className="absolute bottom-3 right-3 flex items-center gap-1 bg-black/40 backdrop-blur-sm rounded-lg px-2 py-0.5">
              <Star className="h-3 w-3 text-amber-400 fill-amber-400" />
              <span className="text-[12px] font-bold text-white">{rating.toFixed(1)}</span>
            </div>
          )}
        </div>

        {/* Card body */}
        <div className="px-3.5 pt-3 pb-3.5 flex flex-col gap-2.5">

          {/* Description */}
          {item.place.description && (
            <div>
              <p className={cn("text-[12px] text-muted-foreground/80 leading-relaxed", !expanded && "line-clamp-2")}>
                {item.place.description}
              </p>
              {item.place.description.length > 90 && (
                <button
                  onClick={() => setExpanded(!expanded)}
                  className="flex items-center gap-0.5 text-[11px] text-primary/50 hover:text-primary mt-0.5 transition-colors font-medium"
                >
                  {expanded ? <><ChevronUp className="h-3 w-3" />Show less</> : <><ChevronDown className="h-3 w-3" />Show more</>}
                </button>
              )}
            </div>
          )}

          {/* Badges row */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Category */}
            <span className={cn("px-2.5 py-[3px] rounded-full text-[11px] font-bold capitalize tracking-wide", catColors.bg, catColors.text)}>
              {item.place.category}
            </span>

            {/* Status */}
            <button
              onClick={() => onStatusChange?.(item.id, NEXT_STATUS[item.status] || "scheduled")}
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-[3px] rounded-full text-[11px] font-semibold transition-all",
                statusCfg.badgeBg, statusCfg.textClass
              )}
              title="Click to advance status"
            >
              <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", statusCfg.dotClass)} />
              {statusCfg.label}
            </button>
          </div>

          {/* Details row */}
          <div className="flex items-center gap-3 flex-wrap">
            {/* Duration */}
            {item.duration_minutes > 0 && (
              <span className="flex items-center gap-1 text-[12px] text-muted-foreground/70 font-medium">
                <Clock className="h-3.5 w-3.5 shrink-0" />
                {durationH > 0 ? `${durationH}h` : ""}{durationM > 0 ? ` ${durationM}m` : ""}
              </span>
            )}

            {/* Price */}
            {cost > 0 ? (
              <span className="flex items-center gap-1.5 ml-auto">
                <span className="text-[11px] text-muted-foreground/50 flex items-center gap-1">
                  {priceInfo.icon}{priceInfo.label}
                </span>
                <span className="text-[13px] font-black" style={{ color: dayColor }}>
                  {symbol}{Math.round(convertFromUsd(cost)).toLocaleString()}
                </span>
              </span>
            ) : (
              <span className="flex items-center gap-1 ml-auto text-[12px] font-bold text-emerald-600 dark:text-emerald-400">
                <Sparkles className="h-3 w-3" />
                Free
              </span>
            )}
          </div>

          {/* AI Score bar */}
          {aiScore > 0 && (
            <div className="flex items-center gap-2.5">
              <div className="flex items-center gap-1 shrink-0">
                <TrendingUp className="h-3 w-3 text-muted-foreground/40" />
                <span className="text-[10px] text-muted-foreground/45 font-semibold uppercase tracking-wide">AI Score</span>
              </div>
              <div className="flex-1 h-1.5 rounded-full bg-muted/50 overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.min(100, (aiScore / 100) * 100)}%`,
                    background: `linear-gradient(90deg, ${dayColor}70, ${dayColor})`,
                    transition: "width 1s ease",
                  }}
                />
              </div>
              <span className="text-[11px] font-black shrink-0" style={{ color: dayColor }}>
                {Math.round(aiScore)}
              </span>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}