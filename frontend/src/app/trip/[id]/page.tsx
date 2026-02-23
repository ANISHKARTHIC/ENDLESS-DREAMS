"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { motion } from "framer-motion";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { ItineraryTimeline } from "@/components/trip/itinerary-timeline";
import { StabilityBadge } from "@/components/trip/stability-badge";
import { WeatherOverlay } from "@/components/trip/weather-overlay";
import { ReplanEventsPanel } from "@/components/trip/replan-events";
import { BudgetProgress } from "@/components/ui/progress";
import { TripMap } from "@/components/map/trip-map";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  CardSkeleton,
  ItineraryCardSkeleton,
  MapSkeleton,
} from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import { useWebSocket } from "@/hooks/useWebSocket";
import { formatDate } from "@/lib/utils";
import type {
  Trip,
  Itinerary,
  TripHealth,
  WeatherData,
  ReplanEvent,
} from "@/types";
import Link from "next/link";
import {
  Calendar,
  MapPin,
  Users,
  Gauge,
  RefreshCw,
  Cloud,
  Activity,
  Settings2,
  Plane,
  ArrowRight,
  Route,
  Navigation,
} from "lucide-react";

export default function TripDetailPage() {
  const params = useParams();
  const tripId = params.id as string;

  const [trip, setTrip] = useState<Trip | null>(null);
  const [itinerary, setItinerary] = useState<Itinerary | null>(null);
  const [health, setHealth] = useState<TripHealth | null>(null);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [events, setEvents] = useState<ReplanEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState<number | undefined>();
  const [activeTab, setActiveTab] = useState<"itinerary" | "map" | "events">(
    "itinerary"
  );

  // WebSocket for real-time updates
  const { lastMessage, isConnected } = useWebSocket(tripId);

  // Load trip data
  useEffect(() => {
    if (!tripId) return;

    Promise.all([
      api.getTrip(tripId),
      api.getActiveItinerary(tripId).catch(() => null),
      api.getTripHealth(tripId).catch(() => null),
      api.getReplanEvents(tripId).catch(() => ({ results: [] })),
    ]).then(([tripData, itineraryData, healthData, eventsData]) => {
      setTrip(tripData);
      setItinerary(itineraryData);
      setHealth(healthData);
      setEvents(eventsData.results || []);
      setLoading(false);

      // Fetch weather for this city
      if (tripData.destination_city) {
        api.getWeather(tripData.destination_city).then(setWeather).catch(() => {});
      }
    });
  }, [tripId]);

  // Handle real-time messages
  useEffect(() => {
    if (!lastMessage) return;
    switch (lastMessage.type) {
      case "health_update":
        if (lastMessage.data) setHealth(lastMessage.data as unknown as TripHealth);
        break;
      case "weather_update":
        if (lastMessage.data) setWeather(lastMessage.data as unknown as WeatherData);
        break;
      case "itinerary_update":
        // Refetch itinerary
        api.getActiveItinerary(tripId).then(setItinerary).catch(() => {});
        break;
      case "replan_notification":
        api.getReplanEvents(tripId).then((r) => setEvents(r.results || [])).catch(() => {});
        break;
    }
  }, [lastMessage, tripId]);

  const handleToggleLock = useCallback(
    async (itemId: string) => {
      try {
        await api.toggleLockItem(itemId);
        // Refetch itinerary to get updated state
        const updated = await api.getActiveItinerary(tripId);
        setItinerary(updated);
      } catch {
        // Silent fail
      }
    },
    [tripId]
  );

  const handleReorder = useCallback(
    async (items: { item_id: string; day_number: number; order: number }[]) => {
      if (!itinerary) return;
      try {
        const updated = await api.reorderItems(itinerary.id, items);
        setItinerary(updated);
      } catch {
        // Silent fail
      }
    },
    [itinerary]
  );

  const dayGroups = itinerary?.day_groups || {};
  const allItems = itinerary?.items || [];
  const days = Object.keys(dayGroups)
    .map(Number)
    .sort((a, b) => a - b);

  if (loading) {
    return (
      <div className="min-h-screen">
        <Navbar />
        <main className="pt-24 pb-16 px-4">
          <div className="max-w-6xl mx-auto space-y-6">
            <CardSkeleton />
            <div className="grid lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <ItineraryCardSkeleton />
              </div>
              <div>
                <MapSkeleton />
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (!trip) {
    return (
      <div className="min-h-screen">
        <Navbar />
        <main className="pt-24 pb-16 px-4 flex items-center justify-center">
          <div className="text-center">
            <MapPin className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-foreground">Trip Not Found</h1>
            <p className="text-muted-foreground mt-2">
              This trip doesn&apos;t exist or has been removed.
            </p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Navbar />

      <main className="pt-24 pb-16 px-4">
        <div className="max-w-6xl mx-auto">
          {/* Trip Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-card p-6 sm:p-8 mb-8"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
                    {trip.destination_city}
                  </h1>
                  {isConnected && (
                    <span className="flex items-center gap-1 text-xs text-success">
                      <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
                      Live
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <MapPin className="h-4 w-4" />
                    {trip.destination_country}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Calendar className="h-4 w-4" />
                    {formatDate(trip.start_date)} – {formatDate(trip.end_date)}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Users className="h-4 w-4" />
                    {trip.group_size} traveler{trip.group_size > 1 ? "s" : ""}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Gauge className="h-4 w-4" />
                    {trip.pace}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3">
                {health && <StabilityBadge health={health} />}
                {weather && <WeatherOverlay weather={weather} compact />}
                {/* Customize Button */}
                <Link href="/dashboard">
                  <Button variant="outline" className="border-primary/30 hover:border-primary/50 hover:bg-primary/5 text-primary">
                    <Settings2 className="h-4 w-4 mr-1.5" />
                    Customize
                  </Button>
                </Link>
              </div>
            </div>

            {/* Travel Route Visualization */}
            {trip.departure_city && (
              <div className="mt-5 flex items-center gap-3 p-3 rounded-2xl bg-gradient-to-r from-primary/5 via-accent/5 to-primary/5 border border-primary/10">
                <div className="flex items-center gap-2">
                  <Navigation className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium text-foreground">{trip.departure_city}</span>
                </div>
                <div className="flex-1 flex items-center gap-1.5">
                  <div className="flex-1 h-px bg-gradient-to-r from-primary/50 to-accent/50" />
                  <div className="flex items-center gap-1">
                    <Plane className="h-4 w-4 text-accent -rotate-12" />
                    {trip.selected_travel_summary && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-accent/10 text-accent font-medium">
                        {trip.selected_travel_summary.provider_name} · {trip.selected_travel_summary.transport_type}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 h-px bg-gradient-to-r from-accent/50 to-primary/50" />
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-accent" />
                  <span className="text-sm font-medium text-foreground">{trip.destination_city}</span>
                </div>
              </div>
            )}

            {/* Budget bar */}
            <div className="mt-5">
              <BudgetProgress
                spent={trip.budget_spent_usd}
                total={trip.budget_usd}
              />
            </div>
          </motion.div>

          {/* Tab navigation */}
          <div className="flex items-center gap-1 mb-6 p-1 rounded-xl bg-muted/50 w-fit">
            {(
              [
                { key: "itinerary", label: "Itinerary", icon: Activity },
                { key: "map", label: "Map", icon: MapPin },
                { key: "events", label: "Events", icon: RefreshCw },
              ] as const
            ).map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  activeTab === tab.key
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <tab.icon className="h-4 w-4" />
                {tab.label}
                {tab.key === "events" && events.length > 0 && (
                  <span className="ml-1 h-5 w-5 rounded-full bg-warning/20 text-warning text-xs flex items-center justify-center">
                    {events.length}
                  </span>
                )}
              </button>
            ))}
          </div>

          <div className="grid lg:grid-cols-3 gap-8">
            {/* Main content */}
            <div className="lg:col-span-2">
              {activeTab === "itinerary" && (
                <>
                  {/* Day filter */}
                  {days.length > 1 && (
                    <div className="flex items-center gap-2 mb-6 overflow-x-auto scrollbar-hide pb-2">
                      <button
                        onClick={() => setSelectedDay(undefined)}
                        className={`px-4 py-1.5 rounded-full text-sm font-medium transition whitespace-nowrap ${
                          !selectedDay
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        All Days
                      </button>
                      {days.map((d) => (
                        <button
                          key={d}
                          onClick={() => setSelectedDay(d)}
                          className={`px-4 py-1.5 rounded-full text-sm font-medium transition whitespace-nowrap ${
                            selectedDay === d
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          Day {d}
                        </button>
                      ))}
                    </div>
                  )}

                  {allItems.length > 0 ? (
                    <ItineraryTimeline
                      items={allItems}
                      dayGroups={
                        selectedDay
                          ? { [selectedDay]: dayGroups[selectedDay.toString()] || [] }
                          : dayGroups
                      }
                      onToggleLock={handleToggleLock}
                      onReorder={handleReorder}
                    />
                  ) : (
                    <div className="glass-card p-12 text-center">
                      <Activity className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
                      <p className="font-medium text-foreground">
                        No itinerary items yet
                      </p>
                      <p className="text-sm text-muted-foreground mt-1">
                        The itinerary is being generated...
                      </p>
                    </div>
                  )}
                </>
              )}

              {activeTab === "map" && (
                <TripMap
                  items={allItems}
                  selectedDay={selectedDay}
                  className="min-h-[500px]"
                />
              )}

              {activeTab === "events" && (
                <ReplanEventsPanel events={events} />
              )}
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Health details */}
              {health && (
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="glass-card p-5"
                >
                  <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                    <Activity className="h-4 w-4 text-primary" />
                    Trip Health
                  </h3>
                  <StabilityBadge health={health} showDetails />
                </motion.div>
              )}

              {/* Weather */}
              {weather && (
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 }}
                >
                  <WeatherOverlay weather={weather} />
                </motion.div>
              )}

              {/* Trip stats */}
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 }}
                className="glass-card p-5"
              >
                <h3 className="font-semibold text-foreground mb-3">
                  Trip Stats
                </h3>
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Duration</span>
                    <span className="font-medium text-foreground">
                      {trip.duration_days} days
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Activities</span>
                    <span className="font-medium text-foreground">
                      {allItems.length}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">
                      Itinerary Version
                    </span>
                    <span className="font-medium text-foreground">
                      v{itinerary?.version || 1}
                    </span>
                  </div>
                  {itinerary?.total_score !== undefined && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">
                        Total AI Score
                      </span>
                      <span className="font-medium text-primary">
                        {itinerary.total_score.toFixed(1)}
                      </span>
                    </div>
                  )}
                  {itinerary?.generation_time_ms !== undefined && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">
                        Generated in
                      </span>
                      <span className="font-medium text-foreground">
                        {itinerary.generation_time_ms}ms
                      </span>
                    </div>
                  )}
                </div>
              </motion.div>

              {/* Interest breakdown */}
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 }}
                className="glass-card p-5"
              >
                <h3 className="font-semibold text-foreground mb-3">
                  Travel Profile
                </h3>
                <div className="space-y-2">
                  {[
                    { label: "Culture", value: trip.interest_culture },
                    { label: "Nature", value: trip.interest_nature },
                    { label: "Food", value: trip.interest_food },
                    { label: "Adventure", value: trip.interest_adventure },
                    { label: "Relaxation", value: trip.interest_relaxation },
                  ].map((interest) => (
                    <div key={interest.label} className="flex items-center gap-3">
                      <span className="text-sm w-28">{interest.label}</span>
                      <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full bg-foreground/70 transition-all"
                          style={{ width: `${interest.value * 100}%` }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground w-8 text-right">
                        {Math.round(interest.value * 100)}%
                      </span>
                    </div>
                  ))}
                </div>
              </motion.div>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
