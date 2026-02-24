"use client";

import React, { useEffect, useMemo, useState } from "react";
import { cn, formatTime, getCategoryColor } from "@/lib/utils";
import { CategoryIcon } from "@/components/ui/category-icon";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";
import {
  Clock,
  Lock,
  Unlock,
  GripVertical,
  MapPin,
  Star,
  ImageOff,
} from "lucide-react";
import type { ItineraryItem } from "@/types";
import { motion } from "framer-motion";
import { useCurrency } from "@/contexts/currency-context";

interface ItineraryCardProps {
  item: ItineraryItem;
  onToggleLock?: (itemId: string) => void;
  onStatusChange?: (itemId: string, status: string) => void;
  isDragging?: boolean;
  dragHandleProps?: Record<string, unknown>;
}

type PlacePhoto = {
  url: string;
  photographer?: string;
  photographerUrl?: string;
};

const placePhotoCache: Record<string, PlacePhoto | null> = {};

export function ItineraryCard({
  item,
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

  useEffect(() => {
    let isMounted = true;

    if (item.place.image_url) {
      const direct = { url: item.place.image_url };
      placePhotoCache[cacheKey] = direct;
      setPhoto(direct);
      return () => {
        isMounted = false;
      };
    }

    if (cacheKey in placePhotoCache) {
      setPhoto(placePhotoCache[cacheKey]);
      return () => {
        isMounted = false;
      };
    }

    api
      .getUnsplashPhotos({ place: item.place.name, city: item.place.city, count: 1 })
      .then((result) => {
        const first = result.photos?.[0];
        const resolved: PlacePhoto | null = first
          ? {
              url: first.url_regular || first.url_small || first.url_thumb || first.url_full,
              photographer: first.photographer,
              photographerUrl: first.photographer_url,
            }
          : null;
        placePhotoCache[cacheKey] = resolved;
        if (isMounted) setPhoto(resolved);
      })
      .catch(() => {
        placePhotoCache[cacheKey] = null;
        if (isMounted) setPhoto(null);
      });

    return () => {
      isMounted = false;
    };
  }, [cacheKey, item.place.city, item.place.image_url, item.place.name]);

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
      {/* Place photo banner – only shown when image_url is available */}
      {(photo?.url || item.place.image_url) && (
        <div className="relative w-full h-28 -mx-4 -mt-4 mb-3 overflow-hidden rounded-t-2xl">
          {imgError ? (
            <div className="w-full h-full bg-muted flex flex-col items-center justify-center gap-1">
              <ImageOff className="h-6 w-6 text-muted-foreground/40" />
              <span className="text-xs text-muted-foreground/60">{item.place.name}</span>
            </div>
          ) : (
            <>
              <img
                src={photo?.url || item.place.image_url!}
                alt={item.place.name}
                className="w-full h-full object-cover brightness-90 group-hover:brightness-100 group-hover:scale-105 transition-all duration-500"
                onError={() => setImgError(true)}
                loading="lazy"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
              <div className="absolute bottom-2 left-3 right-3 flex items-center justify-between">
                <span className="text-white text-xs font-medium drop-shadow">{item.place.name}</span>
                {Number(item.place.rating) > 0 && (
                  <span className="flex items-center gap-0.5 text-amber-300 text-xs drop-shadow">
                    <Star className="h-3 w-3 fill-amber-300" />
                    {Number(item.place.rating).toFixed(1)}
                  </span>
                )}
              </div>
              <a
                href="https://unsplash.com"
                target="_blank"
                rel="noopener noreferrer"
                className="absolute top-1.5 right-2 text-white/50 hover:text-white/80 text-[9px] font-medium tracking-wide transition-colors"
                onClick={(e) => e.stopPropagation()}
              >
                Unsplash
              </a>
            </>
          )}
        </div>
      )}

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
                <CategoryIcon category={item.place.category} size="md" withBg />
                <h3 className="font-semibold text-foreground truncate">
                  {item.place.name}
                </h3>
              </div>
              {item.place.description && (
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2 leading-relaxed">
                  {item.place.description}
                </p>
              )}
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
                  className={onStatusChange ? "cursor-pointer hover:opacity-80" : ""}
                  onClick={() => {
                    if (!onStatusChange) return;
                    const nextStatus: Record<string, string> = {
                      scheduled: "in_progress",
                      in_progress: "completed",
                      completed: "scheduled",
                      skipped: "scheduled",
                      replanned: "scheduled",
                    };
                    onStatusChange(item.id, nextStatus[item.status] || "scheduled");
                  }}
                  title={onStatusChange ? "Click to change status" : undefined}
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
              <span className="font-medium text-xs">{symbol}</span>
              <span>{Math.round(convertFromUsd(Number(item.estimated_cost_usd))).toLocaleString()}</span>
            </div>
            {Number(item.place.rating) > 0 && (
              <div className="flex items-center gap-1">
                <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                <span>{Number(item.place.rating).toFixed(1)}</span>
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
                {(Number(item.score) * 100).toFixed(0)}
              </span>
            </div>
            <div className="h-1 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-primary to-accent transition-all duration-500"
                style={{ width: `${Math.min(Number(item.score) * 100, 100)}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
