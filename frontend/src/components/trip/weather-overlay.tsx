"use client";

import React from "react";
import { Cloud, Droplets, Wind, Thermometer, Sun, CloudRain } from "lucide-react";
import type { WeatherData } from "@/types";
import { cn } from "@/lib/utils";

interface WeatherOverlayProps {
  weather: WeatherData;
  className?: string;
  compact?: boolean;
}

function getWeatherIcon(condition: string) {
  const c = condition.toLowerCase();
  if (c.includes("rain") || c.includes("drizzle"))
    return <CloudRain className="h-8 w-8 text-blue-400" />;
  if (c.includes("cloud"))
    return <Cloud className="h-8 w-8 text-gray-400" />;
  return <Sun className="h-8 w-8 text-amber-400" />;
}

export function WeatherOverlay({
  weather,
  className,
  compact = false,
}: WeatherOverlayProps) {
  if (compact) {
    return (
      <div
        className={cn(
          "inline-flex items-center gap-2 px-3 py-1.5 rounded-full glass-subtle",
          className
        )}
      >
        {getWeatherIcon(weather.condition)}
        <span className="text-sm font-medium text-foreground">
          {Math.round(weather.temperature)}°C
        </span>
        <span className="text-xs text-muted-foreground">{weather.condition}</span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "glass-card p-5 rounded-2xl space-y-4",
        className
      )}
    >
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-foreground">{weather.city}</h3>
          <p className="text-sm text-muted-foreground capitalize">
            {weather.description}
          </p>
        </div>
        {getWeatherIcon(weather.condition)}
      </div>

      <div className="flex items-end gap-1">
        <span className="text-4xl font-bold text-foreground">
          {Math.round(weather.temperature)}
        </span>
        <span className="text-xl text-muted-foreground mb-1">°C</span>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Thermometer className="h-4 w-4 text-orange-400" />
          <span>Feels {Math.round(weather.feels_like)}°</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Droplets className="h-4 w-4 text-blue-400" />
          <span>{weather.humidity}%</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Wind className="h-4 w-4 text-cyan-400" />
          <span>{weather.wind_speed} m/s</span>
        </div>
      </div>

      {weather.is_mock && (
        <p className="text-xs text-muted-foreground/60 text-center">
          Simulated weather data
        </p>
      )}
    </div>
  );
}
