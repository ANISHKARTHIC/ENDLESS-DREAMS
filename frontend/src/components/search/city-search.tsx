"use client";

import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, MapPin, X, Globe, Star, Loader2 } from "lucide-react";
import { searchCities, REGIONS, WORLD_CITIES, type WorldCity } from "@/data/world-cities";
import { api } from "@/lib/api";

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";

interface CitySearchProps {
  value: string;
  onChange: (city: WorldCity) => void;
  placeholder?: string;
  label?: string;
  excludeCities?: string[];
}

/** Search Mapbox Geocoding API for cities matching query */
async function searchMapboxCities(query: string): Promise<WorldCity[]> {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";
  if (!token || !query.trim()) return [];
  try {
    // Use autocomplete, include localities, and search globally
    const params = new URLSearchParams({
      access_token: token,
      types: "place,locality,region",
      limit: "10",
      language: "en",
      autocomplete: "true",
    });
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?${params}`;
    const res = await fetch(url);
    if (!res.ok) {
      console.warn("Mapbox geocoding failed:", res.status);
      return [];
    }
    const data = await res.json();
    return (data.features || []).map((f: Record<string, unknown>) => {
      const coords = (f.geometry as { coordinates: number[] })?.coordinates || [0, 0];
      const context = (f.context as { id: string; text: string }[]) || [];
      const country = context.find((c) => c.id.startsWith("country"))?.text || "";
      const region = context.find((c) => c.id.startsWith("region"))?.text || "";
      const placeType = (f.place_type as string[]) || [];
      
      return {
        city: f.text as string,
        country: country,
        countryCode: "",
        emoji: "",
        lat: coords[1],
        lng: coords[0],
        description: region || country || (f.place_name as string)?.split(",").slice(1).join(",").trim() || "",
        region: "Asia" as const, // Default region for display purposes
        popular: placeType.includes("place"),
      };
    });
  } catch (err) {
    console.warn("Mapbox geocoding error:", err);
    return [];
  }
}

export function CitySearch({ value, onChange, placeholder = "Search any city worldwide...", label, excludeCities = [] }: CitySearchProps) {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [results, setResults] = useState<WorldCity[]>([]);
  const [activeRegion, setActiveRegion] = useState<string | null>(null);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const [dbCities, setDbCities] = useState<WorldCity[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fetch DB destinations on mount
  useEffect(() => {
    api.getDestinationCities().then((res) => {
      const fromDb: WorldCity[] = res.cities
        .filter((c) => !WORLD_CITIES.find((w) => w.city.toLowerCase() === c.city.toLowerCase()))
        .map((c) => ({
          city: c.city,
          country: c.country,
          countryCode: "",
          emoji: "",
          lat: c.lat,
          lng: c.lng,
          description: `${c.place_count} places`,
          region: "Asia" as const,
          popular: c.place_count >= 8,
        }));
      setDbCities(fromDb);
    }).catch(() => {});
  }, []);

  const allCities = useMemo(() => [...WORLD_CITIES, ...dbCities], [dbCities]);

  const doSearch = useCallback((q: string, region: string | null) => {
    let filtered: WorldCity[];
    if (q.trim()) {
      const qLower = q.toLowerCase().trim();
      // Search both world-cities and DB cities
      const worldResults = searchCities(q, 50);
      const dbResults = dbCities.filter(
        (c) =>
          c.city.toLowerCase().includes(qLower) ||
          c.country.toLowerCase().includes(qLower)
      );
      // Merge, deduplicate
      const seen = new Set<string>();
      filtered = [];
      for (const c of [...worldResults, ...dbResults]) {
        const key = c.city.toLowerCase();
        if (!seen.has(key)) {
          seen.add(key);
          filtered.push(c);
        }
      }
    } else {
      filtered = allCities.filter((c) => c.popular);
    }
    if (region) {
      filtered = filtered.filter(c => c.region === region);
    }
    if (excludeCities.length > 0) {
      filtered = filtered.filter(c => !excludeCities.includes(c.city));
    }
    setResults(filtered.slice(0, 16));
    setHighlightIndex(-1);
  }, [excludeCities, dbCities, allCities]);

  // Also search backend DB + Mapbox geocoding for cities not in local data
  useEffect(() => {
    if (!query.trim() || query.trim().length < 2) {
      setIsSearching(false);
      return;
    }
    setIsSearching(true);
    const timer = setTimeout(async () => {
      try {
        // Parallel: search DB + Mapbox
        const [dbRes, mapboxResults] = await Promise.all([
          api.getDestinationCities(query.trim()).catch(() => ({ cities: [] })),
          searchMapboxCities(query.trim()),
        ]);

        setResults((prev) => {
          const existingKeys = new Set(prev.map(c => c.city.toLowerCase()));
          const combined: WorldCity[] = [...prev];

          // Add DB results first (they have itinerary data)
          for (const c of dbRes.cities) {
            if (!existingKeys.has(c.city.toLowerCase())) {
              existingKeys.add(c.city.toLowerCase());
              combined.push({
                city: c.city,
                country: c.country,
                countryCode: "",
                emoji: "",
                lat: c.lat,
                lng: c.lng,
                description: `${c.place_count} places`,
                region: "Asia" as const,
                popular: c.place_count >= 8,
              });
            }
          }

          // Add Mapbox results (cities from anywhere in the world)
          for (const c of mapboxResults) {
            if (!existingKeys.has(c.city.toLowerCase())) {
              existingKeys.add(c.city.toLowerCase());
              combined.push(c);
            }
          }

          // If we only have Mapbox results (no local/DB matches), use them
          if (prev.length === 0 && combined.length > 0) {
            return combined.slice(0, 24);
          }
          
          // Otherwise merge and limit
          return combined.slice(0, 24);
        });
      } finally {
        setIsSearching(false);
      }
    }, 300);
    return () => { clearTimeout(timer); setIsSearching(false); };
  }, [query]);

  useEffect(() => {
    doSearch(query, activeRegion);
  }, [query, activeRegion, doSearch]);

  // Close on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
          inputRef.current && !inputRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const handleSelect = (city: WorldCity) => {
    setQuery("");
    setIsOpen(false);
    onChange(city);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightIndex(prev => Math.min(prev + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightIndex(prev => Math.max(prev - 1, 0));
    } else if (e.key === "Enter" && highlightIndex >= 0) {
      e.preventDefault();
      handleSelect(results[highlightIndex]);
    } else if (e.key === "Escape") {
      setIsOpen(false);
    }
  };

  return (
    <div className="relative">
      {label && (
        <label className="block text-sm font-medium text-foreground mb-2">{label}</label>
      )}

      {/* Selected city display */}
      {value && !isOpen && (
        <div
          className="flex items-center gap-3 p-3 rounded-2xl border border-primary/30 bg-primary/5 cursor-pointer group hover:border-primary/50 transition-all"
          onClick={() => { setIsOpen(true); setTimeout(() => inputRef.current?.focus(), 100); }}
        >
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <MapPin className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-foreground">{value}</p>
            {(() => {
              const city = allCities.find(c => c.city === value);
              return city ? (
                <p className="text-xs text-muted-foreground">{city.country} · {city.description}</p>
              ) : (
                <p className="text-xs text-muted-foreground">{value}</p>
              );
            })()}
          </div>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setIsOpen(true); setTimeout(() => inputRef.current?.focus(), 100); }}
            className="p-1.5 rounded-lg hover:bg-muted/50 transition text-muted-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Search input */}
      {(!value || isOpen) && (
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground z-10" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setIsOpen(true); }}
            onFocus={() => setIsOpen(true)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className="w-full pl-10 pr-4 py-3 rounded-2xl border border-border bg-background/50 backdrop-blur-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
            autoComplete="off"
          />
          {query && (
            <button
              type="button"
              onClick={() => { setQuery(""); inputRef.current?.focus(); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-lg hover:bg-muted/50"
            >
              <X className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          )}
        </div>
      )}

      {/* Dropdown */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            ref={dropdownRef}
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className="absolute z-50 w-full mt-2 rounded-2xl border border-border bg-card/95 backdrop-blur-xl shadow-2xl shadow-black/10 overflow-hidden"
          >
            {/* Region filter pills */}
            <div className="flex items-center gap-1.5 p-3 pb-2 overflow-x-auto scrollbar-hide border-b border-border/50">
              <button
                type="button"
                onClick={() => setActiveRegion(null)}
                className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
                  !activeRegion
                    ? "bg-primary text-primary-foreground shadow-sm shadow-primary/20"
                    : "bg-muted/50 text-muted-foreground hover:bg-muted"
                }`}
              >
                <Globe className="h-3 w-3 inline mr-1" />
                All
              </button>
              {REGIONS.map(r => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setActiveRegion(activeRegion === r ? null : r)}
                  className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
                    activeRegion === r
                      ? "bg-primary text-primary-foreground shadow-sm shadow-primary/20"
                      : "bg-muted/50 text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>

            {/* Results */}
            <div className="max-h-[320px] overflow-y-auto scrollbar-hide">
              {isSearching && results.length === 0 ? (
                <div className="p-6 text-center">
                  <Loader2 className="h-6 w-6 text-primary animate-spin mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">Searching worldwide...</p>
                </div>
              ) : results.length === 0 ? (
                <div className="p-6 text-center">
                  <Globe className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">No cities found</p>
                  <p className="text-xs text-muted-foreground/60 mt-1">Try a different search term</p>
                </div>
              ) : (
                <div className="p-1.5">
                  {results.map((city, idx) => (
                    <button
                      key={`${city.city}-${city.country}-${idx}`}
                      type="button"
                      onClick={() => handleSelect(city)}
                      onMouseEnter={() => setHighlightIndex(idx)}
                      className={`w-full flex items-center gap-3 p-2.5 rounded-xl text-left transition-all ${
                        highlightIndex === idx
                          ? "bg-primary/10 border-primary/20"
                          : "hover:bg-muted/50"
                      }`}
                    >
                      <div className="h-8 w-8 rounded-lg bg-muted/80 flex items-center justify-center shrink-0">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-medium text-foreground text-sm">{city.city}</span>
                          {city.popular && <Star className="h-3 w-3 text-warning fill-warning" />}
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {city.country}{city.description && city.description !== city.country ? ` · ${city.description}` : ''}
                        </span>
                      </div>
                    </button>
                  ))}
                  {isSearching && (
                    <div className="flex items-center gap-2 p-2.5 text-xs text-muted-foreground">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Searching more cities...
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-3 py-2 border-t border-border/50 flex items-center justify-between">
              <span className="text-[10px] text-muted-foreground/60">
                {allCities.length} destinations worldwide
              </span>
              <span className="text-[10px] text-muted-foreground/60">
                ↑↓ Navigate · Enter Select · Esc Close
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
