"use client";

import React, { useState, useMemo } from "react";
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
} from "lucide-react";
import { TravelComparison } from "@/components/trip/travel-comparison";
import { InteractiveGlobe } from "@/components/globe/interactive-globe";
import { CitySearch } from "@/components/search/city-search";
import { getCityData, type WorldCity } from "@/data/world-cities";
import { api } from "@/lib/api";
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
  { value: "hostel", label: "Hostel" },
  { value: "resort", label: "Resort" },
  { value: "airbnb", label: "Airbnb" },
  { value: "boutique", label: "Boutique" },
];

export function TripGenerationForm({ onSubmit, isLoading }: TripGenerationFormProps) {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<TripGenerateRequest>({
    departure_city: "",
    destination_city: "",
    destination_country: "",
    start_date: "",
    end_date: "",
    budget_usd: 2000,
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

  const updateForm = (updates: Partial<TripGenerateRequest>) => {
    setForm((prev) => ({ ...prev, ...updates }));
  };

  // Globe coordinates
  const destCity = useMemo(() => getCityData(form.destination_city), [form.destination_city]);
  const depCity = useMemo(() => getCityData(form.departure_city || ""), [form.departure_city]);

  const handleDepartureSelect = (city: WorldCity) => {
    updateForm({ departure_city: city.city });
  };

  const handleDestinationSelect = (city: WorldCity) => {
    updateForm({
      destination_city: city.city,
      destination_country: city.country,
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const data = { ...form };
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
    setStep(2);
  };

  const handleTravelSkip = () => {
    setSelectedTravel(null);
    setStep(2);
  };

  const steps = [
    { title: "Where are you going?", subtitle: "Choose departure & destination", icon: Globe },
    { title: "How will you travel?", subtitle: "Compare flights, trains & buses", icon: Plane },
    { title: "When & Budget", subtitle: "Set your travel dates and budget", icon: Calendar },
    { title: "Your Style", subtitle: "Tell us what you love", icon: Sparkles },
  ];

  const canAdvance = () => {
    if (step === 0) return !!form.departure_city && !!form.destination_city && !!form.start_date;
    if (step === 1) return true;
    if (step === 2) return !!form.start_date && !!form.end_date && form.budget_usd > 0;
    return true;
  };

  const handleNext = () => {
    if (step === 0 && form.departure_city && form.destination_city && form.start_date) {
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
                  ? "bg-foreground text-background shadow-lg scale-110"
                  : i < step
                  ? "bg-foreground/20 text-foreground"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              <s.icon className="h-4 w-4" />
            </div>
            {i < steps.length - 1 && (
              <div className={`w-8 sm:w-16 h-0.5 rounded transition-all duration-500 ${
                i < step ? "bg-foreground/40" : "bg-muted"
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

      {/* Step 0: Departure + Destination + Globe */}
      {step === 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          {/* 3D Globe - Hero element */}
          <div className="flex justify-center mb-4">
            <div className="relative">
              <InteractiveGlobe
                focusLat={destCity?.lat}
                focusLng={destCity?.lng}
                departureLat={depCity?.lat}
                departureLng={depCity?.lng}
                size={320}
                className="mx-auto"
              />
              {/* Floating route info */}
              <AnimatePresence>
                {form.departure_city && form.destination_city && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="absolute -bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-2 px-4 py-2 rounded-full glass text-sm font-medium shadow-lg"
                  >
                    <span className="flex items-center gap-1.5 text-primary">
                      <Navigation className="h-3.5 w-3.5" />
                      {form.departure_city}
                    </span>
                    <Route className="h-3.5 w-3.5 text-accent animate-pulse" />
                    <span className="flex items-center gap-1.5 text-accent">
                      <MapPin className="h-3.5 w-3.5" />
                      {form.destination_city}
                    </span>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Departure city search */}
          <CitySearch
            label="Departing from"
            value={form.departure_city || ""}
            onChange={handleDepartureSelect}
            placeholder="Search departure city..."
            excludeCities={form.destination_city ? [form.destination_city] : []}
          />

          {/* Animated connector */}
          {form.departure_city && (
            <div className="flex items-center justify-center gap-2 text-muted-foreground">
              <div className="h-px flex-1 bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="h-8 w-8 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg shadow-primary/20"
              >
                <ArrowRight className="h-4 w-4 text-white" />
              </motion.div>
              <div className="h-px flex-1 bg-gradient-to-r from-transparent via-accent/30 to-transparent" />
            </div>
          )}

          {/* Destination city search */}
          <CitySearch
            label="Going to"
            value={form.destination_city}
            onChange={handleDestinationSelect}
            placeholder="Search any destination worldwide..."
            excludeCities={form.departure_city ? [form.departure_city] : []}
          />

          {/* Travel date */}
          <div className="pt-2">
            <Input
              label="Travel Date"
              type="date"
              value={form.start_date}
              onChange={(e) => updateForm({ start_date: e.target.value })}
            />
          </div>
        </motion.div>
      )}

      {/* Step 1: Travel Comparison + Route Visualization */}
      {step === 1 && (
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
                ✓ Selected: {selectedTravel.provider_name} ({selectedTravel.transport_type}) — {selectedTravel.route_number}
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

      {/* Step 2: Dates & Budget */}
      {step === 2 && (
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
                {selectedTravel && ` · ${selectedTravel.provider_name}`}
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
              Budget (USD)
            </label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="number"
                value={form.budget_usd}
                onChange={(e) => updateForm({ budget_usd: parseInt(e.target.value) || 0 })}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-border bg-background/50 backdrop-blur-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                min={100}
                step={100}
              />
            </div>
            <div className="flex gap-2">
              {[500, 1000, 2000, 5000, 10000].map((amount) => (
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
                  ${amount >= 1000 ? `${amount / 1000}k` : amount}
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

      {/* Step 3: Interests */}
      {step === 3 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-5"
        >
          <p className="text-sm text-muted-foreground text-center">
            Adjust the sliders to tell our AI what matters most to you
          </p>
          <Slider label="Culture & History" value={form.interest_culture || 0.5} onChange={(v) => updateForm({ interest_culture: v })} min={0} max={1} step={0.1} />
          <Slider label="Nature & Outdoors" value={form.interest_nature || 0.5} onChange={(v) => updateForm({ interest_nature: v })} min={0} max={1} step={0.1} />
          <Slider label="Food & Dining" value={form.interest_food || 0.5} onChange={(v) => updateForm({ interest_food: v })} min={0} max={1} step={0.1} />
          <Slider label="Adventure" value={form.interest_adventure || 0.5} onChange={(v) => updateForm({ interest_adventure: v })} min={0} max={1} step={0.1} />
          <Slider label="Relaxation" value={form.interest_relaxation || 0.5} onChange={(v) => updateForm({ interest_relaxation: v })} min={0} max={1} step={0.1} />
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
          step === 1 ? (
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
