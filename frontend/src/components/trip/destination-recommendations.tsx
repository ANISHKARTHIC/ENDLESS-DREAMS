"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  TrendingUp,
  Calendar,
  Sun,
  MapPin,
  Wallet,
  Utensils,
  Car,
  Building2,
  Ticket,
  Star,
  Clock,
  ChevronRight,
  Sparkles,
  BadgePercent,
} from "lucide-react";
import { useCurrency } from "@/contexts/currency-context";
import { api } from "@/lib/api";

interface RecommendationData {
  city: string;
  cost_index: number;
  place_count: number;
  categories: Record<string, number>;
  daily_budget_usd: number;
  budget_tiers: Record<string, { daily_usd: number; label: string; description: string }>;
  recommended_days: { min: number; ideal: number; max: number };
  best_time_to_visit: string[];
  breakdown: Record<string, { daily_usd: number; pct: number }>;
  top_places: { name: string; category: string; rating: number; avg_cost_usd: number; avg_duration_minutes: number }[];
}

interface DestinationRecommendationsProps {
  city: string;
  tripDays?: number;
  tripBudgetUsd?: number;
}

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  culture: <Building2 className="h-3 w-3" />,
  nature: <Sun className="h-3 w-3" />,
  food: <Utensils className="h-3 w-3" />,
  adventure: <TrendingUp className="h-3 w-3" />,
  relaxation: <Sparkles className="h-3 w-3" />,
  shopping: <BadgePercent className="h-3 w-3" />,
  nightlife: <Star className="h-3 w-3" />,
  landmark: <MapPin className="h-3 w-3" />,
};

const BREAKDOWN_ICONS: Record<string, React.ReactNode> = {
  accommodation: <Building2 className="h-3.5 w-3.5" />,
  food: <Utensils className="h-3.5 w-3.5" />,
  transport: <Car className="h-3.5 w-3.5" />,
  activities: <Ticket className="h-3.5 w-3.5" />,
};

const BREAKDOWN_COLORS: Record<string, string> = {
  accommodation: "bg-blue-500",
  food: "bg-amber-500",
  transport: "bg-emerald-500",
  activities: "bg-purple-500",
};

export function DestinationRecommendations({
  city,
  tripDays,
  tripBudgetUsd,
}: DestinationRecommendationsProps) {
  const [data, setData] = useState<RecommendationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedTier, setSelectedTier] = useState<string>("moderate");
  const { convert, symbol } = useCurrency();

  useEffect(() => {
    if (!city) return;
    setLoading(true);
    api
      .getRecommendations(city)
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [city]);

  if (loading) {
    return (
      <div className="glass-card p-6 animate-pulse space-y-4">
        <div className="h-5 bg-muted rounded w-1/2" />
        <div className="h-20 bg-muted rounded" />
        <div className="h-16 bg-muted rounded" />
        <div className="h-32 bg-muted rounded" />
      </div>
    );
  }

  if (!data) return null;

  const tier = data.budget_tiers[selectedTier];
  const days = tripDays || data.recommended_days.ideal;
  const totalBudget = tier ? tier.daily_usd * days : data.daily_budget_usd * days;
  const budgetMatch =
    tripBudgetUsd && tier
      ? tripBudgetUsd >= totalBudget
        ? "within"
        : tripBudgetUsd >= totalBudget * 0.7
        ? "tight"
        : "over"
      : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card overflow-hidden"
    >
      {/* Header */}
      <div className="p-4 pb-3 border-b border-border/50 bg-gradient-to-r from-primary/5 to-accent/5">
        <h3 className="font-semibold text-foreground flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-primary" />
          AI Recommendations
        </h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Smart insights for {city} · {data.place_count} places analyzed
        </p>
      </div>

      <div className="p-4 space-y-5">
        {/* Recommended Days */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Calendar className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium text-foreground">Recommended Duration</span>
          </div>
          <div className="flex items-center gap-2">
            {[
              { label: "Min", value: data.recommended_days.min, active: false },
              { label: "Ideal", value: data.recommended_days.ideal, active: true },
              { label: "Max", value: data.recommended_days.max, active: false },
            ].map((d) => (
              <div
                key={d.label}
                className={`flex-1 text-center p-2.5 rounded-xl border transition-all ${
                  d.active
                    ? "border-primary/40 bg-primary/10 shadow-sm"
                    : "border-border/50 bg-muted/30"
                }`}
              >
                <p className={`text-lg font-bold ${d.active ? "text-primary" : "text-foreground"}`}>
                  {d.value}
                </p>
                <p className="text-[10px] text-muted-foreground">{d.label} days</p>
              </div>
            ))}
          </div>
          {tripDays && (
            <p className="text-xs text-muted-foreground mt-1.5 flex items-center gap-1">
              <ChevronRight className="h-3 w-3" />
              Your trip: {tripDays} days
              {tripDays >= data.recommended_days.min && tripDays <= data.recommended_days.max
                ? " ✓ Perfect"
                : tripDays < data.recommended_days.min
                ? " — consider adding more days"
                : " — plenty of time to explore"}
            </p>
          )}
        </div>

        {/* Budget Tiers */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Wallet className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium text-foreground">Daily Budget</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(data.budget_tiers).map(([key, t]) => (
              <button
                key={key}
                onClick={() => setSelectedTier(key)}
                className={`text-left p-2.5 rounded-xl border transition-all ${
                  selectedTier === key
                    ? "border-primary/40 bg-primary/10 shadow-sm"
                    : "border-border/50 bg-muted/20 hover:border-primary/20"
                }`}
              >
                <div className="flex items-baseline gap-1">
                  <span className={`text-base font-bold ${selectedTier === key ? "text-primary" : "text-foreground"}`}>
                    {symbol}{Math.round(convert(t.daily_usd))}
                  </span>
                  <span className="text-[10px] text-muted-foreground">/day</span>
                </div>
                <p className="text-[10px] font-medium text-foreground mt-0.5">{t.label}</p>
                <p className="text-[9px] text-muted-foreground leading-tight">{t.description}</p>
              </button>
            ))}
          </div>

          {/* Total estimate */}
          {tier && (
            <div className="mt-2 p-3 rounded-xl bg-gradient-to-r from-primary/5 to-accent/5 border border-primary/10">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  Estimated total ({days} days, {tier.label.toLowerCase()})
                </span>
                <span className="text-sm font-bold text-primary">
                  {symbol}{Math.round(convert(totalBudget))}
                </span>
              </div>
              {budgetMatch && (
                <p
                  className={`text-[10px] mt-1 ${
                    budgetMatch === "within" ? "text-green-500" : budgetMatch === "tight" ? "text-amber-500" : "text-red-400"
                  }`}
                >
                  {budgetMatch === "within"
                    ? "✓ Your budget comfortably covers this"
                    : budgetMatch === "tight"
                    ? "⚠ Budget is tight at this tier"
                    : "✗ Consider a lower tier or fewer days"}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Cost Breakdown */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium text-foreground">Daily Cost Breakdown</span>
          </div>

          {/* Stacked bar */}
          <div className="h-3 rounded-full overflow-hidden flex mb-2">
            {Object.entries(data.breakdown).map(([key, b]) => (
              <div
                key={key}
                className={`${BREAKDOWN_COLORS[key] || "bg-gray-500"} transition-all`}
                style={{ width: `${b.pct}%` }}
                title={`${key}: ${b.pct}%`}
              />
            ))}
          </div>

          <div className="grid grid-cols-2 gap-2">
            {Object.entries(data.breakdown).map(([key, b]) => (
              <div key={key} className="flex items-center gap-2 p-1.5">
                <div className={`h-6 w-6 rounded-lg flex items-center justify-center ${BREAKDOWN_COLORS[key]}  text-white`}>
                  {BREAKDOWN_ICONS[key]}
                </div>
                <div>
                  <p className="text-[10px] font-medium text-foreground capitalize">{key}</p>
                  <p className="text-xs font-semibold">{symbol}{Math.round(convert(b.daily_usd))}<span className="text-[10px] text-muted-foreground font-normal">/day · {b.pct}%</span></p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Best Time to Visit */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Sun className="h-4 w-4 text-amber-500" />
            <span className="text-sm font-medium text-foreground">Best Time to Visit</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {data.best_time_to_visit.map((month) => (
              <span
                key={month}
                className="px-2 py-1 rounded-lg bg-amber-500/10 text-amber-600 text-[10px] font-semibold"
              >
                {month}
              </span>
            ))}
          </div>
        </div>

        {/* Top Places */}
        {data.top_places.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Star className="h-4 w-4 text-amber-500" />
              <span className="text-sm font-medium text-foreground">Top Places</span>
            </div>
            <div className="space-y-1.5">
              {data.top_places.slice(0, 5).map((place, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-muted/30 transition"
                >
                  <div className="flex items-center gap-2">
                    <span className="h-5 w-5 rounded-md bg-primary/10 text-primary text-[10px] font-bold flex items-center justify-center">
                      {i + 1}
                    </span>
                    <div>
                      <p className="text-xs font-medium text-foreground">{place.name}</p>
                      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                        {CATEGORY_ICONS[place.category]}
                        <span className="capitalize">{place.category}</span>
                        <span>· ★ {place.rating}</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-semibold">{symbol}{Math.round(convert(Number(place.avg_cost_usd)))}</p>
                    <p className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                      <Clock className="h-2.5 w-2.5" />
                      {Math.round(place.avg_duration_minutes / 60 * 10) / 10}h
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Place Categories */}
        {Object.keys(data.categories).length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <MapPin className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium text-foreground">Things To Do</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(data.categories).map(([cat, count]) => (
                <span
                  key={cat}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg bg-muted/50 text-[10px] text-muted-foreground"
                >
                  {CATEGORY_ICONS[cat] || <MapPin className="h-3 w-3" />}
                  <span className="capitalize">{cat}</span>
                  <span className="font-bold text-foreground">{count}</span>
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}
