"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { api } from "@/lib/api";
import type { User, Trip, SavedPlace } from "@/types";
import {
  User as UserIcon,
  MapPin,
  Plane,
  Bookmark,
  Calendar,
  Trash2,
  ArrowRight,
  Globe,
  Loader2,
  Sparkles,
  CheckCircle2,
  Circle,
  Star,
  Clock,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface SavedItinerary {
  id: string;
  destination_city: string;
  destination_country: string;
  start_date: string;
  end_date: string;
  duration_days: number;
  savedAt: string;
}

export default function ProfilePage() {
  const [user, setUser] = useState<User | null>(null);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [savedPlaces, setSavedPlaces] = useState<SavedPlace[]>([]);
  const [savedItineraries, setSavedItineraries] = useState<SavedItinerary[]>([]);
  const [checkedDreams, setCheckedDreams] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"trips" | "saved" | "dreams">("trips");

  useEffect(() => {
    // Load saved itineraries from localStorage
    const raw = localStorage.getItem("savedItineraries");
    if (raw) {
      try { setSavedItineraries(JSON.parse(raw)); } catch { /* ignore */ }
    }
    const checkedRaw = localStorage.getItem("checkedDreams");
    if (checkedRaw) {
      try { setCheckedDreams(JSON.parse(checkedRaw)); } catch { /* ignore */ }
    }

    const fetchData = async () => {
      try {
        const [profileData, tripsData, savedData] = await Promise.all([
          api.getProfile().catch(() => null),
          api.getTrips().catch(() => ({ results: [] })),
          api.getSavedPlaces().catch(() => []),
        ]);
        setUser(profileData);
        setTrips(tripsData.results || []);
        const places = Array.isArray(savedData) ? savedData : (savedData as any).results || [];
        setSavedPlaces(places);
      } catch {
        // silent
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleRemoveSaved = async (id: string) => {
    try {
      await api.removeSavedPlace(id);
      setSavedPlaces((prev) => prev.filter((p) => p.id !== id));
    } catch { /* silent */ }
  };

  const handleRemoveDream = (id: string) => {
    const updated = savedItineraries.filter((s) => s.id !== id);
    setSavedItineraries(updated);
    localStorage.setItem("savedItineraries", JSON.stringify(updated));
    const checked = { ...checkedDreams };
    delete checked[id];
    setCheckedDreams(checked);
    localStorage.setItem("checkedDreams", JSON.stringify(checked));
  };

  const handleToggleCheck = (id: string) => {
    const updated = { ...checkedDreams, [id]: !checkedDreams[id] };
    setCheckedDreams(updated);
    localStorage.setItem("checkedDreams", JSON.stringify(updated));
  };

  const tripStats = {
    total: trips.length,
    active: trips.filter((t) => t.status === "active").length,
    completed: trips.filter((t) => t.status === "completed").length,
    countries: new Set(trips.map((t) => t.destination_country)).size,
  };

  const TABS = [
    { key: "trips" as const,   label: "My Trips",          icon: Plane },
    { key: "saved" as const,   label: "Saved Places",       icon: Bookmark },
    { key: "dreams" as const,  label: "My Dreams",          icon: Sparkles, count: savedItineraries.length },
  ];

  return (
    <div className="min-h-screen">
      <Navbar />

      <main className="pt-24 pb-16 px-4">
        <div className="max-w-4xl mx-auto">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <>
              {/* Profile header */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="glass-card p-6 sm:p-8 mb-8"
              >
                <div className="flex items-center gap-5">
                  <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center border border-primary/10">
                    {user?.avatar_url ? (
                      <img src={user.avatar_url} alt="Avatar" className="h-full w-full rounded-2xl object-cover" />
                    ) : (
                      <UserIcon className="h-7 w-7 text-primary" />
                    )}
                  </div>
                  <div className="flex-1">
                    <h1 className="text-2xl font-bold text-foreground">
                      {user?.first_name ? `${user.first_name} ${user.last_name}` : user?.username || "Traveler"}
                    </h1>
                    <p className="text-sm text-muted-foreground">{user?.email || "Exploring the world"}</p>
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-4 mt-6">
                  {[
                    { label: "Trips",     value: tripStats.total,     icon: Plane },
                    { label: "Active",    value: tripStats.active,    icon: Calendar },
                    { label: "Completed", value: tripStats.completed, icon: MapPin },
                    { label: "Countries", value: tripStats.countries, icon: Globe },
                  ].map((stat) => (
                    <div key={stat.label} className="text-center p-3 rounded-xl bg-muted/30">
                      <stat.icon className="h-4 w-4 mx-auto text-primary mb-1" />
                      <p className="text-xl font-bold text-foreground">{stat.value}</p>
                      <p className="text-xs text-muted-foreground">{stat.label}</p>
                    </div>
                  ))}
                </div>
              </motion.div>

              {/* Tab nav */}
              <div className="flex items-center gap-1 p-1 rounded-xl bg-muted/50 w-fit mb-6">
                {TABS.map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={cn(
                      "flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all",
                      activeTab === tab.key
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <tab.icon className="h-4 w-4" />
                    {tab.label}
                    {(tab as any).count > 0 && (
                      <span className="ml-0.5 h-4.5 min-w-[1.1rem] px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center">
                        {(tab as any).count}
                      </span>
                    )}
                  </button>
                ))}
              </div>

              {/* ── My Trips ── */}
              {activeTab === "trips" && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
                  {trips.length === 0 ? (
                    <div className="text-center py-12">
                      <Plane className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
                      <p className="font-medium text-foreground">No trips yet</p>
                      <p className="text-sm text-muted-foreground mt-1">Start planning your first adventure!</p>
                      <Link href="/dashboard" className="inline-flex items-center gap-1.5 mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:bg-primary/90 transition">
                        Plan a Trip <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    </div>
                  ) : (
                    trips.map((trip, idx) => (
                      <motion.div key={trip.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.05 }}>
                        <Link href={`/trip/${trip.id}`} className="flex items-center gap-4 p-4 rounded-xl border border-border/50 hover:bg-muted/30 transition group">
                          <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                            <MapPin className="h-5 w-5 text-primary" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-foreground">{trip.destination_city}, {trip.destination_country}</p>
                            <p className="text-sm text-muted-foreground">{trip.duration_days} days · {trip.start_date} to {trip.end_date}</p>
                          </div>
                          <span className={cn("px-2.5 py-1 rounded-full text-xs font-medium",
                            trip.status === "active" ? "bg-emerald-500/10 text-emerald-500"
                            : trip.status === "completed" ? "bg-blue-500/10 text-blue-500"
                            : "bg-muted text-muted-foreground")}>
                            {trip.status}
                          </span>
                          <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition" />
                        </Link>
                      </motion.div>
                    ))
                  )}
                </motion.div>
              )}

              {/* ── Saved Places ── */}
              {activeTab === "saved" && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
                  {savedPlaces.length === 0 ? (
                    <div className="text-center py-12">
                      <Bookmark className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
                      <p className="font-medium text-foreground">No saved places</p>
                      <p className="text-sm text-muted-foreground mt-1">Save interesting places while exploring!</p>
                      <Link href="/explore" className="inline-flex items-center gap-1.5 mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:bg-primary/90 transition">
                        Explore <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    </div>
                  ) : (
                    savedPlaces.map((place, idx) => (
                      <motion.div key={place.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.05 }}
                        className="flex items-center gap-4 p-4 rounded-xl border border-border/50 hover:bg-muted/30 transition group">
                        {place.place_image ? (
                          <div className="h-12 w-12 rounded-xl overflow-hidden shrink-0">
                            <img src={place.place_image} alt={place.place_name} className="h-full w-full object-cover" />
                          </div>
                        ) : (
                          <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                            <MapPin className="h-5 w-5 text-primary" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-foreground">{place.place_name}</p>
                          <p className="text-sm text-muted-foreground">{place.place_city} · {place.place_category}</p>
                        </div>
                        {place.place_rating > 0 && (
                          <span className="text-sm text-amber-500 font-medium">★ {place.place_rating.toFixed(1)}</span>
                        )}
                        <button onClick={(e) => { e.preventDefault(); handleRemoveSaved(place.id); }}
                          className="p-2 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-red-500/10 text-muted-foreground hover:text-red-500 transition">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </motion.div>
                    ))
                  )}
                </motion.div>
              )}

              {/* ── My Dreams ── */}
              {activeTab === "dreams" && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  {savedItineraries.length === 0 ? (
                    <div className="text-center py-16">
                      <div className="relative w-16 h-16 mx-auto mb-5">
                        <div className="absolute inset-0 rounded-full bg-gradient-to-br from-primary/20 to-violet-500/20 animate-pulse" />
                        <div className="relative h-full w-full rounded-full bg-gradient-to-br from-primary/10 to-violet-500/10 flex items-center justify-center">
                          <Sparkles className="h-7 w-7 text-primary" />
                        </div>
                      </div>
                      <p className="font-semibold text-lg text-foreground">No saved dreams yet</p>
                      <p className="text-sm text-muted-foreground mt-1 mb-5">
                        Open any trip and hit the <span className="font-semibold text-primary">Save</span> button to add it here.
                      </p>
                      <Link href="/dashboard" className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-semibold hover:bg-primary/90 transition">
                        <Sparkles className="h-4 w-4" />
                        Plan a Dream Trip
                      </Link>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {/* header */}
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-sm text-muted-foreground">
                          <span className="font-semibold text-foreground">{savedItineraries.filter(s => checkedDreams[s.id]).length}</span>
                          {" "}of{" "}
                          <span className="font-semibold text-foreground">{savedItineraries.length}</span>
                          {" "}dreams checked off
                        </p>
                        {/* Mini progress bar */}
                        <div className="flex-1 max-w-[140px] ml-4 h-1.5 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-primary to-violet-500 transition-all duration-500"
                            style={{ width: `${savedItineraries.length ? (savedItineraries.filter(s => checkedDreams[s.id]).length / savedItineraries.length) * 100 : 0}%` }}
                          />
                        </div>
                      </div>

                      <AnimatePresence>
                        {savedItineraries.map((dream, idx) => {
                          const isDone = checkedDreams[dream.id] || false;
                          return (
                            <motion.div
                              key={dream.id}
                              initial={{ opacity: 0, y: 12 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, x: -40 }}
                              transition={{ delay: idx * 0.04 }}
                              className={cn(
                                "relative p-4 rounded-2xl border transition-all duration-300 group",
                                isDone
                                  ? "border-emerald-500/30 bg-emerald-500/5"
                                  : "border-border/50 bg-card hover:border-primary/30 hover:shadow-md hover:shadow-primary/5"
                              )}
                            >
                              <div className="flex items-start gap-3">
                                {/* Checkbox */}
                                <button
                                  onClick={() => handleToggleCheck(dream.id)}
                                  className="mt-0.5 shrink-0 transition-transform hover:scale-110"
                                  title={isDone ? "Mark as not done" : "Mark as done"}
                                >
                                  {isDone ? (
                                    <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                                  ) : (
                                    <Circle className="h-5 w-5 text-muted-foreground/40 hover:text-primary" />
                                  )}
                                </button>

                                {/* Content */}
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-start justify-between gap-2 flex-wrap">
                                    <div>
                                      <h3 className={cn("font-bold text-base leading-tight", isDone && "line-through text-muted-foreground")}>
                                        {dream.destination_city}
                                        <span className="text-muted-foreground font-normal">, {dream.destination_country}</span>
                                      </h3>
                                      <div className="flex items-center gap-3 mt-1 flex-wrap">
                                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                          <Calendar className="h-3 w-3" />
                                          {dream.start_date} → {dream.end_date}
                                        </span>
                                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                          <Clock className="h-3 w-3" />
                                          {dream.duration_days} day{dream.duration_days !== 1 ? "s" : ""}
                                        </span>
                                      </div>
                                      {isDone && (
                                        <span className="inline-flex items-center gap-1 mt-1.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                                          <Star className="h-3 w-3 fill-emerald-500 text-emerald-500" />
                                          Dream achieved!
                                        </span>
                                      )}
                                    </div>

                                    {/* Remove button */}
                                    <button
                                      onClick={() => handleRemoveDream(dream.id)}
                                      className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-red-500/10 text-muted-foreground/40 hover:text-red-500 transition shrink-0"
                                      title="Remove dream"
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                  </div>

                                  {/* CTA */}
                                  <Link
                                    href={`/trip/${dream.id}`}
                                    className={cn(
                                      "inline-flex items-center gap-2 mt-3 px-4 py-2 rounded-xl text-sm font-bold transition-all duration-200",
                                      isDone
                                        ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/25"
                                        : "bg-gradient-to-r from-primary to-violet-600 text-white hover:shadow-lg hover:shadow-primary/30 hover:scale-[1.02] active:scale-100"
                                    )}
                                  >
                                    <Sparkles className="h-3.5 w-3.5" />
                                    {isDone ? "Relive the Dream" : "Let the Dream Come True"}
                                    <ArrowRight className="h-3.5 w-3.5" />
                                  </Link>
                                </div>
                              </div>
                            </motion.div>
                          );
                        })}
                      </AnimatePresence>
                    </div>
                  )}
                </motion.div>
              )}
            </>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}