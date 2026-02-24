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
import { AccommodationCard } from "@/components/trip/accommodation-card";
import { BookingInsightsPanel } from "@/components/trip/booking-insights";
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
  Accommodation,
  BookingInsights,
} from "@/types";
import Link from "next/link";
import { TripCustomizer } from "@/components/trip/trip-customizer";
import { TransportInfoCard } from "@/components/trip/transport-info";
import { DestinationRecommendations } from "@/components/trip/destination-recommendations";
import { TripNotes } from "@/components/trip/trip-notes";
import { TripChecklists } from "@/components/trip/trip-checklists";
import { TripExpenses } from "@/components/trip/trip-expenses";
import { TripPhotos } from "@/components/trip/trip-photos";
import { ShareDialog } from "@/components/trip/share-dialog";
import { useCurrency } from "@/contexts/currency-context";
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
  Train,
  Bus,
  ArrowRight,
  Route,
  Navigation,
  CalendarCheck,
  TrendingUp,
  StickyNote,
  DollarSign,
  ListChecks,
  Camera,
  Share2,
  FileDown,
  Eye,
} from "lucide-react";

export default function TripDetailPage() {
  const params = useParams();
  const tripId = params.id as string;

  const [trip, setTrip] = useState<Trip | null>(null);
  const [itinerary, setItinerary] = useState<Itinerary | null>(null);
  const [health, setHealth] = useState<TripHealth | null>(null);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [events, setEvents] = useState<ReplanEvent[]>([]);
  const [accommodation, setAccommodation] = useState<Accommodation[]>([]);
  const [bookingInsights, setBookingInsights] = useState<BookingInsights | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState<number | undefined>();
  const [activeTab, setActiveTab] = useState<"itinerary" | "map" | "recommendations" | "events" | "notes" | "budget" | "checklist" | "photos">(
    "itinerary"
  );
  const [isCustomizerOpen, setIsCustomizerOpen] = useState(false);
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [activeUsers, setActiveUsers] = useState<{ username: string; id: string }[]>([]);
  const [heroImage, setHeroImage] = useState<string | null>(null);
  const [activeItineraryItemId, setActiveItineraryItemId] = useState<string | null>(null);
  const { convertFromUsd, symbol } = useCurrency();

  // Determine if trip is happening today
  const today = new Date().toISOString().slice(0, 10);
  const isTripDay = trip ? trip.start_date <= today && trip.end_date >= today : false;
  const currentDayNumber = trip && isTripDay
    ? Math.ceil((new Date().getTime() - new Date(trip.start_date).getTime()) / 86400000) + 1
    : null;

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
      api.getAccommodation(tripId).catch(() => ({ results: [] })),
      api.getBookingInsights(tripId).catch(() => null),
    ]).then(([tripData, itineraryData, healthData, eventsData, accomData, insightsData]) => {
      setTrip(tripData);
      setItinerary(itineraryData);
      setHealth(healthData);
      setEvents(eventsData.results || []);
      setAccommodation(accomData.results || []);
      setBookingInsights(insightsData);
      setLoading(false);

      // Fetch weather for this city
      if (tripData.destination_city) {
        api.getWeather(tripData.destination_city).then(setWeather).catch(() => {});
        api
          .getUnsplashPhotos({ city: tripData.destination_city, count: 1 })
          .then((res) => {
            const first = res.photos?.[0];
            setHeroImage(first?.url_regular || first?.url_small || null);
          })
          .catch(() => setHeroImage(null));
      }
    });
  }, [tripId]);

  // Live weather polling — refresh every 3 minutes
  useEffect(() => {
    if (!trip?.destination_city) return;
    const interval = setInterval(() => {
      api.getWeather(trip.destination_city).then(setWeather).catch(() => {});
    }, 3 * 60 * 1000);
    return () => clearInterval(interval);
  }, [trip?.destination_city]);

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
      case "presence_update":
        if (lastMessage.data && Array.isArray((lastMessage.data as any).users)) {
          setActiveUsers((lastMessage.data as any).users);
        }
        break;
    }
  }, [lastMessage, tripId]);

  const handleToggleLock = useCallback(
    async (itemId: string) => {
      try {
        await api.toggleLockItem(itemId);
        const updated = await api.getActiveItinerary(tripId);
        setItinerary(updated);
      } catch {
        // Silent fail
      }
    },
    [tripId]
  );

  const handleStatusChange = useCallback(
    async (itemId: string, status: string) => {
      try {
        await api.updateItemStatus(itemId, status);
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
            className="glass-card relative overflow-hidden p-6 sm:p-8 mb-8"
          >
            {heroImage && (
              <>
                <img
                  src={heroImage}
                  alt={`${trip.destination_city} hero`}
                  className="absolute inset-0 h-full w-full object-cover opacity-20"
                />
                <div className="absolute inset-0 bg-gradient-to-br from-background/95 via-background/85 to-background/95" />
              </>
            )}

            <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
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
                {/* Collaboration presence avatars */}
                {activeUsers.length > 0 && (
                  <div className="flex items-center gap-1.5">
                    <div className="flex -space-x-2">
                      {activeUsers.slice(0, 4).map((u, i) => (
                        <div
                          key={u.id || i}
                          className="h-7 w-7 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-[10px] font-bold text-white border-2 border-background ring-2 ring-success/30"
                          title={u.username}
                        >
                          {u.username?.charAt(0).toUpperCase() || "?"}
                        </div>
                      ))}
                      {activeUsers.length > 4 && (
                        <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center text-[10px] font-medium text-muted-foreground border-2 border-background">
                          +{activeUsers.length - 4}
                        </div>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground hidden sm:inline">
                      {activeUsers.length} editing
                    </span>
                  </div>
                )}
                {health && <StabilityBadge health={health} />}
                {weather && <WeatherOverlay weather={weather} compact />}
                {/* PDF Export Button */}
                <Button
                  variant="outline"
                  className="border-accent/30 hover:border-accent/50 hover:bg-accent/5 text-accent"
                  onClick={() => {
                    const url = api.getTripPDFUrl(tripId);
                    window.open(url, "_blank");
                  }}
                >
                  <FileDown className="h-4 w-4 mr-1.5" />
                  <span className="hidden sm:inline">Export</span>
                </Button>
                {/* Customize Button */}
                <Button
                  variant="outline"
                  className="border-primary/30 hover:border-primary/50 hover:bg-primary/5 text-primary"
                  onClick={() => setIsCustomizerOpen(true)}
                >
                  <Settings2 className="h-4 w-4 mr-1.5" />
                  <span className="hidden sm:inline">Customize</span>
                </Button>
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
                    {(() => {
                      const type = trip.selected_travel_summary?.transport_type;
                      if (type === 'train') return <Train className="h-4 w-4 text-emerald-400" />;
                      if (type === 'bus') return <Bus className="h-4 w-4 text-amber-400" />;
                      return <Plane className="h-4 w-4 text-accent -rotate-12" />;
                    })()}
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
                spent={convertFromUsd(Number(trip.budget_spent_usd))}
                total={convertFromUsd(Number(trip.budget_usd))}
                currency={symbol}
              />
            </div>
          </motion.div>

          {/* Tab navigation */}
          <div className="flex items-center justify-between mb-6 gap-2">
            <div className="flex items-center gap-0.5 p-1 rounded-xl bg-muted border border-border/40 overflow-x-auto scrollbar-hide">
              {(
                [
                  { key: "itinerary", label: "Itinerary", icon: Activity },
                  { key: "map", label: "Map", icon: MapPin },
                  { key: "notes", label: "Notes", icon: StickyNote },
                  { key: "budget", label: "Budget", icon: DollarSign },
                  { key: "checklist", label: "Checklist", icon: ListChecks },
                  { key: "photos", label: "Photos", icon: Camera },
                  { key: "recommendations", label: "Insights", icon: TrendingUp },
                  { key: "events", label: "Events", icon: RefreshCw },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                    activeTab === tab.key
                      ? "bg-background text-foreground shadow-sm border border-border/60"
                      : "text-foreground/60 hover:text-foreground hover:bg-background/50"
                  }`}
                >
                  <tab.icon className="h-3.5 w-3.5 shrink-0" />
                  <span className="hidden md:inline">{tab.label}</span>
                  {tab.key === "events" && events.length > 0 && (
                    <span className="ml-0.5 h-4 w-4 rounded-full bg-amber-500 text-white text-[9px] flex items-center justify-center font-bold">
                      {events.length}
                    </span>
                  )}
                </button>
              ))}
            </div>
            <button
              onClick={() => setIsShareOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 ml-2 rounded-xl text-sm font-medium border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition shrink-0"
            >
              <Share2 className="h-4 w-4" />
              <span className="hidden sm:inline">Share</span>
            </button>
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
                    <div className="lg:grid lg:grid-cols-[1fr_380px] lg:gap-8">
                      {/* Timeline column */}
                      <div>
                        <ItineraryTimeline
                          items={allItems}
                          dayGroups={
                            selectedDay
                              ? { [selectedDay]: dayGroups[selectedDay.toString()] || [] }
                              : dayGroups
                          }
                          onToggleLock={handleToggleLock}
                          onReorder={handleReorder}
                          onStatusChange={handleStatusChange}
                          onActiveItemChange={(itemId) => setActiveItineraryItemId(itemId)}
                        />
                      </div>
                      {/* Sticky map column — desktop only */}
                      <div className="hidden lg:block">
                        <div className="sticky top-24 h-[calc(100vh-7rem)]">
                          <TripMap
                            items={allItems}
                            selectedDay={selectedDay}
                            activeItemId={activeItineraryItemId ?? undefined}
                            onDaySelect={setSelectedDay}
                            className="h-full rounded-2xl"
                          />
                        </div>
                      </div>
                    </div>
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
                  onDaySelect={setSelectedDay}
                  className="h-[600px]"
                />
              )}

              {activeTab === "recommendations" && (
                <DestinationRecommendations
                  city={trip.destination_city}
                  tripId={tripId}
                  tripDays={trip.duration_days}
                  tripBudgetUsd={Number(trip.budget_usd)}
                  onItineraryUpdate={(updated) => setItinerary(updated)}
                />
              )}

              {activeTab === "events" && (
                <ReplanEventsPanel events={events} />
              )}

              {activeTab === "notes" && (
                <TripNotes tripId={tripId} />
              )}

              {activeTab === "budget" && (
                <TripExpenses tripId={tripId} budgetUsd={Number(trip.budget_usd)} />
              )}

              {activeTab === "checklist" && (
                <TripChecklists tripId={tripId} />
              )}

              {activeTab === "photos" && (
                <TripPhotos tripId={tripId} />
              )}
            </div>

            {/* Sidebar – hidden on itinerary tab (full-width 2-col layout) */}
            {activeTab !== "itinerary" && (
            <div className="space-y-6">
              {/* Live Trip Day Banner */}
              {isTripDay && currentDayNumber && (
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="glass-card p-5 border-2 border-primary/30 bg-gradient-to-br from-primary/5 to-accent/5"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className="h-10 w-10 rounded-xl bg-primary/20 flex items-center justify-center">
                      <CalendarCheck className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-bold text-foreground">Today is Day {currentDayNumber}!</h3>
                      <p className="text-xs text-muted-foreground">Your trip is live — alter plans in real-time</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Button
                      variant="outline"
                      className="w-full border-primary/30 hover:border-primary/50 hover:bg-primary/5 text-primary"
                      onClick={() => {
                        setSelectedDay(currentDayNumber);
                        setActiveTab("itinerary");
                      }}
                    >
                      View Today&apos;s Plan
                    </Button>
                    <Button
                      className="w-full bg-gradient-to-r from-primary to-accent text-white"
                      onClick={() => setIsCustomizerOpen(true)}
                    >
                      <Settings2 className="h-4 w-4 mr-1.5" />
                      Alter Today&apos;s Plan
                    </Button>
                  </div>
                </motion.div>
              )}

              {/* Transport Details */}
              {trip.selected_travel_summary && (
                <TransportInfoCard
                  summary={trip.selected_travel_summary}
                  departureCity={trip.departure_city}
                  destinationCity={trip.destination_city}
                />
              )}

              {/* Accommodation */}
              {accommodation.length > 0 && (
                <AccommodationCard
                  accommodations={accommodation}
                  onSelect={(selected) => {
                    // Move selected accommodation to top and mark as recommended
                    setAccommodation((prev) =>
                      prev.map((a) => ({
                        ...a,
                        is_recommended: a.name === selected.name,
                      }))
                    );
                  }}
                />
              )}

              {/* Booking Insights */}
              {bookingInsights && (
                <BookingInsightsPanel insights={bookingInsights} />
              )}

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
            )}
          </div>
        </div>
      </main>

      {/* AI Customizer Panel */}
      {trip && (
        <TripCustomizer
          tripId={tripId}
          destination={trip.destination_city}
          items={allItems}
          isOpen={isCustomizerOpen}
          onClose={() => setIsCustomizerOpen(false)}
          onItineraryUpdate={(updatedItinerary) => {
            setItinerary(updatedItinerary);
          }}
        />
      )}

      {/* Share Dialog */}
      {trip && (
        <ShareDialog
          tripId={tripId}
          tripName={trip.destination_city}
          isOpen={isShareOpen}
          onClose={() => setIsShareOpen(false)}
        />
      )}

      <Footer />
    </div>
  );
}
