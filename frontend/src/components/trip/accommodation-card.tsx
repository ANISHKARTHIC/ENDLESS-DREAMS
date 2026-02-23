"use client";

import React from "react";
import { motion } from "framer-motion";
import type { Accommodation } from "@/types";
import {
  Star,
  MapPin,
  Clock,
  Wifi,
  Bath,
  Utensils,
  Dumbbell,
  Coffee,
  Check,
} from "lucide-react";
import { useCurrency } from "@/contexts/currency-context";

interface AccommodationCardProps {
  accommodations: Accommodation[];
  compact?: boolean;
}

const AMENITY_ICONS: Record<string, React.ReactNode> = {
  WiFi: <Wifi className="h-3 w-3" />,
  Spa: <Bath className="h-3 w-3" />,
  Pool: <Bath className="h-3 w-3" />,
  Gym: <Dumbbell className="h-3 w-3" />,
  Breakfast: <Coffee className="h-3 w-3" />,
  "Fine Dining": <Utensils className="h-3 w-3" />,
};

function StayTypeBadge({ type }: { type: string }) {
  const colors: Record<string, string> = {
    hotel: "bg-blue-500/10 text-blue-600",
    hostel: "bg-green-500/10 text-green-600",
    resort: "bg-purple-500/10 text-purple-600",
    airbnb: "bg-rose-500/10 text-rose-600",
    boutique: "bg-amber-500/10 text-amber-600",
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide ${colors[type] || "bg-muted text-muted-foreground"}`}>
      {type}
    </span>
  );
}

export function AccommodationCard({ accommodations, compact }: AccommodationCardProps) {
  const { convert, symbol } = useCurrency();
  if (!accommodations.length) return null;

  const recommended = accommodations.find((a) => a.is_recommended) || accommodations[0];
  const others = accommodations.filter((a) => a !== recommended).slice(0, 3);

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="glass-card overflow-hidden"
    >
      {/* Header */}
      <div className="p-4 pb-3 border-b border-border/50">
        <h3 className="font-semibold text-foreground flex items-center gap-2">
          <MapPin className="h-4 w-4 text-primary" />
          Stay Optimization
        </h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          AI-optimized for proximity to your itinerary
        </p>
      </div>

      {/* Recommended stay */}
      <div className="p-4">
        <div className="flex items-start gap-3">
          {/* Image */}
          {recommended.image_url && (
            <div className="relative w-20 h-20 rounded-lg overflow-hidden shrink-0">
              <img
                src={recommended.image_url}
                alt={recommended.name}
                className="w-full h-full object-cover"
              />
              <div className="absolute top-1 left-1">
                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-primary text-primary-foreground shadow">
                  Best Match
                </span>
              </div>
            </div>
          )}

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h4 className="font-semibold text-foreground text-sm truncate">
                {recommended.name}
              </h4>
              <StayTypeBadge type={recommended.type} />
            </div>

            {/* Rating */}
            <div className="flex items-center gap-1 mb-1">
              <Star className="h-3 w-3 text-amber-500 fill-amber-500" />
              <span className="text-xs font-medium">{recommended.rating}</span>
              {recommended.stars > 0 && (
                <span className="text-xs text-muted-foreground">
                  · {recommended.stars}-star
                </span>
              )}
            </div>

            {/* Price */}
            <div className="flex items-baseline gap-1">
              <span className="text-lg font-bold text-foreground">
                {symbol}{Math.round(convert(recommended.price_per_night_usd))}
              </span>
              <span className="text-xs text-muted-foreground">/night</span>
              <span className="text-xs text-muted-foreground ml-1">
                ({symbol}{Math.round(convert(recommended.total_cost_usd))} total)
              </span>
            </div>
          </div>
        </div>

        {/* Optimization metrics */}
        <div className="grid grid-cols-2 gap-2 mt-3">
          <div className="flex items-center gap-1.5 p-2 rounded-lg bg-muted/50">
            <MapPin className="h-3.5 w-3.5 text-primary shrink-0" />
            <div>
              <p className="text-xs font-medium">{recommended.distance_to_attractions_km} km</p>
              <p className="text-[10px] text-muted-foreground">to attractions</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 p-2 rounded-lg bg-muted/50">
            <Clock className="h-3.5 w-3.5 text-primary shrink-0" />
            <div>
              <p className="text-xs font-medium">{recommended.travel_time_saved_pct}%</p>
              <p className="text-[10px] text-muted-foreground">time saved</p>
            </div>
          </div>
        </div>

        {/* Amenities */}
        {!compact && recommended.amenities.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {recommended.amenities.slice(0, 5).map((amenity) => (
              <span
                key={amenity}
                className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted/50 text-[10px] text-muted-foreground"
              >
                {AMENITY_ICONS[amenity] || <Check className="h-3 w-3" />}
                {amenity}
              </span>
            ))}
          </div>
        )}

        {/* Description */}
        {!compact && recommended.description && (
          <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
            {recommended.description}
          </p>
        )}
      </div>

      {/* Other options */}
      {!compact && others.length > 0 && (
        <div className="border-t border-border/50 p-4 pt-3">
          <p className="text-xs font-medium text-muted-foreground mb-2">
            Other options
          </p>
          <div className="space-y-2">
            {others.map((a, i) => (
              <div
                key={i}
                className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-muted/30 transition"
              >
                <div className="flex items-center gap-2">
                  <StayTypeBadge type={a.type} />
                  <span className="text-sm text-foreground truncate max-w-[140px]">
                    {a.name}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    {a.distance_to_attractions_km} km
                  </span>
                  <span className="text-sm font-semibold">
                    {symbol}{Math.round(convert(a.price_per_night_usd))}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Mock indicator */}
      {recommended.is_mock && (
        <div className="px-4 pb-3">
          <p className="text-[10px] text-muted-foreground/60 text-center">
            Simulated data — connect API for live rates
          </p>
        </div>
      )}
    </motion.div>
  );
}
