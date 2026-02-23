"use client";

import React from "react";
import {
  Landmark,
  TreePine,
  Utensils,
  Mountain,
  Palmtree,
  ShoppingBag,
  Moon,
  Building2,
  MapPin,
} from "lucide-react";
import { cn } from "@/lib/utils";

const CATEGORY_CONFIG: Record<string, { icon: React.ElementType; color: string }> = {
  culture: { icon: Landmark, color: "text-purple-500" },
  nature: { icon: TreePine, color: "text-green-500" },
  food: { icon: Utensils, color: "text-orange-500" },
  adventure: { icon: Mountain, color: "text-red-500" },
  relaxation: { icon: Palmtree, color: "text-blue-500" },
  shopping: { icon: ShoppingBag, color: "text-pink-500" },
  nightlife: { icon: Moon, color: "text-indigo-500" },
  landmark: { icon: Building2, color: "text-amber-500" },
};

interface CategoryIconProps {
  category: string;
  className?: string;
  size?: "sm" | "md" | "lg";
  withBg?: boolean;
}

export function CategoryIcon({ category, className, size = "md", withBg = false }: CategoryIconProps) {
  const config = CATEGORY_CONFIG[category] || { icon: MapPin, color: "text-muted-foreground" };
  const Icon = config.icon;

  const sizeClass = size === "sm" ? "h-3 w-3" : size === "lg" ? "h-5 w-5" : "h-4 w-4";
  const bgSize = size === "sm" ? "h-5 w-5" : size === "lg" ? "h-8 w-8" : "h-7 w-7";
  const bgColor = config.color.replace("text-", "bg-").replace("-500", "-500/15");

  if (withBg) {
    return (
      <div className={cn("rounded-lg flex items-center justify-center shrink-0", bgSize, bgColor, className)}>
        <Icon className={cn(sizeClass, config.color)} />
      </div>
    );
  }

  return <Icon className={cn(sizeClass, config.color, className)} />;
}
