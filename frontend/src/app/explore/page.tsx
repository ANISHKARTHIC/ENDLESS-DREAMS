"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { Button } from "@/components/ui/button";
import {
  Search,
  MapPin,
  Star,
  Compass,
  TreePine,
  Utensils,
  Landmark,
  Mountain,
  ShoppingBag,
  Moon,
  Palmtree,
  TrendingUp,
  Filter,
  ArrowRight,
} from "lucide-react";
import { api } from "@/lib/api";
import type { ExploreDestination } from "@/types";
import { cn } from "@/lib/utils";

const CATEGORIES = [
  { key: "", label: "All", icon: Compass },
  { key: "culture", label: "Culture", icon: Landmark },
  { key: "nature", label: "Nature", icon: TreePine },
  { key: "food", label: "Food", icon: Utensils },
  { key: "adventure", label: "Adventure", icon: Mountain },
  { key: "relaxation", label: "Relaxation", icon: Palmtree },
  { key: "shopping", label: "Shopping", icon: ShoppingBag },
  { key: "nightlife", label: "Nightlife", icon: Moon },
];

const HERO_IMAGES = [
  "https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=1920&q=80",
  "https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=1920&q=80",
  "https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=1920&q=80",
];

// Fallback images for destinations
const CITY_IMAGES: Record<string, string> = {
  "Tokyo": "https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=600&q=75",
  "Paris": "https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=600&q=75",
  "Dubai": "https://images.unsplash.com/photo-1512453979798-5ea266f8880c?w=600&q=75",
  "Bali": "https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=600&q=75",
  "Rome": "https://images.unsplash.com/photo-1552832230-c0197dd311b5?w=600&q=75",
  "New York": "https://images.unsplash.com/photo-1496442226666-8d4d0e62e6e9?w=600&q=75",
  "Singapore": "https://images.unsplash.com/photo-1525625293386-3f8f99389edd?w=600&q=75",
  "London": "https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?w=600&q=75",
  "Barcelona": "https://images.unsplash.com/photo-1583422409516-2895a77efded?w=600&q=75",
  "Sydney": "https://images.unsplash.com/photo-1506973035872-a4ec16b8e8d9?w=600&q=75",
  "Bangkok": "https://images.unsplash.com/photo-1508009603885-50cf7c579365?w=600&q=75",
  "Istanbul": "https://images.unsplash.com/photo-1524231757912-21f4fe3a7200?w=600&q=75",
  "Jaipur": "https://images.unsplash.com/photo-1599661046289-e31897846e41?w=600&q=75",
  "Mumbai": "https://images.unsplash.com/photo-1566552881560-0be862a7c445?w=600&q=75",
  "Delhi": "https://images.unsplash.com/photo-1587474260584-136574528ed5?w=600&q=75",
  "Goa": "https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?w=600&q=75",
  "Chennai": "https://images.unsplash.com/photo-1582510003544-4d00b7f74220?w=600&q=75",
  "Varanasi": "https://images.unsplash.com/photo-1561361513-2d000a50f0dc?w=600&q=75",
};

function getImageForCity(city: string, fallback: string | null): string {
  if (fallback) return fallback;
  if (CITY_IMAGES[city]) return CITY_IMAGES[city];
  // Use a pretty generic travel image
  return `https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=600&q=75`;
}

export default function ExplorePage() {
  const [destinations, setDestinations] = useState<ExploreDestination[]>([]);
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDestinations();
  }, [activeCategory]);

  async function loadDestinations() {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (activeCategory) params.category = activeCategory;
      if (search) params.q = search;
      const data = await api.getExploreDestinations(params);
      setDestinations(data.destinations || []);
    } catch {
      setDestinations([]);
    } finally {
      setLoading(false);
    }
  }

  const filteredDestinations = useMemo(() => {
    if (!search) return destinations;
    const q = search.toLowerCase();
    return destinations.filter(
      (d) => d.city.toLowerCase().includes(q) || d.country.toLowerCase().includes(q)
    );
  }, [destinations, search]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />

      {/* Hero */}
      <section className="relative h-[50vh] min-h-[360px] w-full overflow-hidden">
        <Image
          src={HERO_IMAGES[0]}
          alt="Explore destinations"
          fill
          priority
          className="object-cover"
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/30 to-background" />

        <div className="relative z-10 flex flex-col items-center justify-center h-full px-4 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="flex items-center gap-2 justify-center mb-4">
              <Compass className="h-5 w-5 text-white/70" />
              <span className="text-white/70 text-sm uppercase tracking-[0.2em]">
                Explore Destinations
              </span>
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white mb-4">
              Where will you go next?
            </h1>
            <p className="text-white/70 text-lg max-w-lg mx-auto mb-8">
              Discover amazing destinations curated by AI, tailored to your interests
            </p>

            {/* Search Bar */}
            <div className="max-w-xl mx-auto relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground/60 z-10" />
              <input
                type="text"
                placeholder="Search cities, countries..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && loadDestinations()}
                className="w-full pl-12 pr-4 py-4 rounded-2xl bg-white/95 dark:bg-card/90 backdrop-blur-xl text-foreground placeholder:text-muted-foreground border border-white/20 shadow-2xl focus:outline-none focus:ring-2 focus:ring-primary/50 text-base"
              />
            </div>
          </motion.div>
        </div>
      </section>

      {/* Category Filters */}
      <section className="py-6 px-4 border-b border-border/40 sticky top-16 z-30 bg-background/80 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide pb-1">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.key}
                onClick={() => setActiveCategory(cat.key)}
                className={cn(
                  "flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-medium whitespace-nowrap transition-all duration-200",
                  activeCategory === cat.key
                    ? "bg-foreground text-background shadow-lg"
                    : "bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/80"
                )}
              >
                <cat.icon className="h-4 w-4" />
                {cat.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Destinations Grid */}
      <section className="py-12 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-2xl font-bold text-foreground">
                {activeCategory
                  ? `${CATEGORIES.find((c) => c.key === activeCategory)?.label} Destinations`
                  : "Popular Destinations"}
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                {filteredDestinations.length} destinations found
              </p>
            </div>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="aspect-[4/3] rounded-2xl bg-muted animate-pulse"
                />
              ))}
            </div>
          ) : filteredDestinations.length === 0 ? (
            <div className="text-center py-20">
              <MapPin className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">No destinations found</h3>
              <p className="text-muted-foreground text-sm">
                Try a different search or category
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredDestinations.map((dest, idx) => (
                <motion.div
                  key={`${dest.city}-${dest.country}`}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.04 }}
                >
                  <Link href={`/dashboard?city=${encodeURIComponent(dest.city)}&country=${encodeURIComponent(dest.country)}`}>
                    <div className="group relative rounded-2xl overflow-hidden border border-border bg-card hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
                      {/* Image */}
                      <div className="aspect-[16/10] relative overflow-hidden">
                        <Image
                          src={getImageForCity(dest.city, dest.image_url)}
                          alt={dest.city}
                          fill
                          className="object-cover transition-transform duration-700 group-hover:scale-110"
                          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

                        {/* Rating badge */}
                        <div className="absolute top-3 right-3 flex items-center gap-1 px-2.5 py-1 rounded-full bg-black/40 backdrop-blur-md">
                          <Star className="h-3.5 w-3.5 text-amber-400 fill-amber-400" />
                          <span className="text-white text-xs font-semibold">{dest.avg_rating}</span>
                        </div>

                        {/* City name on image */}
                        <div className="absolute bottom-3 left-4">
                          <h3 className="text-white font-bold text-xl leading-tight">{dest.city}</h3>
                          <p className="text-white/70 text-sm">{dest.country}</p>
                        </div>
                      </div>

                      {/* Info */}
                      <div className="p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                            <MapPin className="h-3.5 w-3.5" />
                            <span>{dest.place_count} places to visit</span>
                          </div>
                          <div className="text-sm font-medium text-foreground">
                            ~${dest.daily_budget_usd}/day
                          </div>
                        </div>

                        {/* Category tags */}
                        <div className="flex flex-wrap gap-1.5">
                          {dest.categories.slice(0, 4).map((cat) => (
                            <span
                              key={cat}
                              className="px-2 py-0.5 rounded-full bg-muted text-[11px] font-medium text-muted-foreground capitalize"
                            >
                              {cat}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </Link>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 px-4 bg-muted/30">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-3">
            Can&apos;t find your destination?
          </h2>
          <p className="text-muted-foreground mb-6">
            Our AI can discover and plan trips to any city in the world
          </p>
          <Link href="/dashboard">
            <Button size="lg" className="rounded-full px-8">
              Plan a Custom Trip
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </Link>
        </div>
      </section>

      <Footer />
    </div>
  );
}
