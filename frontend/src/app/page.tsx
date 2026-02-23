"use client";

import React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { Button } from "@/components/ui/button";
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
    <div className="min-h-screen">
      <Navbar />

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 px-4 overflow-hidden">
        {/* Background effects */}
        <div className="absolute inset-0 -z-10">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-accent/10 rounded-full blur-3xl" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/5 rounded-full blur-3xl" />
        </div>

        <motion.div
          initial="initial"
          animate="animate"
          variants={stagger}
          className="max-w-5xl mx-auto text-center"
        >
          <motion.div variants={fadeIn} className="mb-6">
            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full glass-subtle text-sm font-medium text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              AI-Powered Travel Intelligence
            </span>
          </motion.div>

          <motion.h1
            variants={fadeIn}
            className="text-5xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight leading-[1.1]"
          >
            Your Perfect Trip,
            <br />
            <span className="gradient-text">Endlessly Adapting</span>
          </motion.h1>

          <motion.p
            variants={fadeIn}
            className="mt-6 text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed"
          >
            Our AI doesn&apos;t just plan your itinerary — it monitors weather,
            traffic, and crowd data in real-time, dynamically replanning to ensure
            every moment is optimized.
          </motion.p>

          <motion.div
            variants={fadeIn}
            className="mt-10 flex items-center justify-center gap-4 flex-wrap"
          >
            <Link href="/dashboard">
              <Button size="lg" className="text-base px-8 shadow-lg shadow-primary/25 hover:shadow-primary/40 transition-shadow">
                <Sparkles className="h-4 w-4 mr-2" />
                Start Planning
              </Button>
            </Link>
            <a href="#how-it-works">
              <Button size="lg" variant="outline" className="text-base px-8">
                How It Works
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </a>
          </motion.div>

          {/* Stats row */}
          <motion.div
            variants={fadeIn}
            className="mt-16 grid grid-cols-3 gap-8 max-w-lg mx-auto"
          >
            {[
              { value: "40+", label: "Curated Places" },
              { value: "4", label: "Cities" },
              { value: "Real-time", label: "Adaptation" },
            ].map((stat) => (
              <div key={stat.label}>
                <div className="text-2xl font-bold gradient-text">{stat.value}</div>
                <div className="text-sm text-muted-foreground mt-0.5">{stat.label}</div>
              </div>
            ))}
          </motion.div>
        </motion.div>
      </section>

      {/* How it Works */}
      <section id="how-it-works" className="py-20 px-4">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
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
                  "Choose your destination, dates, budget, and travel interests. Our AI understands your unique style.",
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
                transition={{ delay: idx * 0.15 }}
                className="glass-card p-8 text-center group hover:border-primary/20 transition-all duration-300"
              >
                <div className="text-xs font-bold text-primary/50 mb-4">
                  STEP {item.step}
                </div>
                <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-5 group-hover:bg-primary/20 transition">
                  <item.icon className="h-7 w-7 text-primary" />
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

      {/* Features */}
      <section id="features" className="py-20 px-4 bg-muted/30">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
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
                transition={{ delay: idx * 0.08 }}
                className="p-6 rounded-2xl border border-border bg-card hover:border-primary/20 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300 group"
              >
                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/15 transition">
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

      {/* CTA */}
      <section className="py-20 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="glass-card p-12 relative overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-accent/5" />
            <div className="relative">
              <h2 className="text-3xl font-bold text-foreground mb-4">
                Ready to Dream Endlessly?
              </h2>
              <p className="text-muted-foreground mb-8 max-w-md mx-auto">
                Let our AI craft the perfect itinerary that adapts to every
                moment of your journey.
              </p>
              <Link href="/dashboard">
                <Button size="lg" className="text-base px-10 shadow-lg shadow-primary/25">
                  <Sparkles className="h-4 w-4 mr-2" />
                  Plan Your Trip Now
                </Button>
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
