"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { TripGenerationForm } from "@/components/trip/trip-generation-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";
import type { TripGenerateRequest, Trip } from "@/types";
import { Sparkles, MapPin, Calendar, Plane, ArrowRight, Settings2, Globe, Users, DollarSign, Clock } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export default function DashboardPage() {
  const router = useRouter();
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recentTrips, setRecentTrips] = useState<Trip[]>([]);
  const [loaded, setLoaded] = useState(false);

  // Load recent trips
  React.useEffect(() => {
    api
      .getTrips()
      .then((res) => {
        setRecentTrips(res.results || []);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  const handleGenerate = async (data: TripGenerateRequest) => {
    setIsGenerating(true);
    setError(null);
    try {
      const result = await api.generateTrip(data);
      router.push(`/trip/${result.trip.id}`);
    } catch (err: any) {
      setError(err.message || "Failed to generate trip. Please try again.");
      setIsGenerating(false);
    }
  };

  return (
    <div className="min-h-screen">
      <Navbar />

      <main className="pt-24 pb-16 px-4">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-10"
          >
            <div className="flex items-center gap-3 mb-2">
              <img src="/logo.svg" alt="Endless Dreams" className="h-10 w-auto" />
              <div>
                <h1 className="text-3xl sm:text-4xl font-bold text-foreground">
                  Plan Your Journey
                </h1>
                <p className="text-muted-foreground">
                  Explore 100+ destinations worldwide with AI-powered itineraries
                </p>
              </div>
            </div>
          </motion.div>

          <div className="grid lg:grid-cols-1 gap-8">
            {/* Trip Generation Form - Full Width */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <Card glass>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-primary" />
                    Create New Trip
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {error && (
                    <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-sm">
                      {error}
                    </div>
                  )}
                  <TripGenerationForm
                    onSubmit={handleGenerate}
                    isLoading={isGenerating}
                  />
                </CardContent>
              </Card>
            </motion.div>

            {/* Recent Trips - Below form */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <Card glass>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Plane className="h-4 w-4 text-primary" />
                    Recent Trips
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {!loaded ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {[1, 2, 3].map((i) => (
                        <div
                          key={i}
                          className="h-16 rounded-xl shimmer"
                        />
                      ))}
                    </div>
                  ) : recentTrips.length === 0 ? (
                    <div className="text-center py-8">
                      <Plane className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
                      <p className="text-sm text-muted-foreground">
                        No trips yet. Create your first one!
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {recentTrips.slice(0, 6).map((trip) => (
                        <Link
                          key={trip.id}
                          href={`/trip/${trip.id}`}
                          className="group rounded-2xl border border-border/50 overflow-hidden hover:shadow-lg hover:border-primary/20 transition-all duration-300"
                        >
                          {/* Cover image or gradient */}
                          <div className="h-32 bg-gradient-to-br from-primary/20 via-accent/10 to-primary/5 relative overflow-hidden">
                            <div className="absolute inset-0 flex items-center justify-center">
                              <Globe className="h-12 w-12 text-primary/20" />
                            </div>
                            <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-card to-transparent h-12" />
                            {/* Status badge */}
                            <div className="absolute top-3 right-3">
                              <span className={cn(
                                "px-2 py-0.5 rounded-full text-[10px] font-medium",
                                trip.status === "active" ? "bg-emerald-500/20 text-emerald-400" :
                                trip.status === "completed" ? "bg-blue-500/20 text-blue-400" :
                                "bg-muted text-muted-foreground"
                              )}>
                                {trip.status}
                              </span>
                            </div>
                          </div>
                          <div className="p-4">
                            <h3 className="font-semibold text-foreground group-hover:text-primary transition">
                              {trip.destination_city}
                            </h3>
                            <p className="text-xs text-muted-foreground mt-0.5">{trip.destination_country}</p>
                            <div className="flex items-center gap-3 mt-3 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {trip.duration_days}d
                              </span>
                              <span className="flex items-center gap-1">
                                <Users className="h-3 w-3" />
                                {trip.group_size}
                              </span>
                              <span className="flex items-center gap-1">
                                <DollarSign className="h-3 w-3" />
                                {trip.budget_usd}
                              </span>
                            </div>
                          </div>
                        </Link>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>

            {/* Quick tips - Below Recent Trips */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Tips</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {[
                      "Adjust interest sliders to match your travel style",
                      "Lock important items to protect them from replanning",
                      "Drag items to reorder your daily schedule",
                      "The stability index shows real-time trip health",
                    ].map((tip, idx) => (
                      <div key={idx} className="flex gap-2 text-sm text-muted-foreground p-3 rounded-xl bg-muted/30">
                        <span className="text-primary shrink-0">•</span>
                        <span>{tip}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
