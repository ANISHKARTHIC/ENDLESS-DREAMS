"use client";

import React, { useState, useEffect } from "react";
import {
  Cloud,
  Droplets,
  Wind,
  Thermometer,
  Sun,
  CloudRain,
  Zap,
  CloudSnow,
  Eye,
} from "lucide-react";
import type { WeatherData } from "@/types";
import { cn } from "@/lib/utils";

interface WeatherOverlayProps {
  weather: WeatherData;
  className?: string;
  compact?: boolean;
}

function getWeatherIcon(condition: string, size: "sm" | "lg" = "lg") {
  const c = condition.toLowerCase();
  const cls = size === "lg" ? "h-9 w-9" : "h-5 w-5";
  if (c.includes("thunder") || c.includes("storm"))
    return <Zap className={cn(cls, "text-yellow-400")} />;
  if (c.includes("snow") || c.includes("blizzard"))
    return <CloudSnow className={cn(cls, "text-blue-200")} />;
  if (c.includes("rain") || c.includes("drizzle"))
    return <CloudRain className={cn(cls, "text-blue-400")} />;
  if (c.includes("cloud"))
    return <Cloud className={cn(cls, "text-gray-400")} />;
  if (c.includes("mist") || c.includes("fog") || c.includes("haze"))
    return <Eye className={cn(cls, "text-slate-400")} />;
  return <Sun className={cn(cls, "text-amber-400")} />;
}

function getWeatherBg(condition: string) {
  const c = condition.toLowerCase();
  if (c.includes("thunder") || c.includes("storm"))
    return "from-slate-900/30 to-purple-900/20";
  if (c.includes("rain") || c.includes("drizzle"))
    return "from-blue-900/20 to-slate-600/10";
  if (c.includes("snow"))
    return "from-blue-200/20 to-slate-100/20";
  if (c.includes("cloud"))
    return "from-slate-500/10 to-slate-600/10";
  return "from-amber-500/10 to-sky-500/10";
}

export function WeatherOverlay({
  weather,
  className,
  compact = false,
}: WeatherOverlayProps) {
  const [lastUpdated, setLastUpdated] = useState<string>("just now");

  useEffect(() => {
    const update = () => {
      if (!weather.timestamp) { setLastUpdated("just now"); return; }
      const diffSec = Math.floor(
        (Date.now() - new Date(weather.timestamp).getTime()) / 1000
      );
      if (diffSec < 60) setLastUpdated("just now");
      else if (diffSec < 3600) setLastUpdated(`${Math.floor(diffSec / 60)}m ago`);
      else setLastUpdated(`${Math.floor(diffSec / 3600)}h ago`);
    };
    update();
    const timer = setInterval(update, 30_000);
    return () => clearInterval(timer);
  }, [weather.timestamp]);

  if (compact) {
    return (
      <div
        className={cn(
          "inline-flex items-center gap-2 px-3 py-1.5 rounded-full glass-subtle",
          className
        )}
      >
        {getWeatherIcon(weather.condition, "sm")}
        <span className="text-sm font-medium text-foreground">
          {Math.round(weather.temperature)}°C
        </span>
        <span className="text-xs text-muted-foreground hidden sm:inline">
          {weather.condition}
        </span>
        {/* Live pulse dot */}
        <span
          className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse"
          title={`Updated ${lastUpdated}`}
        />
      </div>
    );
  }

  return (
    <div className={cn("glass-card rounded-2xl overflow-hidden relative", className)}>
      {/* Weather-themed gradient background */}
      <div
        className={cn(
          "absolute inset-0 bg-gradient-to-br opacity-70 pointer-events-none transition-all duration-1000",
          getWeatherBg(weather.condition)
        )}
      />

      <div className="relative p-5 space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-foreground">{weather.city}</h3>
              <span className="flex items-center gap-1 text-[10px] text-emerald-500 font-semibold bg-emerald-500/10 px-2 py-0.5 rounded-full">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Live
              </span>
            </div>
            <p className="text-sm text-muted-foreground capitalize mt-0.5">
              {weather.description}
            </p>
          </div>
          {getWeatherIcon(weather.condition, "lg")}
        </div>

        {/* Temperature */}
        <div className="flex items-end gap-1">
          <span className="text-5xl font-bold text-foreground tabular-nums leading-none">
            {Math.round(weather.temperature)}
          </span>
          <span className="text-2xl text-muted-foreground mb-0.5">°C</span>
          <span className="ml-auto text-[10px] text-muted-foreground/60 self-end">
            {lastUpdated}
          </span>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-3 gap-2">
          <div className="flex flex-col items-center gap-1 bg-background/40 rounded-xl p-2.5 text-center">
            <Thermometer className="h-4 w-4 text-orange-400" />
            <span className="text-[10px] text-muted-foreground">Feels like</span>
            <span className="text-sm font-semibold text-foreground">
              {Math.round(weather.feels_like)}°
            </span>
          </div>
          <div className="flex flex-col items-center gap-1 bg-background/40 rounded-xl p-2.5 text-center">
            <Droplets className="h-4 w-4 text-blue-400" />
            <span className="text-[10px] text-muted-foreground">Humidity</span>
            <span className="text-sm font-semibold text-foreground">
              {weather.humidity}%
            </span>
          </div>
          <div className="flex flex-col items-center gap-1 bg-background/40 rounded-xl p-2.5 text-center">
            <Wind className="h-4 w-4 text-cyan-400" />
            <span className="text-[10px] text-muted-foreground">Wind</span>
            <span className="text-sm font-semibold text-foreground">
              {weather.wind_speed} m/s
            </span>
          </div>
        </div>

        {weather.is_mock && (
          <p className="text-[10px] text-muted-foreground/50 text-center">
            Simulated weather data
          </p>
        )}
      </div>
    </div>
  );
}
