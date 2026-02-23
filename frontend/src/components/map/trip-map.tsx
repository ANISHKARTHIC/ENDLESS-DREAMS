"use client";

import React, { useMemo, useState, useRef, useEffect, useCallback } from "react";
import MapGL, {
  Marker,
  Source,
  Layer,
  NavigationControl,
  Popup,
} from "react-map-gl/mapbox";
import type { MapRef } from "react-map-gl/mapbox";
import "mapbox-gl/dist/mapbox-gl.css";
import { cn, getCategoryIcon, formatTime } from "@/lib/utils";
import type { ItineraryItem } from "@/types";
import {
  Clock,
  DollarSign,
  Star,
  Navigation,
  Route,
  Loader2,
  Car,
  Footprints,
  MapPin,
} from "lucide-react";

/* ─── Constants ─── */

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";

const DAY_COLORS = [
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
  "#f59e0b",
  "#10b981",
  "#06b6d4",
  "#ef4444",
  "#84cc16",
  "#f97316",
  "#6366f1",
];

/* ─── Types ─── */

interface RouteData {
  day: number;
  geometry: GeoJSON.LineString;
  distance_km: number;
  duration_minutes: number;
  color: string;
}

interface TripMapProps {
  items: ItineraryItem[];
  selectedDay?: number;
  onSelectItem?: (itemId: string) => void;
  onDaySelect?: (day: number | undefined) => void;
  className?: string;
}

/* ─── Mapbox Directions API helper ─── */

async function fetchDirectionsRoute(
  coordinates: [number, number][],
  token: string
): Promise<{
  geometry: GeoJSON.LineString;
  distance: number;
  duration: number;
} | null> {
  if (coordinates.length < 2 || !token) return null;

  const coordStr = coordinates
    .map(([lng, lat]) => `${lng},${lat}`)
    .join(";");

  try {
    const res = await fetch(
      `https://api.mapbox.com/directions/v5/mapbox/driving/${coordStr}?geometries=geojson&overview=full&access_token=${token}`
    );
    if (!res.ok) throw new Error(`Directions API ${res.status}`);
    const data = await res.json();

    if (data.routes?.[0]) {
      return {
        geometry: data.routes[0].geometry,
        distance: data.routes[0].distance, // metres
        duration: data.routes[0].duration, // seconds
      };
    }
  } catch (e) {
    console.warn("Directions API failed, falling back to straight line:", e);
  }

  // Fallback: straight line between places
  return {
    geometry: { type: "LineString", coordinates },
    distance: 0,
    duration: 0,
  };
}

/* ─── Popup CSS (injected once) ─── */

const POPUP_CSS = `
.trip-map-popup .mapboxgl-popup-content {
  padding: 0 !important;
  border-radius: 14px !important;
  overflow: hidden;
  box-shadow: 0 12px 48px rgba(0,0,0,0.35) !important;
  border: 1px solid rgba(255,255,255,0.08);
}
.trip-map-popup .mapboxgl-popup-close-button {
  font-size: 20px;
  color: #9ca3af;
  padding: 2px 8px;
  right: 2px;
  top: 2px;
}
.trip-map-popup .mapboxgl-popup-close-button:hover {
  color: #374151;
  background: rgba(0,0,0,0.06);
  border-radius: 6px;
}
.trip-map-popup .mapboxgl-popup-tip {
  border-top-color: white !important;
}
`;

/* ─── Component ─── */

export function TripMap({
  items,
  selectedDay,
  onSelectItem,
  onDaySelect,
  className,
}: TripMapProps) {
  const mapRef = useRef<MapRef>(null);
  const [routes, setRoutes] = useState<RouteData[]>([]);
  const [selectedPlace, setSelectedPlace] = useState<ItineraryItem | null>(
    null
  );
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [routesLoading, setRoutesLoading] = useState(false);

  // Inject popup CSS once
  useEffect(() => {
    const id = "trip-map-popup-css";
    if (document.getElementById(id)) return;
    const style = document.createElement("style");
    style.id = id;
    style.textContent = POPUP_CSS;
    document.head.appendChild(style);
  }, []);

  /* ─ Derived data ─ */

  const visibleItems = useMemo(() => {
    if (!selectedDay) return items;
    return items.filter((i) => i.day_number === selectedDay);
  }, [items, selectedDay]);

  const dayGroups = useMemo(() => {
    const groups = new Map<number, ItineraryItem[]>();
    visibleItems.forEach((item) => {
      if (!groups.has(item.day_number)) groups.set(item.day_number, []);
      groups.get(item.day_number)!.push(item);
    });
    groups.forEach((arr) => arr.sort((a, b) => a.order - b.order));
    return groups;
  }, [visibleItems]);

  const allDays = useMemo(
    () => [...new Set(items.map((i) => i.day_number))].sort((a, b) => a - b),
    [items]
  );

  const bounds = useMemo(() => {
    if (!visibleItems.length) return null;
    let minLng = Infinity,
      maxLng = -Infinity,
      minLat = Infinity,
      maxLat = -Infinity;
    visibleItems.forEach((i) => {
      minLng = Math.min(minLng, i.place.longitude);
      maxLng = Math.max(maxLng, i.place.longitude);
      minLat = Math.min(minLat, i.place.latitude);
      maxLat = Math.max(maxLat, i.place.latitude);
    });
    const lngPad = Math.max((maxLng - minLng) * 0.2, 0.008);
    const latPad = Math.max((maxLat - minLat) * 0.2, 0.008);
    return [
      [minLng - lngPad, minLat - latPad],
      [maxLng + lngPad, maxLat + latPad],
    ] as [[number, number], [number, number]];
  }, [visibleItems]);

  const center = useMemo(() => {
    if (!visibleItems.length)
      return { latitude: 20.5937, longitude: 78.9629 };
    const lats = visibleItems.map((i) => i.place.latitude);
    const lngs = visibleItems.map((i) => i.place.longitude);
    return {
      latitude: lats.reduce((a, b) => a + b, 0) / lats.length,
      longitude: lngs.reduce((a, b) => a + b, 0) / lngs.length,
    };
  }, [visibleItems]);

  const routeCollection = useMemo(
    () => ({
      type: "FeatureCollection" as const,
      features: routes.map((r) => ({
        type: "Feature" as const,
        properties: { day: r.day, color: r.color },
        geometry: r.geometry,
      })),
    }),
    [routes]
  );

  /* ─ Fetch real road routes ─ */

  useEffect(() => {
    if (!MAPBOX_TOKEN || !visibleItems.length) {
      setRoutes([]);
      return;
    }

    let cancelled = false;
    setRoutesLoading(true);

    (async () => {
      const results: RouteData[] = [];

      for (const [day, dayItems] of dayGroups) {
        if (dayItems.length < 2) continue;
        const coords: [number, number][] = dayItems.map((i) => [
          i.place.longitude,
          i.place.latitude,
        ]);
        const result = await fetchDirectionsRoute(coords, MAPBOX_TOKEN);
        if (result && !cancelled) {
          results.push({
            day,
            geometry: result.geometry,
            distance_km: result.distance / 1000,
            duration_minutes: Math.round(result.duration / 60),
            color: DAY_COLORS[(day - 1) % DAY_COLORS.length],
          });
        }
      }

      if (!cancelled) {
        setRoutes(results);
        setRoutesLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(visibleItems.map((i) => i.id))]);

  /* ─ Fit bounds ─ */

  useEffect(() => {
    if (mapLoaded && mapRef.current && bounds) {
      mapRef.current.fitBounds(bounds, {
        padding: { top: 80, bottom: 80, left: 80, right: 80 },
        duration: 800,
      });
    }
  }, [mapLoaded, bounds]);

  /* ─ Helpers ─ */

  const getGlobalIndex = useCallback(
    (item: ItineraryItem) => {
      const sorted = [...items].sort(
        (a, b) => a.day_number - b.day_number || a.order - b.order
      );
      return sorted.findIndex((i) => i.id === item.id) + 1;
    },
    [items]
  );

  const sortedVisible = useMemo(
    () =>
      [...visibleItems].sort(
        (a, b) => a.day_number - b.day_number || a.order - b.order
      ),
    [visibleItems]
  );

  /* ─ Render: no token fallback ─ */

  if (!MAPBOX_TOKEN) {
    return (
      <div
        className={cn(
          "rounded-2xl border border-border bg-muted/30 flex items-center justify-center min-h-[400px]",
          className
        )}
      >
        <div className="text-center p-6">
          <div className="text-4xl mb-3">🗺️</div>
          <p className="font-medium text-foreground">Map Preview</p>
          <p className="text-sm text-muted-foreground mt-1">
            Set NEXT_PUBLIC_MAPBOX_TOKEN to enable interactive maps
          </p>
          <div className="mt-4 space-y-2">
            {visibleItems.slice(0, 6).map((item, idx) => (
              <div
                key={item.id}
                className="flex items-center gap-2 text-sm text-muted-foreground"
              >
                <span
                  className="h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold text-white"
                  style={{
                    backgroundColor:
                      DAY_COLORS[
                        (item.day_number - 1) % DAY_COLORS.length
                      ],
                  }}
                >
                  {idx + 1}
                </span>
                <span>{getCategoryIcon(item.place.category)}</span>
                <span className="truncate">{item.place.name}</span>
              </div>
            ))}
            {visibleItems.length > 6 && (
              <p className="text-xs text-muted-foreground">
                +{visibleItems.length - 6} more places
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  /* ─ Render: full interactive map ─ */

  return (
    <div
      className={cn(
        "relative rounded-2xl overflow-hidden border border-border",
        className
      )}
    >
      <MapGL
        ref={mapRef}
        initialViewState={{ ...center, zoom: 12 }}
        style={{ width: "100%", height: 600 }}
        mapStyle="mapbox://styles/mapbox/dark-v11"
        mapboxAccessToken={MAPBOX_TOKEN}
        onLoad={() => setMapLoaded(true)}
        onClick={() => setSelectedPlace(null)}
      >
        <NavigationControl position="top-right" />

        {/* ── Road routes ── */}
        {routes.length > 0 && (
          <Source
            id="trip-routes"
            type="geojson"
            data={routeCollection as GeoJSON.FeatureCollection}
          >
            {/* Glow */}
            <Layer
              id="route-glow"
              type="line"
              paint={{
                "line-color": ["get", "color"],
                "line-width": 12,
                "line-opacity": 0.1,
                "line-blur": 6,
              }}
            />
            {/* Main line */}
            <Layer
              id="route-main"
              type="line"
              layout={{ "line-cap": "round", "line-join": "round" }}
              paint={{
                "line-color": ["get", "color"],
                "line-width": 4,
                "line-opacity": 0.9,
              }}
            />
            {/* Dashed direction overlay */}
            <Layer
              id="route-dash"
              type="line"
              paint={{
                "line-color": "#ffffff",
                "line-width": 1.5,
                "line-opacity": 0.3,
                "line-dasharray": [0, 4, 3],
              }}
            />
          </Source>
        )}

        {/* ── Travel time labels between consecutive stops ── */}
        {Array.from(dayGroups).flatMap(([, dayItems]: [number, ItineraryItem[]]) =>
          dayItems.slice(0, -1).map((item: ItineraryItem, idx: number) => {
            const next = dayItems[idx + 1];
            const midLat =
              (item.place.latitude + next.place.latitude) / 2;
            const midLng =
              (item.place.longitude + next.place.longitude) / 2;
            const travelMin = next.travel_time_minutes || 0;
            if (travelMin <= 0) return null;

            return (
              <Marker
                key={`tt-${item.id}-${next.id}`}
                latitude={midLat}
                longitude={midLng}
                anchor="center"
              >
                <div className="pointer-events-none bg-gray-900/80 backdrop-blur-sm px-2 py-0.5 rounded-full flex items-center gap-1 border border-white/10 shadow-lg">
                  {travelMin > 15 ? (
                    <Car className="h-2.5 w-2.5 text-white/70" />
                  ) : (
                    <Footprints className="h-2.5 w-2.5 text-white/70" />
                  )}
                  <span className="text-[10px] text-white font-medium">
                    {travelMin}m
                  </span>
                </div>
              </Marker>
            );
          })
        )}

        {/* ── Place markers ── */}
        {sortedVisible.map((item) => {
          const idx = getGlobalIndex(item);
          const dayColor =
            DAY_COLORS[(item.day_number - 1) % DAY_COLORS.length];
          const isSelected = selectedPlace?.id === item.id;
          const isHovered = hoveredId === item.id;

          return (
            <Marker
              key={item.id}
              latitude={item.place.latitude}
              longitude={item.place.longitude}
              anchor="bottom"
              onClick={(e) => {
                e.originalEvent.stopPropagation();
                setSelectedPlace(item);
                onSelectItem?.(item.id);
              }}
            >
              <div
                onMouseEnter={() => setHoveredId(item.id)}
                onMouseLeave={() => setHoveredId(null)}
                className="relative cursor-pointer"
              >
                {/* Pulse ring */}
                {isSelected && (
                  <div
                    className="absolute -inset-2 rounded-full animate-ping opacity-20"
                    style={{ backgroundColor: dayColor }}
                  />
                )}

                {/* Marker pin */}
                <div className="relative flex flex-col items-center">
                  <div
                    className={cn(
                      "h-10 w-10 rounded-full flex items-center justify-center text-sm font-bold",
                      "shadow-lg border-[2.5px] border-white transition-all duration-200",
                      (isSelected || isHovered) &&
                        "scale-125 shadow-xl"
                    )}
                    style={{ backgroundColor: dayColor }}
                  >
                    <span className="text-white drop-shadow">
                      {idx}
                    </span>
                  </div>
                  {/* Pin tail */}
                  <div
                    className="w-0 h-0 -mt-0.5"
                    style={{
                      borderLeft: "6px solid transparent",
                      borderRight: "6px solid transparent",
                      borderTop: `8px solid ${dayColor}`,
                    }}
                  />
                </div>

                {/* Hover tooltip */}
                {isHovered && !isSelected && (
                  <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 whitespace-nowrap z-50 pointer-events-none">
                    <div className="bg-gray-900/90 backdrop-blur-sm px-3 py-1.5 rounded-lg text-xs text-white font-medium shadow-xl border border-white/10">
                      {getCategoryIcon(item.place.category)}{" "}
                      {item.place.name}
                    </div>
                  </div>
                )}
              </div>
            </Marker>
          );
        })}

        {/* ── Popup detail card ── */}
        {selectedPlace && (
          <Popup
            latitude={selectedPlace.place.latitude}
            longitude={selectedPlace.place.longitude}
            anchor="bottom"
            offset={55}
            closeOnClick={false}
            onClose={() => setSelectedPlace(null)}
            maxWidth="300px"
            className="trip-map-popup"
          >
            <div className="p-3 min-w-[250px] bg-white">
              {/* Header */}
              <div className="flex items-center gap-2.5 mb-2">
                <div
                  className="h-9 w-9 rounded-lg flex items-center justify-center text-lg"
                  style={{
                    backgroundColor: `${DAY_COLORS[(selectedPlace.day_number - 1) % DAY_COLORS.length]}15`,
                  }}
                >
                  {getCategoryIcon(selectedPlace.place.category)}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-bold text-sm text-gray-900 leading-tight truncate">
                    {selectedPlace.place.name}
                  </h4>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span
                      className="text-[10px] px-1.5 py-0.5 rounded-full font-medium capitalize"
                      style={{
                        backgroundColor: `${DAY_COLORS[(selectedPlace.day_number - 1) % DAY_COLORS.length]}15`,
                        color:
                          DAY_COLORS[
                            (selectedPlace.day_number - 1) %
                              DAY_COLORS.length
                          ],
                      }}
                    >
                      Day {selectedPlace.day_number}
                    </span>
                    <span className="text-[10px] text-gray-400 capitalize">
                      {selectedPlace.place.category}
                    </span>
                  </div>
                </div>
              </div>

              {/* Description */}
              {selectedPlace.place.description && (
                <p className="text-xs text-gray-500 mb-2.5 line-clamp-2 leading-relaxed">
                  {selectedPlace.place.description}
                </p>
              )}

              {/* Stats grid */}
              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs text-gray-600 border-t border-gray-100 pt-2.5">
                <div className="flex items-center gap-1.5">
                  <Clock className="h-3 w-3 text-gray-400" />
                  <span>
                    {formatTime(selectedPlace.start_time)} –{" "}
                    {formatTime(selectedPlace.end_time)}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <DollarSign className="h-3 w-3 text-gray-400" />
                  <span>
                    $
                    {Number(
                      selectedPlace.estimated_cost_usd
                    ).toFixed(0)}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Clock className="h-3 w-3 text-gray-400" />
                  <span>{selectedPlace.duration_minutes} min</span>
                </div>
                {Number(selectedPlace.place.rating) > 0 && (
                  <div className="flex items-center gap-1.5">
                    <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                    <span>
                      {Number(selectedPlace.place.rating).toFixed(1)}
                    </span>
                  </div>
                )}
              </div>

              {/* Travel time from previous */}
              {selectedPlace.travel_time_minutes > 0 && (
                <div className="flex items-center gap-1.5 mt-2.5 pt-2 border-t border-gray-100 text-xs text-gray-500">
                  <Car className="h-3 w-3" />
                  <span>
                    {selectedPlace.travel_time_minutes} min travel
                    from previous stop
                  </span>
                </div>
              )}
            </div>
          </Popup>
        )}
      </MapGL>

      {/* ── Route loading indicator ── */}
      {routesLoading && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-gray-900/85 backdrop-blur-sm px-4 py-2 rounded-full text-xs text-white flex items-center gap-2 z-10 border border-white/10 shadow-xl">
          <Loader2 className="h-3 w-3 animate-spin" />
          Calculating road routes…
        </div>
      )}

      {/* ── Route summary overlay ── */}
      {routes.length > 0 && !routesLoading && (
        <div className="absolute top-4 left-4 bg-gray-900/80 backdrop-blur-md rounded-xl p-3.5 text-xs text-white z-10 min-w-[210px] border border-white/10 shadow-xl">
          <div className="flex items-center gap-1.5 mb-2.5 font-semibold text-white/90">
            <Route className="h-3.5 w-3.5" />
            Route Overview
          </div>
          <div className="space-y-1.5">
            {routes.map((r) => (
              <div key={r.day} className="flex items-center gap-2">
                <div
                  className="h-2.5 w-2.5 rounded-full flex-shrink-0 ring-1 ring-white/20"
                  style={{ backgroundColor: r.color }}
                />
                <span className="flex-1 text-white/80">
                  Day {r.day}
                </span>
                <span className="text-white/50 tabular-nums">
                  {r.distance_km.toFixed(1)}km
                </span>
                <span className="text-white/50 tabular-nums">
                  {r.duration_minutes}min
                </span>
              </div>
            ))}
            <div className="border-t border-white/15 pt-1.5 mt-1 flex items-center gap-2 font-semibold">
              <Navigation className="h-3 w-3 text-sky-400" />
              <span className="flex-1">Total</span>
              <span className="tabular-nums">
                {routes
                  .reduce((s, r) => s + r.distance_km, 0)
                  .toFixed(1)}
                km
              </span>
              <span className="tabular-nums">
                {routes.reduce(
                  (s, r) => s + r.duration_minutes,
                  0
                )}
                min
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ── Map-embedded day filter ── */}
      {allDays.length > 1 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-1.5 bg-gray-900/75 backdrop-blur-md rounded-full px-2.5 py-1.5 z-10 border border-white/10 shadow-xl">
          <button
            onClick={() => onDaySelect?.(undefined)}
            className={cn(
              "px-3 py-1 rounded-full text-xs font-medium transition-all",
              !selectedDay
                ? "bg-white text-black shadow"
                : "text-white/60 hover:text-white"
            )}
          >
            All
          </button>
          {allDays.map((d) => (
            <button
              key={d}
              onClick={() => onDaySelect?.(d)}
              className={cn(
                "px-3 py-1 rounded-full text-xs font-medium transition-all",
                selectedDay === d
                  ? "text-white shadow"
                  : "text-white/50 hover:text-white/80"
              )}
              style={
                selectedDay === d
                  ? {
                      backgroundColor:
                        DAY_COLORS[(d - 1) % DAY_COLORS.length],
                    }
                  : {}
              }
            >
              D{d}
            </button>
          ))}
        </div>
      )}

      {/* ── Legend showing marker count ── */}
      <div className="absolute bottom-4 right-4 bg-gray-900/75 backdrop-blur-md rounded-lg px-3 py-2 text-[10px] text-white/60 z-10 border border-white/10 flex items-center gap-1.5">
        <MapPin className="h-3 w-3" />
        {sortedVisible.length} places
      </div>
    </div>
  );
}
