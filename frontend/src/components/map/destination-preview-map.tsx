"use client";

import React, { useEffect, useRef, useMemo } from "react";
import MapGL, { Marker, NavigationControl } from "react-map-gl/mapbox";
import type { MapRef } from "react-map-gl/mapbox";
import "mapbox-gl/dist/mapbox-gl.css";
import { MapPin, Navigation as NavIcon } from "lucide-react";

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";

interface DestinationPreviewMapProps {
  destLat?: number;
  destLng?: number;
  destName?: string;
  depLat?: number;
  depLng?: number;
  depName?: string;
  className?: string;
}

export function DestinationPreviewMap({
  destLat,
  destLng,
  destName,
  depLat,
  depLng,
  depName,
  className = "",
}: DestinationPreviewMapProps) {
  const mapRef = useRef<MapRef>(null);

  const center = useMemo(() => {
    if (destLat !== undefined && destLng !== undefined) {
      return { lat: destLat, lng: destLng, zoom: 10 };
    }
    if (depLat !== undefined && depLng !== undefined) {
      return { lat: depLat, lng: depLng, zoom: 4 };
    }
    return { lat: 20.5937, lng: 78.9629, zoom: 3 };
  }, [destLat, destLng, depLat, depLng]);

  useEffect(() => {
    if (!mapRef.current) return;
    mapRef.current.flyTo({
      center: [center.lng, center.lat],
      zoom: center.zoom,
      duration: 1500,
    });
  }, [center]);

  // Arc between departure and destination
  const arcLine = useMemo(() => {
    if (
      depLat === undefined || depLng === undefined ||
      destLat === undefined || destLng === undefined
    )
      return null;

    // Generate a curved arc
    const points: [number, number][] = [];
    const steps = 50;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const lat = depLat + (destLat - depLat) * t;
      const lng = depLng + (destLng - depLng) * t;
      // Add arc height
      const arc = Math.sin(t * Math.PI) * Math.min(15, Math.abs(destLng - depLng) * 0.15);
      points.push([lng, lat + arc]);
    }
    return {
      type: "Feature" as const,
      properties: {},
      geometry: {
        type: "LineString" as const,
        coordinates: points,
      },
    };
  }, [depLat, depLng, destLat, destLng]);

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
    <div className={`rounded-2xl overflow-hidden border border-border/50 shadow-lg ${className}`}>
      <MapGL
        ref={mapRef}
        initialViewState={{
          latitude: center.lat,
          longitude: center.lng,
          zoom: center.zoom,
        }}
        style={{ width: "100%", height: "100%" }}
        mapStyle="mapbox://styles/mapbox/dark-v11"
        mapboxAccessToken={MAPBOX_TOKEN}
        interactive={true}
        attributionControl={false}
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

        {/* Arc line between cities */}
        {arcLine && (
          <>
            {/* @ts-expect-error react-map-gl typing */}
            <source id="arc-source" type="geojson" data={arcLine}>
              {/* @ts-expect-error react-map-gl typing */}
              <layer
                id="arc-line"
                type="line"
                paint={{
                  "line-color": "#06b6d4",
                  "line-width": 2,
                  "line-dasharray": [2, 2],
                  "line-opacity": 0.7,
                }}
              />
            </source>
          </>
        )}
      </MapGL>

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
