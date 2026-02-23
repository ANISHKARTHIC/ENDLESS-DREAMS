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
import { Sparkles, MapPin, Calendar, Plane, ArrowRight, Settings2, Globe } from "lucide-react";
import Link from "next/link";

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
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg shadow-primary/20">
                <Globe className="h-5 w-5 text-white" />
              </div>
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

          <div className="grid lg:grid-cols-3 gap-8">
            {/* Trip Generation Form */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="lg:col-span-2"
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

            {/* Sidebar */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="space-y-6"
            >
              {/* Recent trips */}
              <Card glass>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Plane className="h-4 w-4 text-primary" />
                    Recent Trips
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {!loaded ? (
                    <div className="space-y-3">
                      {[1, 2].map((i) => (
                        <div
                          key={i}
                          className="h-16 rounded-xl shimmer"
                        />
                      ))}
                    </div>
                  ) : recentTrips.length === 0 ? (
                    <div className="text-center py-6">
                      <div className="text-3xl mb-2">✈️</div>
                      <p className="text-sm text-muted-foreground">
                        No trips yet. Create your first one!
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {recentTrips.slice(0, 5).map((trip) => (
                        <div
                          key={trip.id}
                          className="flex items-center gap-3 p-3 rounded-xl hover:bg-muted/50 transition group"
                        >
                          <Link href={`/trip/${trip.id}`} className="flex items-center gap-3 flex-1 min-w-0">
                            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                              <MapPin className="h-4 w-4 text-primary" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-foreground truncate">
                                {trip.destination_city}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {trip.duration_days} days &middot; $
                                {trip.budget_usd}
                              </p>
                            </div>
                          </Link>
                          <Link
                            href={`/trip/${trip.id}`}
                            className="p-1.5 rounded-lg hover:bg-primary/10 transition opacity-0 group-hover:opacity-100"
                            title="Customize trip"
                          >
                            <Settings2 className="h-3.5 w-3.5 text-primary" />
                          </Link>
                          <Link href={`/trip/${trip.id}`}>
                            <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition" />
                          </Link>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Quick tips */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Tips</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {[
                    "Adjust interest sliders to match your travel style",
                    "Lock important items to protect them from replanning",
                    "Drag items to reorder your daily schedule",
                    "The stability index shows real-time trip health",
                  ].map((tip, idx) => (
                    <div key={idx} className="flex gap-2 text-sm text-muted-foreground">
                      <span className="text-primary shrink-0">•</span>
                      <span>{tip}</span>
                    </div>
                  ))}
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
