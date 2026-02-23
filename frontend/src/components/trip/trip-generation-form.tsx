"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
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
} from "lucide-react";
import type { TripGenerateRequest } from "@/types";

interface TripGenerationFormProps {
  onSubmit: (data: TripGenerateRequest) => void;
  isLoading?: boolean;
}

const CITIES = [
  { value: "Paris", label: "Paris, France", description: "City of Lights" },
  { value: "Tokyo", label: "Tokyo, Japan", description: "Neon & Tradition" },
  { value: "New York", label: "New York, USA", description: "The Big Apple" },
  { value: "London", label: "London, UK", description: "Royal Heritage" },
];

const COUNTRIES: Record<string, string> = {
  Paris: "France",
  Tokyo: "Japan",
  "New York": "USA",
  London: "UK",
};

const PACE_OPTIONS = [
  { value: "relaxed", label: "Relaxed", description: "2-3 activities/day, late starts" },
  { value: "moderate", label: "Moderate", description: "3-5 activities/day" },
  { value: "fast", label: "Fast", description: "5-7 activities/day, packed schedule" },
];

export function TripGenerationForm({ onSubmit, isLoading }: TripGenerationFormProps) {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<TripGenerateRequest>({
    destination_city: "",
    destination_country: "",
    start_date: "",
    end_date: "",
    budget_usd: 2000,
    pace: "moderate",
    group_size: 1,
    interest_culture: 0.5,
    interest_nature: 0.5,
    interest_food: 0.5,
    interest_adventure: 0.5,
    interest_relaxation: 0.5,
  });

  const updateForm = (updates: Partial<TripGenerateRequest>) => {
    setForm((prev) => ({ ...prev, ...updates }));
  };

  const handleCityChange = (city: string) => {
    updateForm({
      destination_city: city,
      destination_country: COUNTRIES[city] || "",
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(form);
  };

  const steps = [
    {
      title: "Where to?",
      subtitle: "Choose your dream destination",
      icon: MapPin,
    },
    {
      title: "When & Budget",
      subtitle: "Set your travel dates and budget",
      icon: Calendar,
    },
    {
      title: "Your Style",
      subtitle: "Tell us what you love",
      icon: Sparkles,
    },
  ];

  const canAdvance = () => {
    if (step === 0) return !!form.destination_city;
    if (step === 1) return !!form.start_date && !!form.end_date && form.budget_usd > 0;
    return true;
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Step indicator */}
      <div className="flex items-center justify-center gap-2 mb-8">
        {steps.map((s, i) => (
          <button
            key={i}
            type="button"
            onClick={() => i < step && setStep(i)}
            className="flex items-center gap-2"
          >
            <div
              className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-medium transition-all duration-300 ${
                i === step
                  ? "bg-primary text-primary-foreground shadow-lg shadow-primary/30"
                  : i < step
                  ? "bg-primary/20 text-primary"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {i + 1}
            </div>
            {i < steps.length - 1 && (
              <div
                className={`w-12 h-0.5 rounded ${
                  i < step ? "bg-primary" : "bg-muted"
                }`}
              />
            )}
          </button>
        ))}
      </div>

      {/* Step title */}
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

      {/* Step 0: Destination */}
      {step === 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          <div className="grid grid-cols-2 gap-3">
            {CITIES.map((city) => (
              <button
                key={city.value}
                type="button"
                onClick={() => handleCityChange(city.value)}
                className={`p-4 rounded-2xl border text-left transition-all duration-200 ${
                  form.destination_city === city.value
                    ? "border-primary bg-primary/5 shadow-lg shadow-primary/10"
                    : "border-border hover:border-primary/30 hover:bg-muted/50"
                }`}
              >
                <div className="text-2xl mb-2">
                  {city.value === "Paris"
                    ? "🇫🇷"
                    : city.value === "Tokyo"
                    ? "🇯🇵"
                    : city.value === "New York"
                    ? "🇺🇸"
                    : "🇬🇧"}
                </div>
                <div className="font-semibold text-foreground">{city.label}</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {city.description}
                </div>
              </button>
            ))}
          </div>
        </motion.div>
      )}

      {/* Step 1: Dates & Budget */}
      {step === 1 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
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
                onChange={(e) =>
                  updateForm({ budget_usd: parseInt(e.target.value) || 0 })
                }
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-border bg-background/50 backdrop-blur-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                min={100}
                step={100}
              />
            </div>
            <div className="flex gap-2">
              {[500, 1000, 2000, 5000].map((amount) => (
                <button
                  key={amount}
                  type="button"
                  onClick={() => updateForm({ budget_usd: amount })}
                  className={`flex-1 py-1.5 text-xs rounded-lg border transition ${
                    form.budget_usd === amount
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:border-primary/30"
                  }`}
                >
                  ${amount.toLocaleString()}
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
                  onClick={() =>
                    updateForm({
                      group_size: Math.max(1, (form.group_size || 1) - 1),
                    })
                  }
                  className="h-10 w-10 rounded-xl border border-border flex items-center justify-center hover:bg-muted transition"
                >
                  -
                </button>
                <div className="flex items-center gap-1.5">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span className="text-lg font-semibold w-6 text-center">
                    {form.group_size || 1}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    updateForm({
                      group_size: Math.min(10, (form.group_size || 1) + 1),
                    })
                  }
                  className="h-10 w-10 rounded-xl border border-border flex items-center justify-center hover:bg-muted transition"
                >
                  +
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Step 2: Interests */}
      {step === 2 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-5"
        >
          <p className="text-sm text-muted-foreground text-center">
            Adjust the sliders to tell our AI what matters most to you
          </p>
          <Slider
            label="🏛️ Culture & History"
            value={form.interest_culture || 0.5}
            onChange={(v) => updateForm({ interest_culture: v })}
            min={0}
            max={1}
            step={0.1}
          />
          <Slider
            label="🌿 Nature & Outdoors"
            value={form.interest_nature || 0.5}
            onChange={(v) => updateForm({ interest_nature: v })}
            min={0}
            max={1}
            step={0.1}
          />
          <Slider
            label="🍽️ Food & Dining"
            value={form.interest_food || 0.5}
            onChange={(v) => updateForm({ interest_food: v })}
            min={0}
            max={1}
            step={0.1}
          />
          <Slider
            label="🏔️ Adventure"
            value={form.interest_adventure || 0.5}
            onChange={(v) => updateForm({ interest_adventure: v })}
            min={0}
            max={1}
            step={0.1}
          />
          <Slider
            label="🧘 Relaxation"
            value={form.interest_relaxation || 0.5}
            onChange={(v) => updateForm({ interest_relaxation: v })}
            min={0}
            max={1}
            step={0.1}
          />
        </motion.div>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between pt-4">
        {step > 0 ? (
          <Button
            type="button"
            variant="ghost"
            onClick={() => setStep(step - 1)}
          >
            Back
          </Button>
        ) : (
          <div />
        )}

        {step < 2 ? (
          <Button
            type="button"
            onClick={() => setStep(step + 1)}
            disabled={!canAdvance()}
          >
            Continue
          </Button>
        ) : (
          <Button type="submit" disabled={isLoading}>
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
