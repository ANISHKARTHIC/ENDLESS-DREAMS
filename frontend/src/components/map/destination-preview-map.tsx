"use client";

import React, { useEffect, useRef, useMemo, useCallback, useState } from "react";
import MapGL, { Marker, NavigationControl, Source, Layer } from "react-map-gl/mapbox";
import type { MapRef, LayerProps } from "react-map-gl/mapbox";
import "mapbox-gl/dist/mapbox-gl.css";
import { MapPin, Navigation as NavIcon, Route, Clock, Loader2 } from "lucide-react";
import { getRouteInfo, formatDistance, type RouteInfo } from "@/lib/mapbox";

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";

interface DestinationPreviewMapProps {
  destLat?: number;
  destLng?: number;
  destName?: string;
  depLat?: number;
  depLng?: number;
  depName?: string;
  className?: string;
  /** If true, fetch real driving route from Directions API instead of arc */
  showRealRoute?: boolean;
  /** Callback when route info is loaded */
  onRouteLoad?: (info: RouteInfo) => void;
}

export function DestinationPreviewMap({
  destLat,
  destLng,
  destName,
  depLat,
  depLng,
  depName,
  className = "",
  showRealRoute = true,
  onRouteLoad,
}: DestinationPreviewMapProps) {
  const mapRef = useRef<MapRef>(null);
  const [routeInfo, setRouteInfo] = useState<RouteInfo | null>(null);
  const [isLoadingRoute, setIsLoadingRoute] = useState(false);

  const center = useMemo(() => {
    // When both points exist, calculate center between them
    if (
      depLat !== undefined && depLng !== undefined &&
      destLat !== undefined && destLng !== undefined
    ) {
      return {
        lat: (depLat + destLat) / 2,
        lng: (depLng + destLng) / 2,
        zoom: 4,
      };
    }
    if (destLat !== undefined && destLng !== undefined) {
      return { lat: destLat, lng: destLng, zoom: 10 };
    }
    if (depLat !== undefined && depLng !== undefined) {
      return { lat: depLat, lng: depLng, zoom: 4 };
    }
    return { lat: 20.5937, lng: 78.9629, zoom: 3 };
  }, [destLat, destLng, depLat, depLng]);

  // Fetch real route when both coordinates are available
  useEffect(() => {
    if (
      !showRealRoute ||
      depLat === undefined || depLng === undefined ||
      destLat === undefined || destLng === undefined
    ) {
      setRouteInfo(null);
      return;
    }

    let cancelled = false;
    setIsLoadingRoute(true);

    getRouteInfo(
      { lat: depLat, lng: depLng },
      { lat: destLat, lng: destLng }
    ).then((info) => {
      if (!cancelled) {
        setRouteInfo(info);
        setIsLoadingRoute(false);
        onRouteLoad?.(info);
      }
    }).catch(() => {
      if (!cancelled) {
        setRouteInfo(null);
        setIsLoadingRoute(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [depLat, depLng, destLat, destLng, showRealRoute, onRouteLoad]);

  useEffect(() => {
    if (!mapRef.current) return;
    mapRef.current.flyTo({
      center: [center.lng, center.lat],
      zoom: center.zoom,
      duration: 1500,
    });
  }, [center]);

  // Route line data - use real route geometry if available, fallback to arc
  const routeData = useMemo(() => {
    // If we have real route geometry from Directions API, use it
    if (routeInfo?.geometry) {
      return {
        type: "FeatureCollection" as const,
        features: [
          {
            type: "Feature" as const,
            properties: {},
            geometry: routeInfo.geometry,
          },
        ],
      };
    }

    // Fallback: arc between departure and destination
    if (
      depLat === undefined || depLng === undefined ||
      destLat === undefined || destLng === undefined
    )
      return null;

    const points: [number, number][] = [];
    const steps = 50;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const lat = depLat + (destLat - depLat) * t;
      const lng = depLng + (destLng - depLng) * t;
      const arc = Math.sin(t * Math.PI) * Math.min(15, Math.abs(destLng - depLng) * 0.15);
      points.push([lng, lat + arc]);
    }
    return {
      type: "FeatureCollection" as const,
      features: [
        {
          type: "Feature" as const,
          properties: {},
          geometry: {
            type: "LineString" as const,
            coordinates: points,
          },
        },
      ],
    };
  }, [depLat, depLng, destLat, destLng, routeInfo]);

  const routeLineStyle: LayerProps = useMemo(
    () => ({
      id: "route-line",
      type: "line" as const,
      paint: {
        "line-color": routeInfo?.geometry ? "#3b82f6" : "#06b6d4",
        "line-width": routeInfo?.geometry ? 3 : 2.5,
        "line-dasharray": routeInfo?.geometry ? [1, 0] : [2, 2],
        "line-opacity": 0.85,
      },
    }),
    [routeInfo]
  );

  const onMapLoad = useCallback(() => {
    // Map ready
  }, []);

  if (!MAPBOX_TOKEN) {
    return (
      <div className={`rounded-2xl bg-muted/50 flex items-center justify-center ${className}`}>
        <div className="text-center p-4">
          <MapPin className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
          <p className="text-xs text-muted-foreground">Map preview unavailable</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`rounded-2xl overflow-hidden border border-border/50 shadow-lg relative ${className}`}>
      <MapGL
        ref={mapRef}
        initialViewState={{
          latitude: center.lat,
          longitude: center.lng,
          zoom: center.zoom,
        }}
        style={{ width: "100%", height: "100%" }}
        mapStyle="mapbox://styles/mapbox/streets-v12"
        mapboxAccessToken={MAPBOX_TOKEN}
        interactive={true}
        attributionControl={false}
        onLoad={onMapLoad}
      >
        <NavigationControl position="top-right" showCompass={false} />

        {/* Departure marker */}
        {depLat !== undefined && depLng !== undefined && (
          <Marker latitude={depLat} longitude={depLng} anchor="bottom">
            <div className="flex flex-col items-center animate-in fade-in">
              <div className="px-2 py-0.5 rounded-full bg-sky-500/90 text-[9px] font-bold text-white shadow-lg mb-1 whitespace-nowrap">
                {depName || "Departure"}
              </div>
              <div className="h-6 w-6 rounded-full bg-sky-500 border-2 border-white shadow-lg flex items-center justify-center">
                <NavIcon className="h-3 w-3 text-white" />
              </div>
            </div>
          </Marker>
        )}

        {/* Destination marker */}
        {destLat !== undefined && destLng !== undefined && (
          <Marker latitude={destLat} longitude={destLng} anchor="bottom">
            <div className="flex flex-col items-center animate-in fade-in">
              <div className="px-2 py-0.5 rounded-full bg-emerald-500/90 text-[9px] font-bold text-white shadow-lg mb-1 whitespace-nowrap">
                {destName || "Destination"}
              </div>
              <div className="h-8 w-8 rounded-full bg-emerald-500 border-2 border-white shadow-lg flex items-center justify-center animate-bounce">
                <MapPin className="h-4 w-4 text-white" />
              </div>
            </div>
          </Marker>
        )}

        {/* Route line between cities */}
        {routeData && (
          <Source id="route-source" type="geojson" data={routeData}>
            <Layer {...routeLineStyle} />
          </Source>
        )}
      </MapGL>

      {/* Route info overlay - shows distance and duration */}
      {routeInfo && depLat !== undefined && destLat !== undefined && (
        <div className="absolute bottom-3 left-3 right-3 flex justify-center pointer-events-none">
          <div className="bg-gray-900/85 backdrop-blur-sm px-4 py-2 rounded-xl flex items-center gap-4 text-white text-sm shadow-xl border border-white/10">
            <div className="flex items-center gap-1.5">
              <Route className="h-4 w-4 text-blue-400" />
              <span className="font-medium">{formatDistance(routeInfo.distanceKm)}</span>
            </div>
            <div className="w-px h-4 bg-white/20" />
            <div className="flex items-center gap-1.5">
              <Clock className="h-4 w-4 text-emerald-400" />
              <span className="font-medium">{routeInfo.durationFormatted}</span>
            </div>
          </div>
        </div>
      )}

      {/* Loading indicator for route */}
      {isLoadingRoute && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2">
          <div className="bg-gray-900/85 backdrop-blur-sm px-3 py-1.5 rounded-full flex items-center gap-2 text-white text-xs shadow-lg border border-white/10">
            <Loader2 className="h-3 w-3 animate-spin" />
            <span>Calculating route...</span>
          </div>
        </div>
      )}

      {/* Overlay label */}
      {!destLat && !depLat && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/30 backdrop-blur-sm rounded-2xl">
          <div className="text-center">
            <MapPin className="h-8 w-8 text-primary/50 mx-auto mb-2 animate-pulse" />
            <p className="text-xs text-muted-foreground font-medium">
              Select a destination to preview
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
