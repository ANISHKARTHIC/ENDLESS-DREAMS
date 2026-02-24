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
  LocateFixed,
  BrainCircuit,
  TrendingUp,
  Lightbulb,
  Car,
  Train,
  Bus,
} from "lucide-react";
import { TravelComparison } from "@/components/trip/travel-comparison";
import { InteractiveGlobe } from "@/components/globe/interactive-globe";
import { DestinationPreviewMap } from "@/components/map/destination-preview-map";
import { CitySearch } from "@/components/search/city-search";
import { getCityData, type WorldCity } from "@/data/world-cities";
import { useCurrency } from "@/contexts/currency-context";
import { api, type BudgetEstimateResponse, type BudgetAllocationItem } from "@/lib/api";
import { type RouteInfo, reverseGeocode } from "@/lib/mapbox";
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
  { value: "any", label: "Any" },
  { value: "hotel", label: "Hotel" },
  { value: "resort", label: "Resort" },
  { value: "hostel", label: "Hostel" },
  { value: "airbnb", label: "Airbnb" },
  { value: "boutique", label: "Boutique" },
];

const TRANSPORT_MODE_OPTIONS = [
  { value: "any",    label: "Any Mode",   emoji: "🌐" },
  { value: "flight", label: "Flight",     emoji: "✈️" },
  { value: "train",  label: "Train",      emoji: "🚂" },
  { value: "bus",    label: "Bus",        emoji: "🚌" },
  { value: "road",   label: "Road Trip",  emoji: "🚗" },
];

export function TripGenerationForm({ onSubmit, isLoading }: TripGenerationFormProps) {
  const [step, setStep] = useState(0);
  const { currency, rates, symbol } = useCurrency();

  // Transport mode preference (UI state — feeds budget estimation)
  const [transportMode, setTransportMode] = useState("any");

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

  // AI Budget estimation state
  const [isEstimatingBudget, setIsEstimatingBudget] = useState(false);
  const [budgetResult, setBudgetResult] = useState<BudgetEstimateResponse | null>(null);
  const [showBudgetDetails, setShowBudgetDetails] = useState(false);

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

  const [isLocating, setIsLocating] = useState(false);

  const handleDepartureSelect = (city: WorldCity) => {
    setSelectedDepCity(city); // Store the full city object with coordinates
    updateForm({ departure_city: city.city });
  };

  /** Use browser geolocation + Mapbox reverse geocode to set departure */
  const handleUseCurrentLocation = useCallback(async () => {
    if (!navigator.geolocation) return;
    setIsLocating(true);
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
        })
      );
      const { latitude, longitude } = pos.coords;
      const place = await reverseGeocode(latitude, longitude);
      const cityName = place?.text || "My Location";
      const country = place?.country || "";
      const cityObj: WorldCity = {
        city: cityName,
        country,
        countryCode: "",
        emoji: "",
        lat: latitude,
        lng: longitude,
        description: place?.region || country,
        region: "Asia" as const,
        popular: false,
      };
      setSelectedDepCity(cityObj);
      updateForm({ departure_city: cityName });
    } catch (err) {
      console.warn("Geolocation failed:", err);
    } finally {
      setIsLocating(false);
    }
  }, [updateForm]);

  /** AI budget estimation */
  const handleEstimateBudget = useCallback(async () => {
    if (!form.destination_city) return;
    setIsEstimatingBudget(true);
    setBudgetResult(null);
    setShowBudgetDetails(false);
    try {
      const result = await api.estimateBudget({
        destination_city: form.destination_city,
        destination_country: form.destination_country,
        departure_city: form.departure_city,
        start_date: form.start_date,
        end_date: form.end_date,
        pace: form.pace,
        stay_type: form.stay_type,
        group_size: form.group_size,
        currency,
        transport_mode: transportMode,
      });
      updateForm({ budget_usd: result.budget });
      setBudgetResult(result);
      setShowBudgetDetails(true);
    } catch (err) {
      console.warn('AI budget estimation failed:', err);
    } finally {
      setIsEstimatingBudget(false);
    }
  }, [form.destination_city, form.destination_country, form.departure_city, form.start_date, form.end_date, form.pace, form.stay_type, form.group_size, currency, transportMode, updateForm]);

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
      // Only pass DB-persisted IDs (not client-side fallback IDs starting with 'fb-')
      if (!selectedTravel.id.startsWith('fb-')) {
        data.travel_option_id = selectedTravel.id;
      }
      // Always pass travel metadata so backend can record it on the trip
      data.travel_summary = {
        transport_type: selectedTravel.transport_type,
        provider_name: selectedTravel.provider_name,
        route_number: selectedTravel.route_number,
        duration_minutes: selectedTravel.duration_minutes,
        price_inr: selectedTravel.price_inr,
        price_usd: selectedTravel.price_usd,
        cabin_class: selectedTravel.cabin_class,
        is_mock: selectedTravel.is_mock,
      };
    }
    onSubmit(data);
  };

  // Generate realistic fallback travel options when Amadeus returns nothing
  const generateFallbackOptions = (depC: WorldCity, destC: WorldCity, travelDate: string): TravelOption[] => {
    const R = 6371;
    const dLat = ((destC.lat - depC.lat) * Math.PI) / 180;
    const dLng = ((destC.lng - depC.lng) * Math.PI) / 180;
    const la1 = (depC.lat * Math.PI) / 180;
    const la2 = (destC.lat * Math.PI) / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
    const distKm = Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));

    const baseDate = new Date(travelDate + "T00:00:00");
    const makeISO = (h: number, m: number) => {
      const d = new Date(baseDate);
      d.setHours(h, m, 0, 0);
      return d.toISOString();
    };
    const addMin = (iso: string, min: number) =>
      new Date(new Date(iso).getTime() + min * 60000).toISOString();

    const ts = Date.now();
    const dep = form.departure_city;
    const arr = form.destination_city;
    const options: TravelOption[] = [];

    // ── Bus (always available) ──────────────────────────────────────────────
    const busDur = Math.max(30, Math.round((distKm / 45) * 60));
    const busPriceExpress = Math.max(200, Math.round(distKm * 7));
    options.push({
      id: `fb-bus-exp-${ts}`, transport_type: "bus",
      provider_name: "Express Bus", route_number: "EXP-1",
      departure_city: dep, departure_station: `${dep} Bus Terminal`,
      arrival_city: arr, arrival_station: `${arr} Bus Terminal`,
      departure_time: makeISO(7, 0), arrival_time: addMin(makeISO(7, 0), busDur),
      duration_minutes: busDur, price_inr: busPriceExpress,
      price_usd: Math.round(busPriceExpress * 0.012),
      stops: 0, stop_details: [], cabin_class: "AC Express",
      carbon_kg: Math.round(distKm * 0.089 * 10) / 10,
      delay_risk: 0.2, amenities: ["AC", "Reserved Seating"],
      is_direct: true, is_mock: true,
      badges: ["Recommended", "Eco-friendly"],
      created_at: new Date().toISOString(),
    });
    options.push({
      id: `fb-bus-std-${ts}`, transport_type: "bus",
      provider_name: depC.country === "India" ? "State Bus (TNSTC/KSRTC)" : "Standard Bus",
      route_number: "STD-2",
      departure_city: dep, departure_station: `${dep} Bus Stand`,
      arrival_city: arr, arrival_station: `${arr} Bus Stand`,
      departure_time: makeISO(9, 30), arrival_time: addMin(makeISO(9, 30), Math.round(busDur * 1.25)),
      duration_minutes: Math.round(busDur * 1.25),
      price_inr: Math.round(busPriceExpress * 0.55),
      price_usd: Math.round(busPriceExpress * 0.55 * 0.012),
      stops: 2, stop_details: [], cabin_class: "Non-AC",
      carbon_kg: Math.round(distKm * 0.089 * 10) / 10,
      delay_risk: 0.3, amenities: ["Seating"],
      is_direct: false, is_mock: true, badges: ["Budget"],
      created_at: new Date().toISOString(),
    });

    // ── Train (distance > 30 km) ────────────────────────────────────────────
    if (distKm > 30) {
      const trainDur = Math.max(40, Math.round((distKm / 65) * 60));
      const trainBase = Math.max(120, Math.round(distKm * 3.2));
      options.push({
        id: `fb-train-ac-${ts}`, transport_type: "train",
        provider_name: depC.country === "India" ? "Indian Railways" : "National Rail",
        route_number: "SF-EXP",
        departure_city: dep, departure_station: `${dep} Railway Station`,
        arrival_city: arr, arrival_station: `${arr} Railway Station`,
        departure_time: makeISO(6, 0), arrival_time: addMin(makeISO(6, 0), trainDur),
        duration_minutes: trainDur,
        price_inr: trainBase * 2, price_usd: Math.round(trainBase * 2 * 0.012),
        stops: 1, stop_details: [], cabin_class: "2nd AC",
        carbon_kg: Math.round(distKm * 0.041 * 10) / 10,
        delay_risk: 0.25, amenities: ["AC", "Meals", "Bedroll"],
        is_direct: false, is_mock: true, badges: ["Comfortable"],
        created_at: new Date().toISOString(),
      });
      options.push({
        id: `fb-train-sl-${ts}`, transport_type: "train",
        provider_name: depC.country === "India" ? "Indian Railways" : "National Rail",
        route_number: "SL-EXP",
        departure_city: dep, departure_station: `${dep} Railway Station`,
        arrival_city: arr, arrival_station: `${arr} Railway Station`,
        departure_time: makeISO(22, 0), arrival_time: addMin(makeISO(22, 0), Math.round(trainDur * 1.15)),
        duration_minutes: Math.round(trainDur * 1.15),
        price_inr: trainBase, price_usd: Math.round(trainBase * 0.012),
        stops: 3, stop_details: [], cabin_class: "Sleeper",
        carbon_kg: Math.round(distKm * 0.041 * 10) / 10,
        delay_risk: 0.3, amenities: ["Bedroll"],
        is_direct: false, is_mock: true, badges: ["Budget", "Night Train"],
        created_at: new Date().toISOString(),
      });
    }

    // ── Flight (distance > 300 km) ──────────────────────────────────────────
    if (distKm > 300) {
      const flightDur = Math.round((distKm / 700) * 60) + 180;
      const flightPrice = Math.max(2800, Math.round(distKm * 4.5 + 1500));
      options.push({
        id: `fb-flight-1-${ts}`, transport_type: "flight",
        provider_name: depC.country === "India" ? "IndiGo" : "Regional Airlines",
        route_number: depC.country === "India" ? `6E-${Math.floor(Math.random() * 900) + 100}` : `FL-${Math.floor(Math.random() * 900) + 100}`,
        departure_city: dep, departure_station: `${dep} Airport`,
        arrival_city: arr, arrival_station: `${arr} Airport`,
        departure_time: makeISO(8, 0), arrival_time: addMin(makeISO(8, 0), flightDur),
        duration_minutes: flightDur,
        price_inr: flightPrice, price_usd: Math.round(flightPrice * 0.012),
        stops: 0, stop_details: [], cabin_class: "Economy",
        carbon_kg: Math.round(distKm * 0.255 * 10) / 10,
        delay_risk: 0.15, amenities: ["Carry-on", "Meals (paid)"],
        is_direct: true, is_mock: true, badges: ["Fastest"],
        created_at: new Date().toISOString(),
      });
    }

    return options;
  };

  // Build synthetic city objects for fallback generation when real coords unavailable
  const resolveCityForFallback = (cityName: string, selectedCity: WorldCity | null): WorldCity => {
    // Priority 1: selected city object with real coords
    if (selectedCity && (selectedCity.lat !== 0 || selectedCity.lng !== 0)) return selectedCity;
    // Priority 2: static lookup in world-cities data
    const found = getCityData(cityName);
    if (found) return found;
    // Priority 3: synthetic object — assume India center as rough placeholder
    return { city: cityName, country: 'India', countryCode: 'IN', emoji: '🇮🇳', lat: 20.5937, lng: 78.9629, region: 'Asia', popular: false };
  };

  // Search travel when entering step 3 (travel)
  const searchTravel = async () => {
    if (!form.departure_city || !form.destination_city || !form.start_date) return;

    // Always resolve city objects — never null, always fallback to synthetic
    const depC = resolveCityForFallback(form.departure_city, selectedDepCity);
    const destC = resolveCityForFallback(form.destination_city, selectedDestCity);

    // ── Step 1: Show fallback options IMMEDIATELY — step is never blank ──
    const instant = generateFallbackOptions(depC, destC, form.start_date);
    setTravelOptions(instant);

    // ── Step 2: Try live backend (Amadeus / DB) — replace if better results ──
    setTravelLoading(true);
    try {
      const result: TravelSearchResponse = await api.searchTravel({
        departure_city: form.departure_city,
        arrival_city: form.destination_city,
        travel_date: form.start_date,
      });
      const liveOptions = result.options || [];
      if (liveOptions.length > 0) {
        setTravelOptions(liveOptions);
      }
      // else: keep instant fallback
    } catch (err) {
      console.warn("Travel search API unavailable, keeping estimated options.", err);
      // instant fallback already shown — nothing to do
    } finally {
      setTravelLoading(false);
    }
  };

  const handleTravelSelect = (option: TravelOption) => {
    setSelectedTravel(option);
    setStep(4);
  };

  const handleTravelSkip = () => {
    setSelectedTravel(null);
    setStep(4);
  };

  const steps = [
    { title: "Where are you going?",    subtitle: "Choose your destination",         icon: Globe    },
    { title: "Trip Details",             subtitle: "Dates, pace & preferences",       icon: Calendar },
    { title: "AI Budget",                subtitle: "Smart financial planning",        icon: Wallet   },
    { title: "How will you travel?",     subtitle: "Compare flights, trains & buses", icon: Plane    },
    { title: "Your Style",               subtitle: "Tell us what you love",           icon: Sparkles },
  ];

  const canAdvance = () => {
    if (step === 0) return !!form.departure_city && !!form.destination_city;
    if (step === 1) return !!form.start_date && !!form.end_date;
    if (step === 2) return form.budget_usd > 0;
    if (step === 3) return true;
    return true;
  };

  const handleNext = () => {
    if (step === 1) {
      // Auto-generate budget when moving to budget step
      setStep(2);
      // Trigger after state update
      setTimeout(() => {
        handleEstimateBudget();
      }, 100);
      return;
    }
    if (step === 2 && form.departure_city && form.destination_city && form.start_date) {
      // Trigger travel search when moving to travel step
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
              <div className="relative">
                <CitySearch
                  label="Starting point of your dream"
                  value={form.departure_city || ""}
                  onChange={handleDepartureSelect}
                  placeholder="Search departure city..."
                  excludeCities={form.destination_city ? [form.destination_city] : []}
                />
                {/* Use current location button */}
                {!form.departure_city && (
                  <button
                    type="button"
                    onClick={handleUseCurrentLocation}
                    disabled={isLocating}
                    className="mt-2 flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium text-primary bg-primary/10 hover:bg-primary/20 transition-colors disabled:opacity-50"
                  >
                    {isLocating ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <LocateFixed className="h-3.5 w-3.5" />
                    )}
                    {isLocating ? "Detecting location..." : "Use current location"}
                  </button>
                )}
              </div>

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

      {/* Step 1: Trip Details — dates, pace, group size, stay type, transport mode */}
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
              <p className="text-xs text-muted-foreground">{destCity?.country} · {destCity?.description}</p>
            </div>
          </div>

          {/* Dates */}
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

          {/* Pace */}
          <Select
            label="Travel Pace"
            options={PACE_OPTIONS}
            value={form.pace}
            onChange={(v) => updateForm({ pace: v as TripGenerateRequest["pace"] })}
          />

          {/* Group Size */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">People</label>
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => updateForm({ group_size: Math.max(1, (form.group_size || 1) - 1) })}
                className="h-10 w-10 rounded-xl border border-border flex items-center justify-center hover:bg-muted transition text-lg"
              >−</button>
              <div className="flex items-center gap-2 min-w-[60px] justify-center">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span className="text-xl font-bold text-foreground">{form.group_size || 1}</span>
              </div>
              <button
                type="button"
                onClick={() => updateForm({ group_size: Math.min(20, (form.group_size || 1) + 1) })}
                className="h-10 w-10 rounded-xl border border-border flex items-center justify-center hover:bg-muted transition text-lg"
              >+</button>
              <span className="text-sm text-muted-foreground">{(form.group_size || 1) === 1 ? 'Solo' : (form.group_size || 1) === 2 ? 'Couple' : `Group of ${form.group_size}`}</span>
            </div>
          </div>

          {/* Stay Type */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              <span className="flex items-center gap-1.5">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                Type of Stay
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
                      ? "border-primary bg-primary/10 text-primary shadow-sm"
                      : "border-border text-muted-foreground hover:border-primary/30"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Transport Mode */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              <span className="flex items-center gap-1.5">
                <Route className="h-4 w-4 text-muted-foreground" />
                Mode of Transport
              </span>
            </label>
            <div className="flex flex-wrap gap-2">
              {TRANSPORT_MODE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setTransportMode(opt.value)}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium border transition-all ${
                    transportMode === opt.value
                      ? "border-primary bg-primary/10 text-primary shadow-sm"
                      : "border-border text-muted-foreground hover:border-primary/30"
                  }`}
                >
                  <span>{opt.emoji}</span>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </motion.div>
      )}

      {/* Step 2: AI Budget — auto-generated from trip details */}
      {step === 2 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-5"
        >
          {/* Trip summary pill */}
          <div className="flex flex-wrap items-center justify-center gap-3 text-sm text-muted-foreground">
            <span className="px-3 py-1.5 rounded-full bg-muted text-xs font-medium">{form.departure_city} → {form.destination_city}</span>
            <span className="px-3 py-1.5 rounded-full bg-muted text-xs font-medium">{form.start_date} – {form.end_date}</span>
            <span className="px-3 py-1.5 rounded-full bg-muted text-xs font-medium">{form.group_size || 1} {(form.group_size || 1) === 1 ? 'person' : 'people'}</span>
            <span className="px-3 py-1.5 rounded-full bg-muted text-xs font-medium capitalize">{form.stay_type}</span>
            <span className="px-3 py-1.5 rounded-full bg-muted text-xs font-medium capitalize">{form.pace} pace</span>
          </div>

          {/* Loading spinner while AI estimates */}
          {isEstimatingBudget && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center gap-4 py-10"
            >
              <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-xl shadow-violet-500/30 animate-pulse">
                <BrainCircuit className="h-8 w-8 text-white" />
              </div>
              <div className="text-center">
                <p className="font-semibold text-foreground">Analysing your trip...</p>
                <p className="text-sm text-muted-foreground mt-1">AI is calculating a realistic budget</p>
              </div>
              <div className="flex gap-1.5">
                {[0, 1, 2].map((i) => (
                  <motion.div
                    key={i}
                    animate={{ opacity: [0.3, 1, 0.3] }}
                    transition={{ repeat: Infinity, duration: 1.2, delay: i * 0.3 }}
                    className="h-2 w-2 rounded-full bg-violet-500"
                  />
                ))}
              </div>
            </motion.div>
          )}

          {/* Budget result */}
          {!isEstimatingBudget && (
            <>
              {/* Budget input — pre-filled by AI, user can adjust */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="block text-sm font-medium text-foreground">Total Budget ({currency})</label>
                  <button
                    type="button"
                    onClick={handleEstimateBudget}
                    disabled={isEstimatingBudget}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-gradient-to-r from-violet-500/10 to-purple-500/10 text-violet-600 dark:text-violet-400 hover:from-violet-500/20 hover:to-purple-500/20 border border-violet-500/20 transition-all"
                  >
                    <BrainCircuit className="h-3.5 w-3.5" />
                    Re-estimate
                  </button>
                </div>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium text-muted-foreground">{symbol}</span>
                  <input
                    type="number"
                    value={form.budget_usd}
                    onChange={(e) => {
                      updateForm({ budget_usd: parseInt(e.target.value) || 0 });
                      setBudgetResult(null);
                      setShowBudgetDetails(false);
                    }}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-border bg-background/50 backdrop-blur-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-lg font-semibold"
                    min={100}
                    step={currency === "JPY" ? 1000 : 100}
                  />
                </div>
                <div className="flex gap-2">
                  {quickAmounts.map((amount) => (
                    <button
                      key={amount}
                      type="button"
                      onClick={() => {
                        updateForm({ budget_usd: amount });
                        setBudgetResult(null);
                        setShowBudgetDetails(false);
                      }}
                      className={`flex-1 py-1.5 text-xs rounded-lg border transition-all ${
                        form.budget_usd === amount
                          ? "border-primary bg-primary/10 text-primary shadow-sm"
                          : "border-border text-muted-foreground hover:border-primary/30"
                      }`}
                    >
                      {symbol}{formatBudgetLabel(amount)}
                    </button>
                  ))}
                </div>
              </div>

              {/* AI Budget Intelligence Panel */}
              <AnimatePresence>
              {budgetResult && showBudgetDetails && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="rounded-2xl border border-violet-500/20 bg-gradient-to-br from-violet-500/5 via-purple-500/5 to-fuchsia-500/5 overflow-hidden"
                >
                  {/* Header */}
                  <div className="px-4 py-3 flex items-center justify-between border-b border-violet-500/10">
                    <div className="flex items-center gap-2">
                      <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                        <BrainCircuit className="h-4 w-4 text-white" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-foreground">AI Budget Planner</p>
                        <p className="text-[10px] text-muted-foreground">{budgetResult.goal}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {budgetResult.preference && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-violet-500/10 text-violet-600 dark:text-violet-400 capitalize">
                          {budgetResult.preference}
                        </span>
                      )}
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                        budgetResult.confidence === 'high'
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                          : budgetResult.confidence === 'medium'
                          ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                          : 'bg-red-500/10 text-red-600 dark:text-red-400'
                      }`}>
                        {budgetResult.confidence} confidence
                      </span>
                      <button type="button" onClick={() => setShowBudgetDetails(false)} className="text-muted-foreground hover:text-foreground text-xs ml-1">✕</button>
                    </div>
                  </div>

                  <div className="p-4 space-y-4">
                    {/* Allocation Bars */}
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                        <TrendingUp className="h-3.5 w-3.5" />Budget Allocation
                      </p>
                      {budgetResult.allocation.map((item: BudgetAllocationItem) => (
                        <div key={item.category} className="space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-foreground font-medium">{item.category}</span>
                            <span className="text-xs font-semibold text-foreground">
                              {symbol}{item.amount.toLocaleString()}
                              <span className="text-muted-foreground font-normal ml-1">({item.percentage}%)</span>
                            </span>
                          </div>
                          <div className="h-2 rounded-full bg-muted overflow-hidden">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${Math.min(item.percentage, 100)}%` }}
                              transition={{ duration: 0.6, ease: "easeOut" }}
                              className="h-full rounded-full bg-gradient-to-r from-violet-500 to-purple-500"
                            />
                          </div>
                          <p className="text-[10px] text-muted-foreground/70">{item.reason}</p>
                        </div>
                      ))}
                    </div>

                    {budgetResult.hidden_costs.length > 0 && (
                      <div className="rounded-xl bg-amber-500/5 border border-amber-500/15 p-3 space-y-1.5">
                        <p className="text-xs font-medium text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                          <DollarSign className="h-3.5 w-3.5" />Hidden Costs to Watch
                        </p>
                        {budgetResult.hidden_costs.map((cost: string, i: number) => (
                          <p key={i} className="text-[11px] text-muted-foreground pl-5">• {cost}</p>
                        ))}
                      </div>
                    )}

                    {budgetResult.overspending_risk && (
                      <div className="rounded-xl bg-red-500/5 border border-red-500/15 p-3">
                        <p className="text-xs font-medium text-red-600 dark:text-red-400 flex items-center gap-1.5">
                          <Navigation className="h-3.5 w-3.5" />Overspending Risk
                        </p>
                        <p className="text-[11px] text-muted-foreground mt-1 pl-5">{budgetResult.overspending_risk}</p>
                      </div>
                    )}

                    {budgetResult.optimization_tips.length > 0 && (
                      <div className="rounded-xl bg-emerald-500/5 border border-emerald-500/15 p-3 space-y-1.5">
                        <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                          <Lightbulb className="h-3.5 w-3.5" />Money-Saving Tips
                        </p>
                        {budgetResult.optimization_tips.map((tip: string, i: number) => (
                          <p key={i} className="text-[11px] text-muted-foreground pl-5">• {tip}</p>
                        ))}
                      </div>
                    )}

                    {budgetResult.assumptions.length > 0 && (
                      <div className="pt-1 space-y-1">
                        <p className="text-[10px] text-muted-foreground/60 font-medium">Assumptions</p>
                        {budgetResult.assumptions.map((a: string, i: number) => (
                          <p key={i} className="text-[10px] text-muted-foreground/50 pl-2">• {a}</p>
                        ))}
                      </div>
                    )}

                    <p className="text-[10px] text-muted-foreground/40 text-right">
                      {budgetResult.ai_generated ? 'Powered by AI' : 'Heuristic estimate'} · {budgetResult.duration_days} days · adjust as needed
                    </p>
                  </div>
                </motion.div>
              )}
              </AnimatePresence>

              {!budgetResult && !isEstimatingBudget && (
                <div className="text-center py-4">
                  <p className="text-sm text-muted-foreground">Budget could not be estimated automatically.</p>
                  <button type="button" onClick={handleEstimateBudget} className="mt-2 text-sm text-primary underline">Try again</button>
                </div>
              )}
            </>
          )}
        </motion.div>
      )}

      {/* Step 3: Travel Comparison + Route Visualization */}
      {step === 3 && (
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
            departureLat={depCity?.lat}
            departureLng={depCity?.lng}
            arrivalLat={destCity?.lat}
            arrivalLng={destCity?.lng}
            isLoading={travelLoading}
            onSelect={handleTravelSelect}
            onSkip={handleTravelSkip}
          />
        </motion.div>
      )}

      {/* Step 4: Interests - Spinning Wheel */}
      {step === 4 && (
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

        {step < 4 ? (
          step === 3 ? (
            <div />
          ) : (
            <Button
              type="button"
              onClick={handleNext}
              disabled={!canAdvance()}
              className="bg-foreground text-background hover:bg-foreground/90"
            >
              {step === 1 ? (
                <>
                  <BrainCircuit className="h-4 w-4 mr-2" />
                  Next — Generate Budget
                </>
              ) : (
                <>
                  Continue
                  <ArrowRight className="h-4 w-4 ml-2" />
                </>
              )}
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
