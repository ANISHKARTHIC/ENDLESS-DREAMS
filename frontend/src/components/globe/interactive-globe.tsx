"use client";

import React, { useRef, useEffect, useCallback, useState } from "react";
import createGlobe, { type Marker } from "cobe";

interface GlobeProps {
  focusLat?: number;
  focusLng?: number;
  departureLat?: number;
  departureLng?: number;
  size?: number;
  className?: string;
  autoRotate?: boolean;
  markers?: { lat: number; lng: number; size?: number; color?: [number, number, number] }[];
  arcs?: { startLat: number; startLng: number; endLat: number; endLng: number; color?: [number, number, number] }[];
  dark?: boolean;
}

function latLngToAngles(lat: number, lng: number): [number, number] {
  return [
    Math.PI - ((lng * Math.PI) / 180 - Math.PI / 2),
    (lat * Math.PI) / 180,
  ];
}

export function InteractiveGlobe({
  focusLat,
  focusLng,
  departureLat,
  departureLng,
  size = 400,
  className = "",
  autoRotate = true,
  markers = [],
  arcs = [],
  dark = true,
}: GlobeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pointerRef = useRef<{ x: number; y: number } | null>(null);
  const phiRef = useRef(0);
  const thetaRef = useRef(0.3);
  const focusRef = useRef<[number, number] | null>(null);
  const widthRef = useRef(0);
  const globeRef = useRef<ReturnType<typeof createGlobe> | null>(null);

  // Update focus when coordinates change
  useEffect(() => {
    if (focusLat !== undefined && focusLng !== undefined) {
      focusRef.current = latLngToAngles(focusLat, focusLng);
    } else {
      focusRef.current = null;
    }
  }, [focusLat, focusLng]);

  // Build marker data
  const markerData = useCallback((): Marker[] => {
    const allMarkers: Marker[] = [];
    if (focusLat !== undefined && focusLng !== undefined) {
      allMarkers.push({ location: [focusLat, focusLng], size: 0.08 }); // dest marker - larger
    }
    if (departureLat !== undefined && departureLng !== undefined) {
      allMarkers.push({ location: [departureLat, departureLng], size: 0.05 }); // departure marker
    }
    markers.forEach((m) => {
      allMarkers.push({ location: [m.lat, m.lng], size: m.size || 0.03 });
    });
    return allMarkers;
  }, [focusLat, focusLng, departureLat, departureLng, markers]);

  useEffect(() => {
    if (!canvasRef.current) return;

    let currentPhi = phiRef.current;
    let currentTheta = thetaRef.current;

    widthRef.current = canvasRef.current.offsetWidth;

    const onResize = () => {
      if (canvasRef.current) {
        widthRef.current = canvasRef.current.offsetWidth;
      }
    };
    window.addEventListener("resize", onResize);

    const globe = createGlobe(canvasRef.current, {
      devicePixelRatio: 2,
      width: widthRef.current * 2,
      height: widthRef.current * 2,
      phi: currentPhi,
      theta: currentTheta,
      dark: dark ? 1 : 0.1,
      diffuse: 1.2,
      mapSamples: 20000,
      mapBrightness: dark ? 2.5 : 6,
      baseColor: dark ? [0.15, 0.18, 0.25] : [0.95, 0.95, 0.98],
      markerColor: [0.055, 0.647, 0.914], // primary color #0ea5e9
      glowColor: dark ? [0.05, 0.15, 0.3] : [0.8, 0.9, 1.0],
      markers: markerData(),
      opacity: dark ? 0.85 : 0.9,
      onRender: (state) => {
        // Handle focus animation (smooth rotation to target)
        if (focusRef.current) {
          const [focusPhi, focusTheta] = focusRef.current;
          const distPhi = focusPhi - currentPhi;
          const distTheta = focusTheta - currentTheta;
          currentPhi += distPhi * 0.08;
          currentTheta += distTheta * 0.08;
        } else if (autoRotate && !pointerRef.current) {
          // Auto rotate when no focus and no pointer interaction
          currentPhi += 0.003;
        }

        // Handle pointer interaction
        if (pointerRef.current) {
          // do nothing — pointer cancels auto-rotation
        }

        state.phi = currentPhi;
        state.theta = currentTheta;
        state.width = widthRef.current * 2;
        state.height = widthRef.current * 2;
        state.markers = markerData();
      },
    });

    globeRef.current = globe;

    // Pointer event handlers
    const canvas = canvasRef.current;
    const handlePointerDown = (e: PointerEvent) => {
      pointerRef.current = { x: e.clientX, y: e.clientY };
      canvas.style.cursor = "grabbing";
    };
    const handlePointerUp = () => {
      pointerRef.current = null;
      canvas.style.cursor = "grab";
    };
    const handlePointerOut = () => {
      pointerRef.current = null;
      canvas.style.cursor = "grab";
    };

    canvas.addEventListener("pointerdown", handlePointerDown);
    canvas.addEventListener("pointerup", handlePointerUp);
    canvas.addEventListener("pointerout", handlePointerOut);

    return () => {
      globe.destroy();
      window.removeEventListener("resize", onResize);
      canvas.removeEventListener("pointerdown", handlePointerDown);
      canvas.removeEventListener("pointerup", handlePointerUp);
      canvas.removeEventListener("pointerout", handlePointerOut);
    };
  }, [dark, autoRotate, markerData]);

  return (
    <div className={`relative ${className}`}>
      {/* Glow effect behind globe */}
      <div
        className="absolute inset-0 rounded-full opacity-30 blur-3xl"
        style={{
          background: "radial-gradient(circle, rgba(14,165,233,0.4) 0%, rgba(6,182,212,0.2) 40%, transparent 70%)",
        }}
      />
      <canvas
        ref={canvasRef}
        style={{
          width: "100%",
          height: "100%",
          maxWidth: `${size}px`,
          aspectRatio: "1",
          cursor: "grab",
          contain: "layout paint size",
        }}
      />
      {/* Route arc overlay - CSS animated */}
      {departureLat !== undefined && focusLat !== undefined && (
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full glass-subtle text-xs text-primary font-medium">
            <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
            Route Active
          </div>
        </div>
      )}
    </div>
  );
}
