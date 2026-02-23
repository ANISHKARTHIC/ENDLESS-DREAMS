'use client';

import * as React from "react";
import { cn } from "@/lib/utils";

interface SliderProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  icon?: string;
}

export function Slider({ label, value, onChange, min = 0, max = 1, step = 0.1, icon }: SliderProps) {
  const percentage = ((value - min) / (max - min)) * 100;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-foreground/80">
          {icon && <span className="mr-1.5">{icon}</span>}
          {label}
        </span>
        <span className="text-sm font-semibold text-primary">
          {Math.round(value * 100)}%
        </span>
      </div>
      <div className="relative">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className={cn(
            "w-full h-2 rounded-full appearance-none cursor-pointer",
            "bg-muted",
            "[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5",
            "[&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary",
            "[&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:shadow-primary/30",
            "[&::-webkit-slider-thumb]:transition-transform [&::-webkit-slider-thumb]:hover:scale-110",
          )}
          style={{
            background: `linear-gradient(to right, var(--color-primary) ${percentage}%, var(--color-muted) ${percentage}%)`
          }}
        />
      </div>
    </div>
  );
}
