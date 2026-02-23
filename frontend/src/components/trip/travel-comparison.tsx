"use client";

import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plane,
  Train,
  Bus,
  Clock,
  Leaf,
  AlertTriangle,
  ArrowRight,
  Filter,
  SortAsc,
  Star,
  Zap,
  IndianRupee,
  ChevronDown,
  ChevronUp,
  MapPin,
  Wifi,
  Utensils,
  Luggage,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCurrency } from "@/contexts/currency-context";
import type { TravelOption } from "@/types";

interface TravelComparisonProps {
  options: TravelOption[];
  departureCity: string;
  arrivalCity: string;
  isLoading?: boolean;
  onSelect: (option: TravelOption) => void;
  onSkip: () => void;
}

type SortKey = "price" | "duration" | "carbon" | "departure";
type FilterType = "all" | "flight" | "train" | "bus";

const TRANSPORT_ICONS: Record<string, React.ElementType> = {
  flight: Plane,
  train: Train,
  bus: Bus,
};

const TRANSPORT_COLORS: Record<string, string> = {
  flight: "from-blue-500/20 to-indigo-500/20 border-blue-500/30",
  train: "from-emerald-500/20 to-green-500/20 border-emerald-500/30",
  bus: "from-amber-500/20 to-orange-500/20 border-amber-500/30",
};

const TRANSPORT_ACCENT: Record<string, string> = {
  flight: "text-blue-400",
  train: "text-emerald-400",
  bus: "text-amber-400",
};

const BADGE_STYLES: Record<string, { bg: string; text: string; icon: React.ElementType }> = {
  fastest: { bg: "bg-yellow-500/20", text: "text-yellow-300", icon: Zap },
  cheapest: { bg: "bg-green-500/20", text: "text-green-300", icon: IndianRupee },
  recommended: { bg: "bg-purple-500/20", text: "text-purple-300", icon: Star },
};

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function formatTime(isoString: string): string {
  const d = new Date(isoString);
  return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
}

function formatDate(isoString: string): string {
  const d = new Date(isoString);
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

function CarbonIndicator({ kg }: { kg: number }) {
  const level = kg < 10 ? "low" : kg < 50 ? "medium" : "high";
  const colors = {
    low: "text-green-400 bg-green-500/10",
    medium: "text-yellow-400 bg-yellow-500/10",
    high: "text-red-400 bg-red-500/10",
  };
  return (
    <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${colors[level]}`}>
      <Leaf className="h-3 w-3" />
      {kg.toFixed(1)} kg CO₂
    </div>
  );
}

function TravelCard({
  option,
  onSelect,
}: {
  option: TravelOption;
  onSelect: (o: TravelOption) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const { convert, symbol } = useCurrency();
  const Icon = TRANSPORT_ICONS[option.transport_type] || Plane;
  const colorClass = TRANSPORT_COLORS[option.transport_type] || TRANSPORT_COLORS.flight;
  const accentClass = TRANSPORT_ACCENT[option.transport_type] || TRANSPORT_ACCENT.flight;

  const priceInr = typeof option.price_inr === "string" ? parseFloat(option.price_inr) : option.price_inr;
  const displayPrice = convert(priceInr);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      className={`relative rounded-2xl border bg-gradient-to-br ${colorClass} backdrop-blur-xl overflow-hidden transition-shadow hover:shadow-lg hover:shadow-primary/5`}
    >
      {/* Badges */}
      {option.badges && option.badges.length > 0 && (
        <div className="flex gap-1.5 px-4 pt-3">
          {option.badges.map((badge) => {
            const style = BADGE_STYLES[badge];
            if (!style) return null;
            const BadgeIcon = style.icon;
            return (
              <span
                key={badge}
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${style.bg} ${style.text}`}
              >
                <BadgeIcon className="h-3 w-3" />
                {badge}
              </span>
            );
          })}
        </div>
      )}

      <div className="p-4">
        {/* Header: Provider + Type */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className={`p-2 rounded-xl bg-background/40 ${accentClass}`}>
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <div className="font-semibold text-sm text-foreground">
                {option.provider_name}
              </div>
              <div className="text-[10px] text-muted-foreground">
                {option.route_number} · {option.cabin_class}
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-lg font-bold text-foreground">
              {symbol}{displayPrice.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
            </div>
            <div className="text-[10px] text-muted-foreground">per person</div>
          </div>
        </div>

        {/* Route visualization */}
        <div className="flex items-center gap-3 py-3 px-2 rounded-xl bg-background/30">
          <div className="text-center flex-1">
            <div className="text-lg font-bold text-foreground">{formatTime(option.departure_time)}</div>
            <div className="text-[10px] text-muted-foreground">{formatDate(option.departure_time)}</div>
            <div className="text-xs text-muted-foreground mt-0.5 truncate max-w-[100px]">
              {option.departure_station || option.departure_city}
            </div>
          </div>

          <div className="flex-1 flex flex-col items-center">
            <div className="text-xs text-muted-foreground mb-1">{formatDuration(option.duration_minutes)}</div>
            <div className="w-full flex items-center">
              <div className="h-px flex-1 bg-border" />
              <div className={`mx-1 ${accentClass}`}>
                <ArrowRight className="h-4 w-4" />
              </div>
              <div className="h-px flex-1 bg-border" />
            </div>
            <div className="text-[10px] text-muted-foreground mt-1">
              {option.stops === 0 ? "Direct" : `${option.stops} stop${option.stops > 1 ? "s" : ""}`}
            </div>
          </div>

          <div className="text-center flex-1">
            <div className="text-lg font-bold text-foreground">{formatTime(option.arrival_time)}</div>
            <div className="text-[10px] text-muted-foreground">{formatDate(option.arrival_time)}</div>
            <div className="text-xs text-muted-foreground mt-0.5 truncate max-w-[100px]">
              {option.arrival_station || option.arrival_city}
            </div>
          </div>
        </div>

        {/* Meta row */}
        <div className="flex items-center justify-between mt-3">
          <div className="flex items-center gap-2">
            <CarbonIndicator kg={option.carbon_kg} />
            {option.delay_risk > 0.2 && (
              <div className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium text-orange-400 bg-orange-500/10">
                <AlertTriangle className="h-3 w-3" />
                {Math.round(option.delay_risk * 100)}% delay risk
              </div>
            )}
          </div>
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition"
          >
            Details
            {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </button>
        </div>

        {/* Expanded details */}
        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="mt-3 pt-3 border-t border-border/30">
                {option.stop_details && option.stop_details.length > 0 && (
                  <div className="mb-2">
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Stops: </span>
                    <span className="text-xs text-foreground">
                      {option.stop_details.join(" → ")}
                    </span>
                  </div>
                )}
                <div className="flex flex-wrap gap-1.5">
                  {option.amenities.map((amenity, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] bg-muted/50 text-muted-foreground"
                    >
                      {amenity.toLowerCase().includes("wifi") && <Wifi className="h-2.5 w-2.5" />}
                      {amenity.toLowerCase().includes("meal") && <Utensils className="h-2.5 w-2.5" />}
                      {amenity.toLowerCase().includes("bag") && <Luggage className="h-2.5 w-2.5" />}
                      {amenity}
                    </span>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Select button */}
        <Button
          onClick={() => onSelect(option)}
          className="w-full mt-3"
          size="sm"
        >
          Select This {option.transport_type.charAt(0).toUpperCase() + option.transport_type.slice(1)}
        </Button>
      </div>
    </motion.div>
  );
}

export function TravelComparison({
  options,
  departureCity,
  arrivalCity,
  isLoading,
  onSelect,
  onSkip,
}: TravelComparisonProps) {
  const [sortBy, setSortBy] = useState<SortKey>("price");
  const [filterType, setFilterType] = useState<FilterType>("all");

  const filtered = useMemo(() => {
    let result = [...options];
    if (filterType !== "all") {
      result = result.filter((o) => o.transport_type === filterType);
    }

    result.sort((a, b) => {
      switch (sortBy) {
        case "price":
          return (parseFloat(String(a.price_inr)) || 0) - (parseFloat(String(b.price_inr)) || 0);
        case "duration":
          return a.duration_minutes - b.duration_minutes;
        case "carbon":
          return a.carbon_kg - b.carbon_kg;
        case "departure":
          return new Date(a.departure_time).getTime() - new Date(b.departure_time).getTime();
        default:
          return 0;
      }
    });
    return result;
  }, [options, filterType, sortBy]);

  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = { all: options.length };
    options.forEach((o) => {
      counts[o.transport_type] = (counts[o.transport_type] || 0) + 1;
    });
    return counts;
  }, [options]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <div className="relative">
          <div className="h-16 w-16 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
          <Plane className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-6 w-6 text-primary" />
        </div>
        <p className="mt-4 text-muted-foreground text-sm">Searching travel options...</p>
        <p className="text-xs text-muted-foreground/60 mt-1">
          Comparing flights, trains & buses
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Route header */}
      <div className="text-center">
        <div className="inline-flex items-center gap-3 px-5 py-2.5 rounded-2xl bg-muted/30 border border-border/50">
          <div className="flex items-center gap-1.5">
            <MapPin className="h-4 w-4 text-primary" />
            <span className="font-semibold text-foreground">{departureCity}</span>
          </div>
          <ArrowRight className="h-4 w-4 text-muted-foreground" />
          <div className="flex items-center gap-1.5">
            <MapPin className="h-4 w-4 text-accent" />
            <span className="font-semibold text-foreground">{arrivalCity}</span>
          </div>
        </div>
      </div>

      {/* Filters & Sort */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1.5">
          <Filter className="h-4 w-4 text-muted-foreground" />
          {(["all", "flight", "train", "bus"] as FilterType[]).map((type) => {
            const Icon = type === "all" ? null : TRANSPORT_ICONS[type];
            const count = typeCounts[type] ?? 0;
            if (type !== "all" && count === 0) return null;
            return (
              <button
                key={type}
                onClick={() => setFilterType(type)}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                  filterType === type
                    ? "bg-primary/15 text-primary border border-primary/30"
                    : "bg-muted/30 text-muted-foreground border border-transparent hover:bg-muted/50"
                }`}
              >
                {Icon && <Icon className="h-3.5 w-3.5" />}
                {type === "all" ? "All" : type.charAt(0).toUpperCase() + type.slice(1)}
                <span className="opacity-60">({count})</span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-1.5">
          <SortAsc className="h-4 w-4 text-muted-foreground" />
          {(
            [
              { key: "price", label: "Price" },
              { key: "duration", label: "Duration" },
              { key: "carbon", label: "Carbon" },
              { key: "departure", label: "Departure" },
            ] as { key: SortKey; label: string }[]
          ).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setSortBy(key)}
              className={`px-2.5 py-1 rounded-lg text-xs transition ${
                sortBy === key
                  ? "bg-primary/15 text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Results */}
      {filtered.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">No travel options found for this route.</p>
          <p className="text-xs text-muted-foreground/60 mt-1">Try a different filter or skip this step.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <AnimatePresence mode="popLayout">
            {filtered.map((option) => (
              <TravelCard key={option.id} option={option} onSelect={onSelect} />
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Skip */}
      <div className="text-center pt-2">
        <button
          onClick={onSkip}
          className="text-sm text-muted-foreground hover:text-foreground transition underline underline-offset-2"
        >
          Skip — I'll arrange my own travel
        </button>
      </div>
    </div>
  );
}
