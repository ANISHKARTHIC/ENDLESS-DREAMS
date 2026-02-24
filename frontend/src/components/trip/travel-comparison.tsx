"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plane,
  Train,
  Bus,
  Route,
  Car,
  ArrowRight,
  MapPin,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCurrency } from "@/contexts/currency-context";
import type { TravelOption } from "@/types";
import { getRouteInfo, haversineDistance, searchPlaces } from "@/lib/mapbox";

interface TravelComparisonProps {
  options: TravelOption[];
  departureCity: string;
  arrivalCity: string;
  departureLat?: number;
  departureLng?: number;
  arrivalLat?: number;
  arrivalLng?: number;
  isLoading?: boolean;
  onSelect: (option: TravelOption) => void;
  onSkip: () => void;
}

type SortKey = "package" | "fare" | "duration" | "departure";
type FilterType = "all" | "flight" | "train" | "bus";

const TRANSPORT_ICONS: Record<string, React.ElementType> = {
  flight: Plane,
  train: Train,
  bus: Bus,
};

const HUB_LABELS: Record<TravelOption["transport_type"], string> = {
  flight: "Airport",
  train: "Railway Station",
  bus: "Bus Terminal",
};

const DEFAULT_LOCAL_KM: Record<TravelOption["transport_type"], number> = {
  flight: 14,
  train: 7,
  bus: 5,
};

const MAX_LOCAL_KM: Record<TravelOption["transport_type"], number> = {
  flight: 50,
  train: 25,
  bus: 20,
};

const MAIN_SPEED_KMPH: Record<TravelOption["transport_type"], number> = {
  flight: 720,
  train: 85,
  bus: 50,
};

interface Coordinate {
  lat: number;
  lng: number;
}

interface ThreeLegPath {
  firstMileKm: number;
  mainLegKm: number;
  lastMileKm: number;
  localTransferKm: number;
  localTransferCostInr: number;
  packageCostInr: number;
}

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

function haversineKm(a: Coordinate, b: Coordinate): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLng / 2) * Math.sin(dLng / 2) * Math.cos(lat1) * Math.cos(lat2);
  const y = 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
  return R * y;
}

async function routeDistanceKm(a: Coordinate, b: Coordinate): Promise<number> {
  const route = await getRouteInfo(a, b, "driving");
  if (route?.distanceKm && route.distanceKm > 0) return route.distanceKm;
  return haversineKm(a, b);
}

async function resolveHubCoordinate(station: string, city: string, fallbackLabel: string): Promise<Coordinate | null> {
  const primaryQuery = `${station || fallbackLabel}, ${city}`.trim();
  const primary = await searchPlaces(primaryQuery, { types: ["poi", "address", "place", "locality"], limit: 1 });
  if (primary[0]) {
    return { lat: primary[0].lat, lng: primary[0].lng };
  }

  const fallback = await searchPlaces(`${city} ${fallbackLabel}`, { types: ["poi", "place", "locality"], limit: 1 });
  if (fallback[0]) {
    return { lat: fallback[0].lat, lng: fallback[0].lng };
  }

  return null;
}

function TravelCard({
  option,
  path,
  departureCity,
  arrivalCity,
  onSelect,
}: {
  option: TravelOption;
  path?: ThreeLegPath;
  departureCity: string;
  arrivalCity: string;
  onSelect: (o: TravelOption) => void;
}) {
  const { convert, symbol } = useCurrency();
  const Icon = TRANSPORT_ICONS[option.transport_type] || Plane;
  const hub = HUB_LABELS[option.transport_type] || "Transit Hub";

  const priceInr = typeof option.price_inr === "string" ? parseFloat(option.price_inr) : option.price_inr;
  const packageInr = path?.packageCostInr ?? priceInr;
  const localTransferInr = path?.localTransferCostInr ?? 0;
  const displayBase = convert(priceInr);
  const displayPackage = convert(packageInr);
  const displayLocal = convert(localTransferInr);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      className="rounded-2xl border border-border bg-card text-card-foreground p-4 transition-shadow hover:shadow-md"
    >
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-muted">
              <Icon className="h-4 w-4 text-foreground" />
            </div>
            <div>
              <div className="text-sm font-semibold text-foreground">{option.provider_name}</div>
              <div className="text-xs text-muted-foreground">{option.route_number || "Direct"} · {option.cabin_class}</div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-lg font-bold text-foreground">
              {symbol}{displayPackage.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
            </div>
            <div className="text-[11px] text-muted-foreground">final package</div>
          </div>
        </div>

        <div className="flex items-center justify-between rounded-xl border border-border/70 bg-muted/30 px-3 py-2">
          <div className="text-center min-w-[90px]">
            <div className="text-base font-semibold text-foreground">{formatTime(option.departure_time)}</div>
            <div className="text-[11px] text-muted-foreground">{formatDate(option.departure_time)}</div>
          </div>
          <div className="flex-1 px-2">
            <div className="text-[11px] text-center text-muted-foreground mb-1">{formatDuration(option.duration_minutes)}</div>
            <div className="flex items-center">
              <div className="h-px flex-1 bg-border" />
              <ArrowRight className="h-3.5 w-3.5 text-muted-foreground mx-1" />
              <div className="h-px flex-1 bg-border" />
            </div>
            <div className="text-[11px] text-center text-muted-foreground mt-1">
              {option.stops === 0 ? "Direct" : `${option.stops} stop${option.stops > 1 ? "s" : ""}`}
            </div>
          </div>
          <div className="text-center min-w-[90px]">
            <div className="text-base font-semibold text-foreground">{formatTime(option.arrival_time)}</div>
            <div className="text-[11px] text-muted-foreground">{formatDate(option.arrival_time)}</div>
          </div>
        </div>

        <div className="rounded-xl border border-border/70 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <Route className="h-3.5 w-3.5" />
              3 Path Plan
            </span>
            <span className={`text-[10px] px-2 py-0.5 rounded-full border ${option.is_mock ? "text-muted-foreground border-border" : "text-emerald-600 dark:text-emerald-400 border-emerald-500/30"}`}>
              {option.is_mock ? "Estimated" : "Live API"}
            </span>
          </div>

          <div className="grid grid-cols-[1fr_auto] gap-2 text-xs">
            <div className="text-muted-foreground">1) Start place → {option.departure_station || `${departureCity} ${hub}`}</div>
            <div className="text-foreground font-medium">
              {path ? `${path.firstMileKm.toFixed(1)} km` : "..."}
            </div>

            <div className="text-muted-foreground">2) {option.departure_station || `${departureCity} ${hub}`} → {option.arrival_station || `${arrivalCity} ${hub}`}</div>
            <div className="text-foreground font-medium">
              {path ? `${path.mainLegKm.toFixed(0)} km` : "..."}
            </div>

            <div className="text-muted-foreground">3) {option.arrival_station || `${arrivalCity} ${hub}`} → destination place</div>
            <div className="text-foreground font-medium">
              {path ? `${path.lastMileKm.toFixed(1)} km` : "..."}
            </div>
          </div>

          <div className="pt-2 border-t border-border/70 space-y-1 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Base fare</span>
              <span className="font-medium text-foreground">{symbol}{displayBase.toLocaleString("en-IN", { maximumFractionDigits: 0 })}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground flex items-center gap-1"><Car className="h-3 w-3" /> Local transfer ({path ? `${path.localTransferKm.toFixed(1)} km × 40` : "km × 40"})</span>
              <span className="font-medium text-foreground">{symbol}{displayLocal.toLocaleString("en-IN", { maximumFractionDigits: 0 })}</span>
            </div>
          </div>
        </div>

        <Button onClick={() => onSelect(option)} className="w-full" size="sm">
          Select Package
        </Button>
      </div>
    </motion.div>
  );
}

export function TravelComparison({
  options,
  departureCity,
  arrivalCity,
  departureLat,
  departureLng,
  arrivalLat,
  arrivalLng,
  isLoading,
  onSelect,
  onSkip,
}: TravelComparisonProps) {
  const [sortBy, setSortBy] = useState<SortKey>("package");
  const [filterType, setFilterType] = useState<FilterType>("all");
  const [pathByOption, setPathByOption] = useState<Record<string, ThreeLegPath>>({});
  const stationCacheRef = useRef<Record<string, Coordinate | null>>({});

  const cityCoords = useMemo(() => {
    const dep =
      typeof departureLat === "number" && typeof departureLng === "number"
        ? { lat: departureLat, lng: departureLng }
        : null;
    const arr =
      typeof arrivalLat === "number" && typeof arrivalLng === "number"
        ? { lat: arrivalLat, lng: arrivalLng }
        : null;
    return { dep, arr };
  }, [departureLat, departureLng, arrivalLat, arrivalLng]);

  useEffect(() => {
    let cancelled = false;

    const withPathCost = (option: TravelOption, path?: ThreeLegPath) => {
      const fare = Number(option.price_inr || 0);
      return fare + (path?.localTransferCostInr || 0);
    };

    const buildPath = async (option: TravelOption): Promise<ThreeLegPath> => {
      const baseFare = Number(option.price_inr || 0);
      const hubLabel = HUB_LABELS[option.transport_type] || "Transit Hub";

      const depCacheKey = `${departureCity}|${option.departure_station || ""}|${hubLabel}`;
      const arrCacheKey = `${arrivalCity}|${option.arrival_station || ""}|${hubLabel}`;

      let depHub = stationCacheRef.current[depCacheKey];
      if (depHub === undefined) {
        depHub = await resolveHubCoordinate(option.departure_station, departureCity, hubLabel);
        stationCacheRef.current[depCacheKey] = depHub;
      }

      let arrHub = stationCacheRef.current[arrCacheKey];
      if (arrHub === undefined) {
        arrHub = await resolveHubCoordinate(option.arrival_station, arrivalCity, hubLabel);
        stationCacheRef.current[arrCacheKey] = arrHub;
      }

      const cityToCityKm =
        cityCoords.dep && cityCoords.arr
          ? await routeDistanceKm(cityCoords.dep, cityCoords.arr)
          : (option.duration_minutes / 60) * MAIN_SPEED_KMPH[option.transport_type];

      let firstMileKm = DEFAULT_LOCAL_KM[option.transport_type];
      if (cityCoords.dep && depHub) {
        const raw = await routeDistanceKm(cityCoords.dep, depHub);
        firstMileKm = raw > 0 && raw <= MAX_LOCAL_KM[option.transport_type]
          ? raw
          : DEFAULT_LOCAL_KM[option.transport_type];
      }

      let lastMileKm = DEFAULT_LOCAL_KM[option.transport_type];
      if (cityCoords.arr && arrHub) {
        const raw = await routeDistanceKm(arrHub, cityCoords.arr);
        lastMileKm = raw > 0 && raw <= MAX_LOCAL_KM[option.transport_type]
          ? raw
          : DEFAULT_LOCAL_KM[option.transport_type];
      }

      let mainLegKm = cityToCityKm;
      if (depHub && arrHub) {
        if (option.transport_type === "flight") {
          mainLegKm = haversineDistance(depHub.lat, depHub.lng, arrHub.lat, arrHub.lng);
        } else {
          mainLegKm = await routeDistanceKm(depHub, arrHub);
        }
      }

      if (!Number.isFinite(mainLegKm) || mainLegKm <= 0) {
        mainLegKm = cityToCityKm;
      }

      // Guardrails against bad station geocoding landing in a wrong country.
      if (cityToCityKm > 0) {
        const tooLarge = mainLegKm > cityToCityKm * 2.2;
        const tooSmall = mainLegKm < cityToCityKm * 0.35;
        if (tooLarge || tooSmall) {
          mainLegKm = cityToCityKm;
        }
      }

      const localTransferKm = firstMileKm + lastMileKm;
      const localTransferCostInr = Math.max(0, Math.round(localTransferKm * 40));

      return {
        firstMileKm,
        mainLegKm,
        lastMileKm,
        localTransferKm,
        localTransferCostInr,
        packageCostInr: baseFare + localTransferCostInr,
      };
    };

    const enrich = async () => {
      const entries = await Promise.all(
        options.map(async (option) => {
          const path = await buildPath(option);
          return [option.id, path] as const;
        })
      );
      if (!cancelled) {
        setPathByOption(Object.fromEntries(entries));
      }
    };

    if (options.length > 0) {
      enrich();
    } else {
      setPathByOption({});
    }

    return () => {
      cancelled = true;
    };
  }, [options, departureCity, arrivalCity, cityCoords]);

  const filtered = useMemo(() => {
    let result = [...options];
    if (filterType !== "all") {
      result = result.filter((o) => o.transport_type === filterType);
    }

    const packageCost = (o: TravelOption) => Number(o.price_inr || 0) + (pathByOption[o.id]?.localTransferCostInr || 0);

    result.sort((a, b) => {
      switch (sortBy) {
        case "package":
          return packageCost(a) - packageCost(b);
        case "fare":
          return (parseFloat(String(a.price_inr)) || 0) - (parseFloat(String(b.price_inr)) || 0);
        case "duration":
          return a.duration_minutes - b.duration_minutes;
        case "departure":
          return new Date(a.departure_time).getTime() - new Date(b.departure_time).getTime();
        default:
          return 0;
      }
    });
    return result;
  }, [options, filterType, sortBy, pathByOption]);

  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = { all: options.length };
    options.forEach((o) => {
      counts[o.transport_type] = (counts[o.transport_type] || 0) + 1;
    });
    return counts;
  }, [options]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-14">
        <div className="h-14 w-14 rounded-full border-4 border-border border-t-foreground animate-spin" />
        <p className="mt-4 text-muted-foreground text-sm">Fetching live travel options...</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="text-center">
        <div className="inline-flex items-center gap-3 px-4 py-2 rounded-xl border border-border bg-muted/30">
          <span className="text-sm font-semibold text-foreground flex items-center gap-1.5"><MapPin className="h-4 w-4" />{departureCity}</span>
          <ArrowRight className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-semibold text-foreground flex items-center gap-1.5"><MapPin className="h-4 w-4" />{arrivalCity}</span>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          {(["all", "flight", "train", "bus"] as FilterType[]).map((type) => {
            const count = typeCounts[type] ?? 0;
            if (type !== "all" && count === 0) return null;
            return (
              <button
                key={type}
                onClick={() => setFilterType(type)}
                className={`px-3 py-1.5 rounded-lg text-xs border transition ${filterType === type ? "border-foreground text-foreground bg-muted/50" : "border-border text-muted-foreground hover:text-foreground"}`}
              >
                {type === "all" ? "All" : type.charAt(0).toUpperCase() + type.slice(1)} ({count})
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {(
            [
              { key: "package", label: "Package" },
              { key: "fare", label: "Fare" },
              { key: "duration", label: "Duration" },
              { key: "departure", label: "Departure" },
            ] as { key: SortKey; label: string }[]
          ).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setSortBy(key)}
              className={`px-3 py-1.5 rounded-lg text-xs border transition ${sortBy === key ? "border-foreground text-foreground bg-muted/50" : "border-border text-muted-foreground hover:text-foreground"}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 && options.length > 0 ? (
        <div className="text-center py-8">
          <p className="text-muted-foreground text-sm mb-3">No {filterType} options for this route.</p>
          <button
            onClick={() => setFilterType("all")}
            className="text-sm text-primary hover:underline"
          >
            Show all {options.length} options
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">No travel options found for this route.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <AnimatePresence mode="popLayout">
            {filtered.map((option) => (
              <TravelCard
                key={option.id}
                option={option}
                path={pathByOption[option.id]}
                departureCity={departureCity}
                arrivalCity={arrivalCity}
                onSelect={onSelect}
              />
            ))}
          </AnimatePresence>
        </div>
      )}

      <div className="text-center pt-2">
        <button
          onClick={onSkip}
          className="text-sm text-muted-foreground hover:text-foreground transition underline underline-offset-2"
        >
          Skip — I&apos;ll arrange my own travel
        </button>
      </div>
    </div>
  );
}
