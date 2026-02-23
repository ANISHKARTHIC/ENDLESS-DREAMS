"use client";

import React, { useState, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import {
  Plane,
  Calendar,
  DollarSign,
  Users,
  Sparkles,
  Loader2,
  MapPin,
  ArrowRight,
  Globe,
  Navigation,
  Route,
  Building2,
  Wallet,
} from "lucide-react";
import { TravelComparison } from "@/components/trip/travel-comparison";
import { InteractiveGlobe } from "@/components/globe/interactive-globe";
import { DestinationPreviewMap } from "@/components/map/destination-preview-map";
import { CitySearch } from "@/components/search/city-search";
import { getCityData, type WorldCity } from "@/data/world-cities";
import { useCurrency } from "@/contexts/currency-context";
import { api } from "@/lib/api";
import { type RouteInfo } from "@/lib/mapbox";
import type { TripGenerateRequest, TravelOption, TravelSearchResponse } from "@/types";

interface TripGenerationFormProps {
  onSubmit: (data: TripGenerateRequest) => void;
  isLoading?: boolean;
}

const PACE_OPTIONS = [
  { value: "relaxed", label: "Relaxed", description: "2-3 activities/day, late starts" },
  { value: "moderate", label: "Moderate", description: "3-5 activities/day" },
  { value: "fast", label: "Fast", description: "5-7 activities/day, packed schedule" },
];

const STAY_TYPE_OPTIONS = [
  { value: "any", label: "All" },
  { value: "hotel", label: "Hotel" },
  { value: "resort", label: "Resort" },
  { value: "hostel", label: "Hostel" },
  { value: "airbnb", label: "Airbnb" },
  { value: "boutique", label: "Boutique" },
];

export function TripGenerationForm({ onSubmit, isLoading }: TripGenerationFormProps) {
  const [step, setStep] = useState(0);
  const { currency, rates, symbol } = useCurrency();

  // Budget quick-select amounts per currency
  const BUDGET_AMOUNTS: Record<string, number[]> = {
    INR: [25000, 50000, 100000, 250000, 500000],
    USD: [500, 1000, 2000, 5000, 10000],
    EUR: [500, 1000, 2000, 5000, 10000],
    GBP: [400, 800, 1500, 4000, 8000],
    JPY: [75000, 150000, 300000, 750000, 1500000],
  };
  const quickAmounts = BUDGET_AMOUNTS[currency] || BUDGET_AMOUNTS.USD;

  const [form, setForm] = useState<TripGenerateRequest>({
    departure_city: "",
    destination_city: "",
    destination_country: "",
    start_date: "",
    end_date: "",
    budget_usd: quickAmounts[2], // sensible default for the currency (middle value)
    pace: "moderate",
    stay_type: "any",
    group_size: 1,
    interest_culture: 0.5,
    interest_nature: 0.5,
    interest_food: 0.5,
    interest_adventure: 0.5,
    interest_relaxation: 0.5,
  });

  // Travel search state
  const [travelOptions, setTravelOptions] = useState<TravelOption[]>([]);
  const [travelLoading, setTravelLoading] = useState(false);
  const [selectedTravel, setSelectedTravel] = useState<TravelOption | null>(null);

  // Route info from Mapbox Directions API
  const [routeInfo, setRouteInfo] = useState<RouteInfo | null>(null);

  // Store selected city objects with coordinates (for map preview)
  const [selectedDestCity, setSelectedDestCity] = useState<WorldCity | null>(null);
  const [selectedDepCity, setSelectedDepCity] = useState<WorldCity | null>(null);

  const handleRouteLoad = useCallback((info: RouteInfo) => {
    setRouteInfo(info);
  }, []);

  const updateForm = (updates: Partial<TripGenerateRequest>) => {
    setForm((prev) => ({ ...prev, ...updates }));
  };

  // Convert from user's currency to USD for backend
  const convertToUsd = useCallback(
    (localAmount: number) => {
      if (currency === "USD") return localAmount;
      // rates are rate_from_inr — convert user currency -> INR -> USD
      const myRate = rates.find((r) => r.currency_code === currency);
      const usdRate = rates.find((r) => r.currency_code === "USD");
      if (!myRate || !usdRate || myRate.rate_from_inr === 0) {
        // Fallback: assume INR and use approximate rate
        return Math.round(localAmount * 0.012 * 100) / 100;
      }
      const inrAmount = localAmount / myRate.rate_from_inr;
      return Math.round(inrAmount * usdRate.rate_from_inr * 100) / 100;
    },
    [currency, rates]
  );

  // Format budget amount for display
  const formatBudgetLabel = (amount: number): string => {
    if (currency === "INR") {
      if (amount >= 100000) return `${(amount / 100000).toFixed(amount % 100000 === 0 ? 0 : 1)}L`;
      if (amount >= 1000) return `${(amount / 1000).toFixed(0)}K`;
      return amount.toLocaleString("en-IN");
    }
    if (currency === "JPY") {
      if (amount >= 10000) return `${(amount / 10000).toFixed(0)}万`;
      return amount.toLocaleString();
    }
    if (amount >= 1000) return `${(amount / 1000).toFixed(amount % 1000 === 0 ? 0 : 1)}k`;
    return amount.toLocaleString();
  };

  // Globe coordinates - use selected city objects if available, fallback to lookup
  const destCity = useMemo(() => {
    if (selectedDestCity) return selectedDestCity;
    return getCityData(form.destination_city);
  }, [selectedDestCity, form.destination_city]);
  
  const depCity = useMemo(() => {
    if (selectedDepCity) return selectedDepCity;
    return getCityData(form.departure_city || "");
  }, [selectedDepCity, form.departure_city]);

  const handleDepartureSelect = (city: WorldCity) => {
    setSelectedDepCity(city); // Store the full city object with coordinates
    updateForm({ departure_city: city.city });
  };

  const handleDestinationSelect = (city: WorldCity) => {
    setSelectedDestCity(city); // Store the full city object with coordinates
    updateForm({
      destination_city: city.city,
      destination_country: city.country,
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const data = { ...form };
    // Convert budget from user's local currency to USD for the backend
    data.budget_usd = convertToUsd(form.budget_usd);
    if (selectedTravel) {
      data.travel_option_id = selectedTravel.id;
    }
    onSubmit(data);
  };

  // Search travel when entering step 1 (travel)
  const searchTravel = async () => {
    if (!form.departure_city || !form.destination_city || !form.start_date) return;
    setTravelLoading(true);
    try {
      const result: TravelSearchResponse = await api.searchTravel({
        departure_city: form.departure_city,
        arrival_city: form.destination_city,
        travel_date: form.start_date,
      });
      setTravelOptions(result.options || []);
    } catch (err) {
      console.error("Travel search failed:", err);
      setTravelOptions([]);
    } finally {
      setTravelLoading(false);
    }
  };

  const handleTravelSelect = (option: TravelOption) => {
    setSelectedTravel(option);
    setStep(3);
  };

  const handleTravelSkip = () => {
    setSelectedTravel(null);
    setStep(3);
  };

  const steps = [
    { title: "Where are you going?", subtitle: "Choose your destination", icon: Globe },
    { title: "When & Budget", subtitle: "Set your travel dates and budget", icon: Wallet },
    { title: "How will you travel?", subtitle: "Compare flights, trains & buses", icon: Plane },
    { title: "Your Style", subtitle: "Tell us what you love", icon: Sparkles },
  ];

  const canAdvance = () => {
    if (step === 0) return !!form.departure_city && !!form.destination_city;
    if (step === 1) return !!form.start_date && !!form.end_date && form.budget_usd > 0;
    if (step === 2) return true;
    return true;
  };

  const handleNext = () => {
    if (step === 1 && form.departure_city && form.destination_city && form.start_date) {
      // Search travel options when advancing from budget to travel step
      searchTravel();
    }
    setStep(step + 1);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Step indicator - enhanced */}
      <div className="flex items-center justify-center gap-2 mb-8">
        {steps.map((s, i) => (
          <button
            key={i}
            type="button"
            onClick={() => i < step && setStep(i)}
            className="flex items-center gap-2 group"
          >
            <div
              className={`h-9 w-9 rounded-full flex items-center justify-center text-sm font-medium transition-all duration-500 ${
                i === step
                  ? "bg-gradient-to-br from-sky-400 to-cyan-500 text-white shadow-lg scale-110 step-wheel-spin"
                  : i < step
                  ? "bg-gradient-to-br from-sky-400/30 to-cyan-500/30 text-foreground"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              <s.icon className="h-4 w-4" />
            </div>
            {i < steps.length - 1 && (
              <div className={`w-8 sm:w-16 h-0.5 rounded transition-all duration-500 ${
                i < step ? "bg-gradient-to-r from-sky-400 to-cyan-500" : "bg-muted"
              }`} />
            )}
          </button>
        ))}
      </div>

      {/* Step title */}
      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          className="text-center mb-6"
        >
          <h2 className="text-2xl font-bold text-foreground">{steps[step].title}</h2>
          <p className="text-muted-foreground mt-1">{steps[step].subtitle}</p>
        </motion.div>
      </AnimatePresence>

      {/* Step 0: Departure + Destination + Map Preview */}
      {step === 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left: Search fields */}
            <div className="space-y-5">
              {/* Destination city search */}
              <CitySearch
                label="Enter your dream destination"
                value={form.destination_city}
                onChange={handleDestinationSelect}
                placeholder="Search any destination worldwide..."
                excludeCities={form.departure_city ? [form.departure_city] : []}
              />

              {/* Animated connector */}
              {form.destination_city && (
                <div className="flex items-center justify-center gap-2 text-muted-foreground">
                  <div className="h-px flex-1 bg-gradient-to-r from-transparent via-accent/30 to-transparent" />
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="h-8 w-8 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg shadow-primary/20"
                  >
                    <ArrowRight className="h-4 w-4 text-white rotate-180" />
                  </motion.div>
                  <div className="h-px flex-1 bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
                </div>
              )}

              {/* Departure city search */}
              <CitySearch
                label="Starting point of your dream"
                value={form.departure_city || ""}
                onChange={handleDepartureSelect}
                placeholder="Search departure city..."
                excludeCities={form.destination_city ? [form.destination_city] : []}
              />

              {/* Route info badge */}
              <AnimatePresence>
                {form.departure_city && form.destination_city && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="flex items-center justify-center gap-3 px-5 py-2.5 rounded-full glass text-sm font-medium shadow-lg mx-auto w-fit"
                  >
                    <span className="flex items-center gap-1.5 text-primary">
                      <Navigation className="h-3.5 w-3.5" />
                      {form.departure_city}
                    </span>
                    <div className="flex items-center gap-2">
                      <Route className="h-3.5 w-3.5 text-accent" />
                      {routeInfo && (
                        <span className="text-xs text-muted-foreground">
                          {routeInfo.distanceKm.toFixed(0)} km · {routeInfo.durationFormatted}
                        </span>
                      )}
                    </div>
                    <span className="flex items-center gap-1.5 text-accent">
                      <MapPin className="h-3.5 w-3.5" />
                      {form.destination_city}
                    </span>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Right: Map preview */}
            <div className="relative min-h-[320px] lg:min-h-[380px]">
              <DestinationPreviewMap
                destLat={destCity?.lat}
                destLng={destCity?.lng}
                destName={form.destination_city || undefined}
                depLat={depCity?.lat}
                depLng={depCity?.lng}
                depName={form.departure_city || undefined}
                className="h-full w-full"
                showRealRoute={true}
                onRouteLoad={handleRouteLoad}
              />
            </div>
          </div>
        </motion.div>
      )}

      {/* Step 1: Dates & Budget (moved before travel) */}
      {step === 1 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          {/* Trip summary card */}
          <div className="p-4 rounded-2xl bg-gradient-to-r from-primary/5 to-accent/5 border border-primary/10 flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg shadow-primary/20">
              <Plane className="h-6 w-6 text-white" />
            </div>
            <div>
              <p className="font-semibold text-foreground">{form.departure_city} → {form.destination_city}</p>
              <p className="text-xs text-muted-foreground">
                {destCity?.country} · {destCity?.description}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Start Date"
              type="date"
              value={form.start_date}
              onChange={(e) => updateForm({ start_date: e.target.value })}
            />
            <Input
              label="End Date"
              type="date"
              value={form.end_date}
              min={form.start_date}
              onChange={(e) => updateForm({ end_date: e.target.value })}
            />
          </div>

          <div className="space-y-3">
            <label className="block text-sm font-medium text-foreground">
              Budget ({currency})
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium text-muted-foreground">
                {symbol}
              </span>
              <input
                type="number"
                value={form.budget_usd}
                onChange={(e) => updateForm({ budget_usd: parseInt(e.target.value) || 0 })}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-border bg-background/50 backdrop-blur-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                min={100}
                step={currency === "JPY" ? 1000 : 100}
              />
            </div>
            <div className="flex gap-2">
              {quickAmounts.map((amount) => (
                <button
                  key={amount}
                  type="button"
                  onClick={() => updateForm({ budget_usd: amount })}
                  className={`flex-1 py-1.5 text-xs rounded-lg border transition-all ${
                    form.budget_usd === amount
                      ? "border-primary bg-primary/10 text-primary shadow-sm shadow-primary/10"
                      : "border-border text-muted-foreground hover:border-primary/30"
                  }`}
                >
                  {symbol}{formatBudgetLabel(amount)}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Pace"
              options={PACE_OPTIONS}
              value={form.pace}
              onChange={(v) => updateForm({ pace: v as TripGenerateRequest["pace"] })}
            />
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                Group Size
              </label>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => updateForm({ group_size: Math.max(1, (form.group_size || 1) - 1) })}
                  className="h-10 w-10 rounded-xl border border-border flex items-center justify-center hover:bg-muted transition"
                >
                  -
                </button>
                <div className="flex items-center gap-1.5">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span className="text-lg font-semibold w-6 text-center">{form.group_size || 1}</span>
                </div>
                <button
                  type="button"
                  onClick={() => updateForm({ group_size: Math.min(10, (form.group_size || 1) + 1) })}
                  className="h-10 w-10 rounded-xl border border-border flex items-center justify-center hover:bg-muted transition"
                >
                  +
                </button>
              </div>
            </div>
          </div>

          {/* Stay type preference */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              <span className="flex items-center gap-1.5">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                Accommodation Preference
              </span>
            </label>
            <div className="flex flex-wrap gap-2">
              {STAY_TYPE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => updateForm({ stay_type: opt.value as TripGenerateRequest["stay_type"] })}
                  className={`px-4 py-2 rounded-xl text-sm font-medium border transition-all ${
                    form.stay_type === opt.value
                      ? "border-primary bg-primary/10 text-primary shadow-sm shadow-primary/10"
                      : "border-border text-muted-foreground hover:border-primary/30"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </motion.div>
      )}

      {/* Step 2: Travel Comparison + Route Visualization */}
      {step === 2 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          {/* Mini globe showing route */}
          <div className="flex justify-center mb-6">
            <div className="relative">
              <InteractiveGlobe
                focusLat={destCity?.lat}
                focusLng={destCity?.lng}
                departureLat={depCity?.lat}
                departureLng={depCity?.lng}
                size={200}
                autoRotate={false}
                className="opacity-80"
              />
            </div>
          </div>

          {/* Route info bar */}
          <div className="flex items-center justify-center gap-4 mb-6 p-3 rounded-2xl bg-gradient-to-r from-primary/5 via-accent/5 to-primary/5 border border-primary/10">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-primary" />
              <span className="text-sm font-medium text-foreground">{form.departure_city}</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-16 h-px bg-gradient-to-r from-primary to-accent" />
              <Plane className="h-4 w-4 text-accent -rotate-45" />
              <div className="w-16 h-px bg-gradient-to-r from-accent to-primary" />
            </div>
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-accent" />
              <span className="text-sm font-medium text-foreground">{form.destination_city}</span>
            </div>
          </div>

          {selectedTravel && (
            <div className="mb-4 p-3 rounded-xl bg-primary/5 border border-primary/20 text-center">
              <span className="text-xs text-primary">
                Selected: {selectedTravel.provider_name} ({selectedTravel.transport_type}) -- {selectedTravel.route_number}
              </span>
            </div>
          )}
          <TravelComparison
            options={travelOptions}
            departureCity={form.departure_city || ""}
            arrivalCity={form.destination_city}
            isLoading={travelLoading}
            onSelect={handleTravelSelect}
            onSkip={handleTravelSkip}
          />
        </motion.div>
      )}

      {/* Step 3: Interests - Spinning Wheel */}
      {step === 3 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          <p className="text-sm text-muted-foreground text-center">
            Drag the dot around each wheel to set your interest level
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-6">
            {[
              { label: "Culture & History", key: "interest_culture", color: "#f59e0b" },
              { label: "Nature & Outdoors", key: "interest_nature", color: "#22c55e" },
              { label: "Food & Dining", key: "interest_food", color: "#ef4444" },
              { label: "Adventure", key: "interest_adventure", color: "#0ea5e9" },
              { label: "Relaxation", key: "interest_relaxation", color: "#8b5cf6" },
            ].map((item) => {
              const value = (form as any)[item.key] ?? 0.5;
              const percent = Math.round(value * 100);
              // Dot position on circle edge (angle from top, clockwise)
              const angle = value * 360 - 90; // -90 so 0% starts at top
              const rad = (angle * Math.PI) / 180;
              const radius = 40; // half of the 80px wheel
              const dotX = 40 + radius * Math.cos(rad);
              const dotY = 40 + radius * Math.sin(rad);

              const handleWheel = (e: React.MouseEvent<SVGSVGElement>) => {
                const svg = e.currentTarget;
                const rect = svg.getBoundingClientRect();
                const cx = rect.left + rect.width / 2;
                const cy = rect.top + rect.height / 2;
                const x = e.clientX - cx;
                const y = e.clientY - cy;
                let a = Math.atan2(y, x) * (180 / Math.PI) + 90;
                if (a < 0) a += 360;
                const newVal = Math.round((a / 360) * 10) / 10;
                updateForm({ [item.key]: Math.min(1, Math.max(0, newVal)) });
              };

              const handleDrag = (e: React.MouseEvent<SVGSVGElement>) => {
                if (e.buttons !== 1) return;
                handleWheel(e);
              };

              return (
                <div key={item.key} className="flex flex-col items-center gap-2">
                  <svg
                    width="80"
                    height="80"
                    viewBox="0 0 80 80"
                    className="cursor-pointer select-none"
                    onClick={handleWheel}
                    onMouseMove={handleDrag}
                  >
                    {/* Background track */}
                    <circle cx="40" cy="40" r="34" fill="none" stroke="#e5e7eb" strokeWidth="6" />
                    {/* Filled arc */}
                    <circle
                      cx="40"
                      cy="40"
                      r="34"
                      fill="none"
                      stroke={item.color}
                      strokeWidth="6"
                      strokeLinecap="round"
                      strokeDasharray={`${value * 213.6} 213.6`}
                      strokeDashoffset="0"
                      transform="rotate(-90 40 40)"
                      style={{ transition: 'stroke-dasharray 0.3s ease' }}
                    />
                    {/* Center text */}
                    <text x="40" y="44" textAnchor="middle" fontSize="14" fontWeight="700" fill={item.color}>
                      {percent}%
                    </text>
                    {/* Drag dot */}
                    <circle
                      cx={dotX}
                      cy={dotY}
                      r="7"
                      fill="#ffffff"
                      stroke={item.color}
                      strokeWidth="3"
                      style={{ filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.15))', transition: 'cx 0.3s ease, cy 0.3s ease' }}
                    />
                  </svg>
                  <span className="text-xs font-medium text-foreground text-center leading-tight">{item.label}</span>
                </div>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between pt-4">
        {step > 0 ? (
          <Button type="button" variant="ghost" onClick={() => setStep(step - 1)}>
            Back
          </Button>
        ) : (
          <div />
        )}

        {step < 3 ? (
          step === 2 ? (
            <div />
          ) : (
            <Button
              type="button"
              onClick={handleNext}
              disabled={!canAdvance()}
              className="bg-foreground text-background hover:bg-foreground/90"
            >
              Continue
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          )
        ) : (
          <Button
            type="submit"
            disabled={isLoading}
            className="bg-foreground text-background hover:bg-foreground/90"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Crafting Your Dream Trip...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                Generate Itinerary
              </>
            )}
          </Button>
        )}
      </div>
    </form>
  );
}
