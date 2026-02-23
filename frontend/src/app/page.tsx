"use client";

import React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { Button } from "@/components/ui/button";
import { InteractiveGlobe } from "@/components/globe/interactive-globe";
import {
  Sparkles,
  Zap,
  Shield,
  Map,
  Brain,
  ArrowRight,
  Globe,
  Cloud,
  Clock,
  RefreshCw,
  Plane,
  Star,
  MapPin,
  TrendingUp,
} from "lucide-react";

const fadeIn = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.6 },
};

const stagger = {
  animate: { transition: { staggerChildren: 0.1 } },
};

export default function LandingPage() {
  return (
    <div className="min-h-screen overflow-hidden">
      <Navbar />

      {/* Hero Section - Enhanced with Globe */}
      <section className="relative pt-28 pb-20 px-4 overflow-hidden min-h-[90vh] flex items-center">
        {/* Animated background */}
        <div className="absolute inset-0 -z-10">
          <div className="absolute top-1/4 left-1/6 w-[500px] h-[500px] bg-primary/8 rounded-full blur-[120px] animate-pulse" />
          <div className="absolute bottom-1/4 right-1/6 w-[500px] h-[500px] bg-accent/8 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: "1s" }} />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/3 rounded-full blur-[150px]" />
          {/* Floating particles */}
          <div className="floating-particles">
            {Array.from({ length: 20 }).map((_, i) => (
              <div
                key={i}
                className="particle"
                style={{
                  left: `${Math.random() * 100}%`,
                  top: `${Math.random() * 100}%`,
                  animationDelay: `${Math.random() * 5}s`,
                  animationDuration: `${3 + Math.random() * 4}s`,
                }}
              />
            ))}
          </div>
        </div>

        <div className="max-w-7xl mx-auto w-full">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Left - Text content */}
            <motion.div
              initial="initial"
              animate="animate"
              variants={stagger}
            >
              <motion.div variants={fadeIn} className="mb-6">
                <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full glass-subtle text-sm font-medium text-muted-foreground border border-primary/10">
                  <Sparkles className="h-3.5 w-3.5 text-primary" />
                  AI-Powered Travel Intelligence
                  <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
                </span>
              </motion.div>

              <motion.h1
                variants={fadeIn}
                className="text-5xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight leading-[1.08]"
              >
                Your Perfect Trip,
                <br />
                <span className="gradient-text">Endlessly Adapting</span>
              </motion.h1>

              <motion.p
                variants={fadeIn}
                className="mt-6 text-lg sm:text-xl text-muted-foreground max-w-xl leading-relaxed"
              >
                Our AI doesn&apos;t just plan your itinerary — it monitors weather,
                traffic, and crowd data in real-time, dynamically replanning to ensure
                every moment is optimized.
              </motion.p>

              <motion.div
                variants={fadeIn}
                className="mt-10 flex items-center gap-4 flex-wrap"
              >
                <Link href="/dashboard">
                  <Button
                    size="lg"
                    className="text-base px-8 bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 text-white shadow-xl shadow-primary/25 hover:shadow-primary/40 transition-all duration-300 hover:scale-[1.02]"
                  >
                    <Sparkles className="h-4 w-4 mr-2" />
                    Start Planning
                  </Button>
                </Link>
                <a href="#how-it-works">
                  <Button size="lg" variant="outline" className="text-base px-8 border-primary/20 hover:border-primary/40 hover:bg-primary/5">
                    How It Works
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </a>
              </motion.div>

              {/* Stats row */}
              <motion.div
                variants={fadeIn}
                className="mt-14 grid grid-cols-3 gap-8 max-w-md"
              >
                {[
                  { value: "100+", label: "Destinations", icon: MapPin },
                  { value: "7", label: "Continents", icon: Globe },
                  { value: "Real-time", label: "Adaptation", icon: TrendingUp },
                ].map((stat) => (
                  <div key={stat.label} className="group">
                    <div className="flex items-center gap-1.5 mb-1">
                      <stat.icon className="h-4 w-4 text-primary" />
                      <div className="text-2xl font-bold gradient-text">{stat.value}</div>
                    </div>
                    <div className="text-sm text-muted-foreground">{stat.label}</div>
                  </div>
                ))}
              </motion.div>
            </motion.div>

            {/* Right - 3D Globe */}
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 1, delay: 0.3 }}
              className="hidden lg:flex justify-center items-center relative"
            >
              <div className="relative">
                {/* Orbit rings */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-[420px] h-[420px] rounded-full border border-primary/10 animate-spin" style={{ animationDuration: "20s" }} />
                </div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-[480px] h-[480px] rounded-full border border-accent/5 animate-spin" style={{ animationDuration: "30s", animationDirection: "reverse" }} />
                </div>

                {/* Globe */}
                <InteractiveGlobe
                  size={400}
                  className="relative z-10"
                  autoRotate={true}
                />

                {/* Floating badges around globe */}
                <motion.div
                  animate={{ y: [-5, 5, -5] }}
                  transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                  className="absolute -top-2 right-10 glass-card p-2.5 px-3.5 flex items-center gap-2 text-xs font-medium z-20"
                >
                  <Plane className="h-3.5 w-3.5 text-primary" />
                  <span>Tokyo</span>
                  <Star className="h-3 w-3 text-warning fill-warning" />
                </motion.div>

                <motion.div
                  animate={{ y: [5, -5, 5] }}
                  transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                  className="absolute bottom-10 -left-4 glass-card p-2.5 px-3.5 flex items-center gap-2 text-xs font-medium z-20"
                >
                  <MapPin className="h-3.5 w-3.5 text-accent" />
                  <span>Paris</span>
                  <span className="text-success">✓</span>
                </motion.div>

                <motion.div
                  animate={{ y: [-3, 7, -3] }}
                  transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
                  className="absolute top-1/2 -right-8 glass-card p-2.5 px-3.5 flex items-center gap-2 text-xs font-medium z-20"
                >
                  <Cloud className="h-3.5 w-3.5 text-primary" />
                  <span>Live Weather</span>
                </motion.div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Trusted by section - Scrolling logos */}
      <section className="py-8 border-y border-border/50 bg-muted/20">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex items-center justify-center gap-12 flex-wrap opacity-50">
            {["🗼 Paris", "🗽 New York", "🏯 Tokyo", "🕌 Dubai", "🏟️ Rome", "🌉 San Francisco", "🎡 London", "🏖️ Bali"].map((city) => (
              <span key={city} className="text-sm font-medium text-muted-foreground whitespace-nowrap">
                {city}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* How it Works - Enhanced */}
      <section id="how-it-works" className="py-24 px-4">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-xs font-medium text-primary mb-4">
              <Zap className="h-3 w-3" />
              Simple & Powerful
            </span>
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground">
              How It Works
            </h2>
            <p className="mt-3 text-muted-foreground max-w-lg mx-auto">
              Three simple steps to your dynamically optimized itinerary
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                step: "01",
                icon: Globe,
                title: "Tell Us Your Dream",
                description:
                  "Search from 100+ destinations worldwide. Our interactive globe lets you explore and select your perfect destination.",
                color: "from-primary to-blue-600",
              },
              {
                step: "02",
                icon: Brain,
                title: "AI Crafts Your Plan",
                description:
                  "Our scoring engine evaluates every place using weighted interest matching, distance optimization, and risk analysis.",
                color: "from-accent to-teal-600",
              },
              {
                step: "03",
                icon: RefreshCw,
                title: "Real-time Adaptation",
                description:
                  "Weather changes? Crowd surges? The replanner dynamically adjusts your itinerary while preserving your locked items.",
                color: "from-purple-500 to-pink-500",
              },
            ].map((item, idx) => (
              <motion.div
                key={item.step}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.15 }}
                className="glass-card p-8 text-center group hover:border-primary/20 transition-all duration-500 hover:shadow-xl hover:shadow-primary/5 hover:-translate-y-1"
              >
                <div className="text-xs font-bold text-primary/50 mb-4">
                  STEP {item.step}
                </div>
                <div className={`h-16 w-16 rounded-2xl bg-gradient-to-br ${item.color} flex items-center justify-center mx-auto mb-5 shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                  <item.icon className="h-8 w-8 text-white" />
                </div>
                <h3 className="text-lg font-bold text-foreground mb-2">
                  {item.title}
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {item.description}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Features - Enhanced with gradient borders */}
      <section id="features" className="py-24 px-4 relative">
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-transparent via-muted/30 to-transparent" />
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent/10 text-xs font-medium text-accent mb-4">
              <Brain className="h-3 w-3" />
              Cutting Edge
            </span>
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground">
              Intelligent Features
            </h2>
            <p className="mt-3 text-muted-foreground max-w-lg mx-auto">
              Every feature engineered for the perfect travel experience
            </p>
          </motion.div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                icon: Brain,
                title: "Weighted Scoring Engine",
                description:
                  "Score = (Interest × W1) + (Distance × W2) - (Risk × W3) - (Fatigue × W4). Dynamic weights adjust for budget and time pressure.",
                gradient: "from-blue-500/10 to-blue-600/5",
              },
              {
                icon: Map,
                title: "Route Optimization",
                description:
                  "Nearest-neighbor heuristic with time-window constraints, opening hours validation, and distance-adjusted scoring.",
                gradient: "from-green-500/10 to-green-600/5",
              },
              {
                icon: Shield,
                title: "Stability Index",
                description:
                  "Real-time trip health from budget deviation, risk assessment, weather sensitivity, and schedule tightness.",
                gradient: "from-purple-500/10 to-purple-600/5",
              },
              {
                icon: Cloud,
                title: "Weather Integration",
                description:
                  "Live weather monitoring with 30-minute caching. Outdoor activities auto-swap during bad conditions.",
                gradient: "from-cyan-500/10 to-cyan-600/5",
              },
              {
                icon: Zap,
                title: "Dynamic Replanning",
                description:
                  "Only affected segments are replanned. Locked items stay untouched. Indoor alternatives get priority boosts.",
                gradient: "from-amber-500/10 to-amber-600/5",
              },
              {
                icon: Clock,
                title: "Pace-Aware Scheduling",
                description:
                  "Relaxed, moderate, or fast pace controls daily activity count, start times, and buffer durations.",
                gradient: "from-rose-500/10 to-rose-600/5",
              },
            ].map((feature, idx) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.08 }}
                className={`p-6 rounded-2xl border border-border bg-gradient-to-br ${feature.gradient} hover:border-primary/20 hover:shadow-xl hover:shadow-primary/5 transition-all duration-300 group hover:-translate-y-0.5`}
              >
                <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 group-hover:scale-110 transition-all duration-300">
                  <feature.icon className="h-5 w-5 text-primary" />
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

      {/* Destinations showcase */}
      <section className="py-24 px-4">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-warning/10 text-xs font-medium text-warning mb-4">
              <Star className="h-3 w-3" />
              Popular
            </span>
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground">
              Trending Destinations
            </h2>
            <p className="mt-3 text-muted-foreground max-w-lg mx-auto">
              Discover the most loved destinations by our travelers
            </p>
          </motion.div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { city: "Tokyo", emoji: "🇯🇵", img: "🏯", tag: "Trending" },
              { city: "Paris", emoji: "🇫🇷", img: "🗼", tag: "Popular" },
              { city: "Dubai", emoji: "🇦🇪", img: "🌇", tag: "Luxe" },
              { city: "Bali", emoji: "🇮🇩", img: "🏝️", tag: "Paradise" },
              { city: "Rome", emoji: "🇮🇹", img: "🏛️", tag: "Historic" },
              { city: "New York", emoji: "🇺🇸", img: "🗽", tag: "Iconic" },
              { city: "Singapore", emoji: "🇸🇬", img: "🌃", tag: "Modern" },
              { city: "Cape Town", emoji: "🇿🇦", img: "⛰️", tag: "Nature" },
            ].map((dest, idx) => (
              <motion.div
                key={dest.city}
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.05 }}
              >
                <Link href="/dashboard">
                  <div className="group relative p-6 rounded-2xl border border-border bg-card hover:border-primary/30 hover:shadow-xl hover:shadow-primary/5 transition-all duration-300 hover:-translate-y-1 cursor-pointer overflow-hidden">
                    <div className="absolute top-3 right-3 px-2 py-0.5 rounded-full bg-primary/10 text-[10px] font-medium text-primary">
                      {dest.tag}
                    </div>
                    <div className="text-4xl mb-3 group-hover:scale-110 transition-transform duration-300">{dest.img}</div>
                    <div className="flex items-center gap-2">
                      <span className="text-base">{dest.emoji}</span>
                      <span className="font-semibold text-foreground">{dest.city}</span>
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA - Enhanced */}
      <section className="py-24 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="glass-card p-12 sm:p-16 relative overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-accent/5 to-primary/5" />
            <div className="absolute top-0 left-1/4 w-64 h-64 bg-primary/10 rounded-full blur-[100px]" />
            <div className="absolute bottom-0 right-1/4 w-64 h-64 bg-accent/10 rounded-full blur-[100px]" />

            <div className="relative">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                className="absolute -top-6 -right-6 text-5xl opacity-20"
              >
                ✈️
              </motion.div>

              <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
                Ready to Dream <span className="gradient-text">Endlessly?</span>
              </h2>
              <p className="text-muted-foreground mb-8 max-w-md mx-auto text-lg">
                Let our AI craft the perfect itinerary that adapts to every
                moment of your journey.
              </p>
              <Link href="/dashboard">
                <Button
                  size="lg"
                  className="text-base px-12 bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 text-white shadow-xl shadow-primary/25 hover:shadow-primary/40 hover:scale-[1.02] transition-all duration-300"
                >
                  <Sparkles className="h-5 w-5 mr-2" />
                  Plan Your Trip Now
                </Button>
              </Link>

              <div className="mt-8 flex items-center justify-center gap-6 text-sm text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <Shield className="h-4 w-4 text-success" />
                  Free to use
                </span>
                <span className="flex items-center gap-1.5">
                  <Zap className="h-4 w-4 text-warning" />
                  AI Powered
                </span>
                <span className="flex items-center gap-1.5">
                  <RefreshCw className="h-4 w-4 text-primary" />
                  Real-time
                </span>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
