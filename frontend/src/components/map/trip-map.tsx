"use client";

import React, { useMemo, useCallback, useState, useRef } from "react";
import Map, { Marker, Source, Layer, NavigationControl } from "react-map-gl/mapbox";
import type { MapRef } from "react-map-gl/mapbox";
import "mapbox-gl/dist/mapbox-gl.css";
import { cn, getCategoryIcon } from "@/lib/utils";
import type { ItineraryItem } from "@/types";

interface TripMapProps {
  items: ItineraryItem[];
  selectedDay?: number;
  onSelectItem?: (itemId: string) => void;
  className?: string;
}

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";

export function TripMap({
  items,
  selectedDay,
  onSelectItem,
  className,
}: TripMapProps) {
  const mapRef = useRef<MapRef>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  // Filter items by day if specified
  const visibleItems = useMemo(() => {
    if (!selectedDay) return items;
    return items.filter((i) => i.day_number === selectedDay);
  }, [items, selectedDay]);

  // Calculate center from items
  const center = useMemo(() => {
    if (!visibleItems.length) return { latitude: 48.8566, longitude: 2.3522 };
    const lats = visibleItems.map((i) => i.place.latitude);
    const lngs = visibleItems.map((i) => i.place.longitude);
    return {
      latitude: lats.reduce((a, b) => a + b, 0) / lats.length,
      longitude: lngs.reduce((a, b) => a + b, 0) / lngs.length,
    };
  }, [visibleItems]);

  // Route line GeoJSON
  const routeGeoJSON = useMemo(() => {
    const coords = visibleItems
      .sort((a, b) => a.day_number - b.day_number || a.order - b.order)
      .map((i) => [i.place.longitude, i.place.latitude]);

    return {
      type: "Feature" as const,
      properties: {},
      geometry: {
        type: "LineString" as const,
        coordinates: coords,
      },
    };
  }, [visibleItems]);

  if (!MAPBOX_TOKEN) {
    return (
      <div
        className={cn(
          "rounded-2xl border border-border bg-muted/30 flex items-center justify-center",
          "min-h-[400px]",
          className
        )}
      >
        <div className="text-center p-6">
          <div className="text-4xl mb-3">🗺️</div>
          <p className="font-medium text-foreground">Map Preview</p>
          <p className="text-sm text-muted-foreground mt-1">
            Set NEXT_PUBLIC_MAPBOX_TOKEN to enable interactive maps
          </p>
          {/* Static preview of markers */}
          <div className="mt-4 space-y-2">
            {visibleItems.slice(0, 5).map((item, idx) => (
              <div
                key={item.id}
                className="flex items-center gap-2 text-sm text-muted-foreground"
              >
                <span className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                  {idx + 1}
                </span>
                <span>{getCategoryIcon(item.place.category)}</span>
                <span>{item.place.name}</span>
              </div>
            ))}
            {visibleItems.length > 5 && (
              <p className="text-xs text-muted-foreground">
                +{visibleItems.length - 5} more places
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("rounded-2xl overflow-hidden border border-border", className)}>
      <Map
        ref={mapRef}
        initialViewState={{
          ...center,
          zoom: 12,
        }}
        style={{ width: "100%", height: 400 }}
        mapStyle="mapbox://styles/mapbox/dark-v11"
        mapboxAccessToken={MAPBOX_TOKEN}
      >
        <NavigationControl position="top-right" />

        {/* Route line */}
        {visibleItems.length > 1 && (
          <Source type="geojson" data={routeGeoJSON}>
            <Layer
              id="route-line"
              type="line"
              paint={{
                "line-color": "#0ea5e9",
                "line-width": 3,
                "line-opacity": 0.7,
                "line-dasharray": [2, 2],
              }}
            />
          </Source>
        )}

        {/* Markers */}
        {visibleItems.map((item, idx) => (
          <Marker
            key={item.id}
            latitude={item.place.latitude}
            longitude={item.place.longitude}
            anchor="bottom"
            onClick={() => onSelectItem?.(item.id)}
          >
            <div
              onMouseEnter={() => setHoveredId(item.id)}
              onMouseLeave={() => setHoveredId(null)}
              className="relative cursor-pointer group"
            >
              <div
                className={cn(
                  "h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold",
                  "shadow-lg transition-all duration-200",
                  "bg-primary text-primary-foreground",
                  "group-hover:scale-110 group-hover:shadow-primary/40"
                )}
              >
                {idx + 1}
              </div>

              {/* Tooltip */}
              {hoveredId === item.id && (
                <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 whitespace-nowrap">
                  <div className="glass-card px-3 py-1.5 text-xs font-medium">
                    {getCategoryIcon(item.place.category)} {item.place.name}
                  </div>
                </div>
              )}
            </div>
          </Marker>
        ))}
      </Map>
    </div>
  );
}
