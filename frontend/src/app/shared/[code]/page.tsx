"use client";

import React, { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { motion } from "framer-motion";
import { api } from "@/lib/api";
import type { Trip, TripPhoto, TripNote, Itinerary } from "@/types";
import {
  MapPin,
  Calendar,
  Users,
  Clock,
  Camera,
  StickyNote,
  Plane,
  Loader2,
  ArrowRight,
  Globe,
} from "lucide-react";
import Link from "next/link";
import { formatDate } from "@/lib/utils";

interface SharedTripData {
  trip: Trip;
  itinerary: Itinerary | null;
  photos: TripPhoto[];
  notes: TripNote[];
  permission: string;
}

export default function SharedTripPage() {
  const params = useParams();
  const code = params.code as string;

  const [data, setData] = useState<SharedTripData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!code) return;
    api
      .getSharedTrip(code)
      .then((response) => {
        setData(response);
        setLoading(false);
      })
      .catch((err) => {
        setError("This shared trip link is invalid or has expired.");
        setLoading(false);
      });
  }, [code]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="text-center max-w-md">
          <Globe className="h-16 w-16 text-muted-foreground/30 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-foreground mb-2">Trip Not Found</h1>
          <p className="text-muted-foreground mb-6">
            {error || "This shared trip doesn't exist or has expired."}
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-primary text-primary-foreground rounded-xl font-medium hover:bg-primary/90 transition"
          >
            Go Home
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    );
  }

  const trip = data.trip;
  const itinerary = data.itinerary;
  const photos = data.photos || [];
  const notes = data.notes || [];
  const items = itinerary?.items || [];
  const dayGroups = itinerary?.day_groups || {};
  const days = Object.keys(dayGroups).map(Number).sort((a, b) => a - b);

  return (
    <div className="min-h-screen bg-background">
      {/* Simple header */}
      <header className="border-b border-border/50 bg-card/80 backdrop-blur-lg">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <img src="/logo.svg" alt="Endless Dreams" className="h-7 w-auto" />
            <span className="font-bold text-foreground">Endless Dreams</span>
          </Link>
          <span className="text-xs px-3 py-1 rounded-full bg-primary/10 text-primary font-medium">
            Shared Trip
          </span>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        {/* Trip header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card p-6 sm:p-8 mb-8"
        >
          <h1 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
            {trip.destination_city}
          </h1>
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
              <Clock className="h-4 w-4" />
              {trip.duration_days} days
            </span>
            <span className="flex items-center gap-1.5">
              <Users className="h-4 w-4" />
              {trip.group_size} traveler{trip.group_size > 1 ? "s" : ""}
            </span>
          </div>
        </motion.div>

        {/* Itinerary */}
        {days.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="space-y-6 mb-8"
          >
            <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
              <Plane className="h-5 w-5 text-primary" />
              Itinerary
            </h2>
            {days.map((day) => {
              const dayItems = dayGroups[day.toString()] || [];
              return (
                <div key={day} className="glass-card p-5">
                  <h3 className="font-semibold text-foreground mb-3">Day {day}</h3>
                  <div className="space-y-3">
                    {dayItems.map((item: any) => (
                      <div key={item.id} className="flex items-start gap-3 pl-4 border-l-2 border-primary/20">
                        <div className="flex-1">
                          <p className="font-medium text-foreground text-sm">
                            {item.place_name || item.custom_title || "Activity"}
                          </p>
                          {item.description && (
                            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                              {item.description}
                            </p>
                          )}
                          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                            {item.start_time && <span>{item.start_time}</span>}
                            {item.duration_minutes && <span>{item.duration_minutes} min</span>}
                          </div>
                        </div>
                      </div>
                    ))}
                    {dayItems.length === 0 && (
                      <p className="text-sm text-muted-foreground py-2">No activities for this day</p>
                    )}
                  </div>
                </div>
              );
            })}
          </motion.div>
        )}

        {/* Photos */}
        {photos.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mb-8"
          >
            <h2 className="text-xl font-bold text-foreground flex items-center gap-2 mb-4">
              <Camera className="h-5 w-5 text-primary" />
              Photos
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {photos.map((photo) => (
                <div key={photo.id} className="aspect-square rounded-xl overflow-hidden border border-border/50">
                  <img
                    src={photo.image_url}
                    alt={photo.caption || "Trip photo"}
                    className="w-full h-full object-cover"
                  />
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Notes */}
        {notes.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <h2 className="text-xl font-bold text-foreground flex items-center gap-2 mb-4">
              <StickyNote className="h-5 w-5 text-primary" />
              Notes
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {notes.map((note) => (
                <div
                  key={note.id}
                  className="glass-card p-4 rounded-xl"
                >
                  {note.title && (
                    <h4 className="font-medium text-foreground text-sm mb-1">{note.title}</h4>
                  )}
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {note.content}
                  </p>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="text-center py-12 mt-8"
        >
          <p className="text-muted-foreground mb-4">Want to plan your own trip?</p>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-xl font-medium hover:bg-primary/90 transition"
          >
            <Plane className="h-4 w-4" />
            Plan Your Dream Trip
          </Link>
        </motion.div>
      </main>
    </div>
  );
}
