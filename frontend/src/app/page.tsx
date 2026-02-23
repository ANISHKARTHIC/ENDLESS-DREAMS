"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  ArrowLeft,
  Globe,
  Brain,
  RefreshCw,
  Map,
  Shield,
  Cloud,
  Clock,
  Zap,
  MapPin,
  Plane,
} from "lucide-react";

/* ── Hero carousel slides ── */
const HERO_SLIDES = [
  {
    image: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1920&q=80",
    subtitle: "Be",
    title: "Adventurous",
    description: "Travel that adapts to you — in real-time.",
  },
  {
    image: "https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=1920&q=80",
    subtitle: "Discover",
    title: "The World",
    description: "100+ destinations, crafted by AI intelligence.",
  },
  {
    image: "https://images.unsplash.com/photo-1506929562872-bb421503ef21?w=1920&q=80",
    subtitle: "Experience",
    title: "Endless Dreams",
    description: "Every moment optimized. Every journey unforgettable.",
  },
];

/* ── Destination photo cards ── */
const DESTINATIONS = [
  { city: "Tokyo", country: "Japan", tag: "Trending", image: "https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=600&q=75" },
  { city: "Paris", country: "France", tag: "Popular", image: "https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=600&q=75" },
  { city: "Dubai", country: "UAE", tag: "Luxe", image: "https://images.unsplash.com/photo-1512453979798-5ea266f8880c?w=600&q=75" },
  { city: "Bali", country: "Indonesia", tag: "Paradise", image: "https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=600&q=75" },
  { city: "Rome", country: "Italy", tag: "Historic", image: "https://images.unsplash.com/photo-1552832230-c0197dd311b5?w=600&q=75" },
  { city: "New York", country: "USA", tag: "Iconic", image: "https://images.unsplash.com/photo-1496442226666-8d4d0e62e6e9?w=600&q=75" },
  { city: "Singapore", country: "Singapore", tag: "Modern", image: "https://images.unsplash.com/photo-1525625293386-3f8f99389edd?w=600&q=75" },
  { city: "Cape Town", country: "South Africa", tag: "Nature", image: "https://images.unsplash.com/photo-1580060839134-75a5edca2e99?w=600&q=75" },
];

export default function LandingPage() {
  const [currentSlide, setCurrentSlide] = useState(0);

  /* Auto-advance hero every 6s */
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % HERO_SLIDES.length);
    }, 6000);
    return () => clearInterval(timer);
  }, []);

  const goNext = () => setCurrentSlide((prev) => (prev + 1) % HERO_SLIDES.length);
  const goPrev = () => setCurrentSlide((prev) => (prev - 1 + HERO_SLIDES.length) % HERO_SLIDES.length);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />

      {/* ═══════════ HERO — Full-bleed photo carousel ═══════════ */}
      <section className="relative h-screen w-full overflow-hidden">
        {/* Background images */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentSlide}
            initial={{ opacity: 0, scale: 1.08 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.2 }}
            className="absolute inset-0"
          >
            <Image
              src={HERO_SLIDES[currentSlide].image}
              alt={HERO_SLIDES[currentSlide].title}
              fill
              priority
              className="object-cover"
              sizes="100vw"
            />
            {/* Dark overlay */}
            <div className="absolute inset-0 bg-black/40" />
          </motion.div>
        </AnimatePresence>

        {/* Hero text */}
        <div className="relative z-10 flex flex-col items-center justify-center h-full px-4 text-center">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentSlide}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.7 }}
              className="max-w-3xl"
            >
              <p className="text-white/70 text-sm sm:text-base uppercase tracking-[0.3em] font-light mb-3">
                {HERO_SLIDES[currentSlide].subtitle}
              </p>
              <h1 className="text-5xl sm:text-7xl lg:text-8xl font-bold text-white leading-[1.05] tracking-tight">
                {HERO_SLIDES[currentSlide].title}
              </h1>
              <p className="mt-5 text-white/80 text-lg sm:text-xl max-w-xl mx-auto leading-relaxed font-light">
                {HERO_SLIDES[currentSlide].description}
              </p>
            </motion.div>
          </AnimatePresence>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="mt-10 flex items-center gap-4"
          >
            <Link href="/dashboard">
              <Button
                size="lg"
                className="text-base px-10 py-3 bg-white text-black hover:bg-white/90 font-semibold shadow-2xl transition-all duration-300 hover:scale-[1.02] rounded-full"
              >
                Start Planning
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </Link>
            <a href="#how-it-works">
              <Button
                size="lg"
                variant="outline"
                className="text-base px-8 py-3 border-white/40 text-white hover:bg-white/10 rounded-full"
              >
                Learn More
              </Button>
            </a>
          </motion.div>

          {/* Slide indicators */}
          <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex items-center gap-3">
            {HERO_SLIDES.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentSlide(i)}
                className={`h-1.5 rounded-full transition-all duration-500 ${
                  i === currentSlide ? "w-10 bg-white" : "w-4 bg-white/40"
                }`}
              />
            ))}
          </div>

          {/* Carousel arrows */}
          <button
            onClick={goPrev}
            className="absolute left-6 top-1/2 -translate-y-1/2 p-3 rounded-full bg-black/20 backdrop-blur-sm text-white/80 hover:bg-black/40 hover:text-white transition-all"
            aria-label="Previous slide"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <button
            onClick={goNext}
            className="absolute right-6 top-1/2 -translate-y-1/2 p-3 rounded-full bg-black/20 backdrop-blur-sm text-white/80 hover:bg-black/40 hover:text-white transition-all"
            aria-label="Next slide"
          >
            <ArrowRight className="h-5 w-5" />
          </button>
        </div>
      </section>

      {/* ═══════════ Trusted destinations strip ═══════════ */}
      <section className="py-6 border-b border-border/40">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex items-center justify-center gap-10 flex-wrap">
            {["Paris", "New York", "Tokyo", "Dubai", "Rome", "San Francisco", "London", "Bali"].map((city) => (
              <span key={city} className="text-xs font-medium tracking-widest uppercase text-muted-foreground/60">
                {city}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════ How it Works ═══════════ */}
      <section id="how-it-works" className="py-24 px-4">
        <div className="max-w-5xl mx-auto">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <p className="text-xs tracking-[0.2em] uppercase text-muted-foreground mb-3">
              Simple Process
            </p>
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground">
              How It Works
            </h2>
            <p className="mt-3 text-muted-foreground max-w-md mx-auto">
              Three steps to your perfectly optimized itinerary
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-10">
            {[
              {
                step: "01",
                icon: Globe,
                title: "Choose Your Destination",
                description:
                  "Search from 100+ destinations worldwide. Our interactive globe lets you explore and select your perfect destination.",
              },
              {
                step: "02",
                icon: Brain,
                title: "AI Crafts Your Plan",
                description:
                  "Our scoring engine evaluates every place using weighted interest matching, distance optimization, and risk analysis.",
              },
              {
                step: "03",
                icon: RefreshCw,
                title: "Real-time Adaptation",
                description:
                  "Weather changes? Crowd surges? The replanner dynamically adjusts your itinerary while preserving your locked items.",
              },
            ].map((item, idx) => (
              <motion.div
                key={item.step}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.12 }}
                className="text-center group"
              >
                <div className="text-[64px] font-bold text-muted-foreground/10 leading-none mb-4">
                  {item.step}
                </div>
                <div className="h-14 w-14 rounded-full border border-border flex items-center justify-center mx-auto mb-5 group-hover:border-foreground/30 transition-colors duration-300">
                  <item.icon className="h-6 w-6 text-foreground/70" />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  {item.title}
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed max-w-xs mx-auto">
                  {item.description}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════ Features ═══════════ */}
      <section id="features" className="py-24 px-4 bg-muted/30">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <p className="text-xs tracking-[0.2em] uppercase text-muted-foreground mb-3">
              What We Offer
            </p>
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground">
              Intelligent Features
            </h2>
            <p className="mt-3 text-muted-foreground max-w-md mx-auto">
              Every feature engineered for the perfect travel experience
            </p>
          </motion.div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                icon: Brain,
                title: "Weighted Scoring Engine",
                description:
                  "Dynamic weights adjust for budget and time pressure with interest matching, distance optimization, and risk analysis.",
              },
              {
                icon: Map,
                title: "Route Optimization",
                description:
                  "Nearest-neighbor heuristic with time-window constraints, opening hours validation, and distance-adjusted scoring.",
              },
              {
                icon: Shield,
                title: "Stability Index",
                description:
                  "Real-time trip health from budget deviation, risk assessment, weather sensitivity, and schedule tightness.",
              },
              {
                icon: Cloud,
                title: "Weather Integration",
                description:
                  "Live weather monitoring with 30-minute caching. Outdoor activities auto-swap during bad conditions.",
              },
              {
                icon: Zap,
                title: "Dynamic Replanning",
                description:
                  "Only affected segments are replanned. Locked items stay untouched. Indoor alternatives get priority boosts.",
              },
              {
                icon: Clock,
                title: "Pace-Aware Scheduling",
                description:
                  "Relaxed, moderate, or fast pace controls daily activity count, start times, and buffer durations.",
              },
            ].map((feature, idx) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.06 }}
                className="p-6 rounded-2xl border border-border bg-card hover:border-foreground/15 transition-all duration-300 group"
              >
                <div className="h-10 w-10 rounded-full border border-border flex items-center justify-center mb-4 group-hover:border-foreground/30 transition-colors">
                  <feature.icon className="h-5 w-5 text-foreground/70" />
                </div>
                <h3 className="font-semibold text-foreground mb-2">
                  {feature.title}
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {feature.description}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════ Destinations showcase — photo cards ═══════════ */}
      <section className="py-24 px-4">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <p className="text-xs tracking-[0.2em] uppercase text-muted-foreground mb-3">
              Top Picks
            </p>
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground">
              Trending Destinations
            </h2>
            <p className="mt-3 text-muted-foreground max-w-md mx-auto">
              Discover the most loved destinations by our travelers
            </p>
          </motion.div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {DESTINATIONS.map((dest, idx) => (
              <motion.div
                key={dest.city}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.05 }}
              >
                <Link href="/dashboard">
                  <div className="group relative aspect-[3/4] rounded-2xl overflow-hidden cursor-pointer">
                    <Image
                      src={dest.image}
                      alt={dest.city}
                      fill
                      className="object-cover transition-transform duration-700 group-hover:scale-110"
                      sizes="(max-width: 768px) 50vw, 25vw"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                    <div className="absolute top-3 right-3 px-2.5 py-0.5 rounded-full bg-white/20 backdrop-blur-md text-[10px] font-medium text-white">
                      {dest.tag}
                    </div>
                    <div className="absolute bottom-4 left-4">
                      <p className="text-white font-semibold text-lg leading-tight">{dest.city}</p>
                      <p className="text-white/70 text-xs mt-0.5">{dest.country}</p>
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════ CTA ═══════════ */}
      <section className="py-24 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
              Ready to Start Your Journey?
            </h2>
            <p className="text-muted-foreground mb-8 max-w-md mx-auto text-lg">
              Let our AI craft the perfect itinerary that adapts to every
              moment of your adventure.
            </p>
            <Link href="/dashboard">
              <Button
                size="lg"
                className="text-base px-12 py-3 bg-foreground text-background hover:bg-foreground/90 font-semibold rounded-full transition-all duration-300 hover:scale-[1.02]"
              >
                Plan Your Trip Now
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </Link>

            <div className="mt-8 flex items-center justify-center gap-8 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Shield className="h-4 w-4" />
                Free to use
              </span>
              <span className="flex items-center gap-1.5">
                <Zap className="h-4 w-4" />
                AI Powered
              </span>
              <span className="flex items-center gap-1.5">
                <RefreshCw className="h-4 w-4" />
                Real-time
              </span>
            </div>
          </motion.div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
