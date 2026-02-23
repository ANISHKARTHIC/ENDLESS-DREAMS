"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
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
  Settings,
  Trash2,
  ArrowRight,
  Globe,
  Loader2,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export default function ProfilePage() {
  const [user, setUser] = useState<User | null>(null);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [savedPlaces, setSavedPlaces] = useState<SavedPlace[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"trips" | "saved">("trips");

  useEffect(() => {
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
    } catch {
      // silent
    }
  };

  const tripStats = {
    total: trips.length,
    active: trips.filter((t) => t.status === "active").length,
    completed: trips.filter((t) => t.status === "completed").length,
    countries: new Set(trips.map((t) => t.destination_country)).size,
  };

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
                      <img
                        src={user.avatar_url}
                        alt="Avatar"
                        className="h-full w-full rounded-2xl object-cover"
                      />
                    ) : (
                      <UserIcon className="h-7 w-7 text-primary" />
                    )}
                  </div>
                  <div className="flex-1">
                    <h1 className="text-2xl font-bold text-foreground">
                      {user?.first_name
                        ? `${user.first_name} ${user.last_name}`
                        : user?.username || "Traveler"}
                    </h1>
                    <p className="text-sm text-muted-foreground">
                      {user?.email || "Exploring the world"}
                    </p>
                  </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-4 gap-4 mt-6">
                  {[
                    { label: "Trips", value: tripStats.total, icon: Plane },
                    { label: "Active", value: tripStats.active, icon: Calendar },
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
                {[
                  { key: "trips" as const, label: "My Trips", icon: Plane },
                  { key: "saved" as const, label: "Saved Places", icon: Bookmark },
                ].map((tab) => (
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
                  </button>
                ))}
              </div>

              {/* Trips */}
              {activeTab === "trips" && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="space-y-3"
                >
                  {trips.length === 0 ? (
                    <div className="text-center py-12">
                      <Plane className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
                      <p className="font-medium text-foreground">No trips yet</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        Start planning your first adventure!
                      </p>
                      <Link
                        href="/dashboard"
                        className="inline-flex items-center gap-1.5 mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:bg-primary/90 transition"
                      >
                        Plan a Trip
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    </div>
                  ) : (
                    trips.map((trip, idx) => (
                      <motion.div
                        key={trip.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.05 }}
                      >
                        <Link
                          href={`/trip/${trip.id}`}
                          className="flex items-center gap-4 p-4 rounded-xl border border-border/50 hover:bg-muted/30 transition group"
                        >
                          <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                            <MapPin className="h-5 w-5 text-primary" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-foreground">
                              {trip.destination_city}, {trip.destination_country}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {trip.duration_days} days · {trip.start_date} to {trip.end_date}
                            </p>
                          </div>
                          <span
                            className={cn(
                              "px-2.5 py-1 rounded-full text-xs font-medium",
                              trip.status === "active"
                                ? "bg-emerald-500/10 text-emerald-500"
                                : trip.status === "completed"
                                ? "bg-blue-500/10 text-blue-500"
                                : "bg-muted text-muted-foreground"
                            )}
                          >
                            {trip.status}
                          </span>
                          <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition" />
                        </Link>
                      </motion.div>
                    ))
                  )}
                </motion.div>
              )}

              {/* Saved Places */}
              {activeTab === "saved" && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="space-y-3"
                >
                  {savedPlaces.length === 0 ? (
                    <div className="text-center py-12">
                      <Bookmark className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
                      <p className="font-medium text-foreground">No saved places</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        Save interesting places while exploring!
                      </p>
                      <Link
                        href="/explore"
                        className="inline-flex items-center gap-1.5 mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:bg-primary/90 transition"
                      >
                        Explore
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    </div>
                  ) : (
                    savedPlaces.map((place, idx) => (
                      <motion.div
                        key={place.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.05 }}
                        className="flex items-center gap-4 p-4 rounded-xl border border-border/50 hover:bg-muted/30 transition group"
                      >
                        {place.place_image ? (
                          <div className="h-12 w-12 rounded-xl overflow-hidden shrink-0">
                            <img
                              src={place.place_image}
                              alt={place.place_name}
                              className="h-full w-full object-cover"
                            />
                          </div>
                        ) : (
                          <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                            <MapPin className="h-5 w-5 text-primary" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-foreground">{place.place_name}</p>
                          <p className="text-sm text-muted-foreground">
                            {place.place_city} · {place.place_category}
                          </p>
                        </div>
                        {place.place_rating > 0 && (
                          <span className="text-sm text-amber-500 font-medium">
                            ★ {place.place_rating.toFixed(1)}
                          </span>
                        )}
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            handleRemoveSaved(place.id);
                          }}
                          className="p-2 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-red-500/10 text-muted-foreground hover:text-red-500 transition"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </motion.div>
                    ))
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
