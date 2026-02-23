"use client";

import React from "react";
import { motion } from "framer-motion";
import {
  Plane,
  TrainFront,
  Bus,
  Clock,
  MapPin,
  ArrowRight,
  Leaf,
  Timer,
} from "lucide-react";
import type { TravelSummary } from "@/types";
import { useCurrency } from "@/contexts/currency-context";
import { Badge } from "@/components/ui/badge";

interface TransportInfoCardProps {
  summary: TravelSummary;
  departureCity: string;
  destinationCity: string;
}

function TransportIcon({ type }: { type: string }) {
  switch (type) {
    case "flight":
      return <Plane className="h-5 w-5" />;
    case "train":
      return <TrainFront className="h-5 w-5" />;
    case "bus":
      return <Bus className="h-5 w-5" />;
    default:
      return <Plane className="h-5 w-5" />;
  }
}

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function formatTransportTime(dt: string | null): string {
  if (!dt) return "--:--";
  try {
    const d = new Date(dt);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return dt.slice(0, 5);
  }
}

export function TransportInfoCard({
  summary,
  departureCity,
  destinationCity,
}: TransportInfoCardProps) {
  const { convert, symbol } = useCurrency();
  const price = Math.round(convert(Number(summary.price_inr)));

  const typeColors: Record<string, string> = {
    flight: "from-blue-500/10 to-sky-500/10 border-blue-500/20",
    train: "from-emerald-500/10 to-green-500/10 border-emerald-500/20",
    bus: "from-amber-500/10 to-orange-500/10 border-amber-500/20",
  };

  const iconColors: Record<string, string> = {
    flight: "text-blue-500 bg-blue-500/10",
    train: "text-emerald-500 bg-emerald-500/10",
    bus: "text-amber-500 bg-amber-500/10",
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className={`glass-card overflow-hidden border bg-gradient-to-br ${typeColors[summary.transport_type] || typeColors.flight}`}
    >
      {/* Header */}
      <div className="p-4 pb-3">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-foreground flex items-center gap-2">
            <div
              className={`h-8 w-8 rounded-lg flex items-center justify-center ${iconColors[summary.transport_type] || iconColors.flight}`}
            >
              <TransportIcon type={summary.transport_type} />
            </div>
            Transport Details
          </h3>
          <Badge variant="default" className="capitalize">
            {summary.transport_type}
          </Badge>
        </div>

        {/* Provider */}
        <p className="text-sm font-medium text-foreground mb-3">
          {summary.provider_name}
        </p>

        {/* Route visualization */}
        <div className="flex items-center gap-2 mb-4">
          <div className="flex-1">
            <p className="text-xs text-muted-foreground">From</p>
            <p className="text-sm font-semibold text-foreground flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5 text-primary" />
              {departureCity}
            </p>
            {summary.departure_time && (
              <p className="text-xs text-muted-foreground mt-0.5">
                {formatTransportTime(summary.departure_time)}
              </p>
            )}
          </div>

          <div className="flex flex-col items-center gap-1 px-2">
            <div className="h-px w-8 bg-border" />
            <ArrowRight className="h-4 w-4 text-muted-foreground" />
            <div className="h-px w-8 bg-border" />
          </div>

          <div className="flex-1 text-right">
            <p className="text-xs text-muted-foreground">To</p>
            <p className="text-sm font-semibold text-foreground flex items-center gap-1 justify-end">
              {destinationCity}
              <MapPin className="h-3.5 w-3.5 text-accent" />
            </p>
            {summary.arrival_time && (
              <p className="text-xs text-muted-foreground mt-0.5">
                {formatTransportTime(summary.arrival_time)}
              </p>
            )}
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3">
          <div className="text-center p-2 rounded-lg bg-background/50">
            <Timer className="h-4 w-4 mx-auto text-muted-foreground mb-1" />
            <p className="text-xs font-bold text-foreground">
              {formatDuration(summary.duration_minutes)}
            </p>
            <p className="text-[10px] text-muted-foreground">Duration</p>
          </div>
          <div className="text-center p-2 rounded-lg bg-background/50">
            <span className="block text-sm font-bold mx-auto mb-0.5">
              {symbol}
            </span>
            <p className="text-xs font-bold text-foreground">{price.toLocaleString()}</p>
            <p className="text-[10px] text-muted-foreground">Price</p>
          </div>
          <div className="text-center p-2 rounded-lg bg-background/50">
            <Leaf className="h-4 w-4 mx-auto text-emerald-500 mb-1" />
            <p className="text-xs font-bold text-foreground">
              {summary.carbon_kg}kg
            </p>
            <p className="text-[10px] text-muted-foreground">CO₂</p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
