"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Navbar } from "@/components/layout/navbar";
import { api } from "@/lib/api";
import { cn, formatDate, formatTime } from "@/lib/utils";
import { CategoryIcon } from "@/components/ui/category-icon";
import { useCurrency } from "@/contexts/currency-context";
import type { Trip, Itinerary, ItineraryItem } from "@/types";
import {
  Sparkles, MapPin, Calendar, Clock, Plane, Train, Bus,
  ChevronLeft, CheckCircle2, Circle, AlertTriangle,
  Star, Zap, Navigation, ArrowRight, ArrowDown, Play, Pause,
  RefreshCw, Timer, TrendingUp, Flag, Home, Users,
  Coffee, Loader2, ChevronDown, ChevronUp, Bell, X,
} from "lucide-react";

interface SavedItinerary {
  id: string;
  destination_city: string;
  destination_country: string;
  start_date: string;
  end_date: string;
  duration_days: number;
  savedAt: string;
}

// Add minutes to a HH:MM string
function addMinutesToTime(time: string, mins: number): string {
  const [h, m] = time.split(":").map(Number);
  const total = h * 60 + m + mins;
  const nh = Math.floor(total / 60) % 24;
  const nm = total % 60;
  return `${String(nh).padStart(2, "0")}:${String(nm).padStart(2, "0")}`;
}

// Compare HH:MM times → minutes since midnight
function timeToMins(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

// Current time as HH:MM
function nowHHMM(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

const DAY_PALETTES = [
  { from: "#3b82f6", to: "#6366f1", light: "#eff6ff" },
  { from: "#8b5cf6", to: "#ec4899", light: "#f5f3ff" },
  { from: "#f59e0b", to: "#f97316", light: "#fffbeb" },
  { from: "#10b981", to: "#06b6d4", light: "#ecfdf5" },
  { from: "#ef4444", to: "#f43f5e", light: "#fef2f2" },
  { from: "#84cc16", to: "#22c55e", light: "#f7fee7" },
];

const TRANSPORT_ICONS: Record<string, React.ReactNode> = {
  flight: <Plane className="h-5 w-5" />,
  train:  <Train className="h-5 w-5" />,
  bus:    <Bus   className="h-5 w-5" />,
};

export default function DreamDetailPage() {
  const params  = useParams();
  const router  = useRouter();
  const tripId  = params.id as string;
  const { convertFromUsd, symbol } = useCurrency();

  // ── Data ──
  const [trip,          setTrip]      = useState<Trip | null>(null);
  const [itinerary,     setItinerary] = useState<Itinerary | null>(null);
  const [dream,         setDream]     = useState<SavedItinerary | null>(null);
  const [heroImage,     setHeroImage] = useState<string | null>(null);
  const [loading,       setLoading]   = useState(true);

  // ── Tracking ──
  const [trackingActive, setTrackingActive]   = useState(false);
  const [items,          setItems]            = useState<ItineraryItem[]>([]);
  const [nowTime,        setNowTime]          = useState(nowHHMM());
  const [delayAlert,     setDelayAlert]       = useState<{ item: ItineraryItem; minsLate: number } | null>(null);
  const [expandedDays,   setExpandedDays]     = useState<Record<number, boolean>>({});
  const [rescheduled,    setRescheduled]      = useState(false);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Today's day number in the trip ──
  const todayDayNum: number | null = (() => {
    if (!trip) return null;
    const today = new Date().toISOString().slice(0, 10);
    if (today < trip.start_date || today > trip.end_date) return null;
    return Math.ceil(
      (new Date(today).getTime() - new Date(trip.start_date).getTime()) / 86400000
    ) + 1;
  })();

  // ── Load data ──
  useEffect(() => {
    const raw = localStorage.getItem("savedItineraries");
    if (raw) {
      try {
        const arr: SavedItinerary[] = JSON.parse(raw);
        const found = arr.find((s) => s.id === tripId);
        if (found) setDream(found);
      } catch { /* ignore */ }
    }

    (async () => {
      try {
        const [t, iti] = await Promise.all([
          api.getTrip(tripId),
          api.getActiveItinerary(tripId),
        ]);
        setTrip(t);
        setItinerary(iti);
        setItems([...(iti.items || [])]);

        // Hero image from Unsplash
        api.getUnsplashPhotos({ city: t.destination_city, count: 1 })
          .then((r) => { const f = r.photos?.[0]; if (f) setHeroImage(f.url_regular || f.url_small || null); })
          .catch(() => {});

        // Auto-expand today's day
        const today = new Date().toISOString().slice(0, 10);
        if (today >= t.start_date && today <= t.end_date) {
          const dn = Math.ceil((new Date(today).getTime() - new Date(t.start_date).getTime()) / 86400000) + 1;
          setExpandedDays({ [dn]: true });
        } else {
          setExpandedDays({ 1: true });
        }
      } catch { /* silent */ }
      finally { setLoading(false); }
    })();
  }, [tripId]);

  // ── Clock tick ──
  useEffect(() => {
    if (!trackingActive) { if (tickRef.current) clearInterval(tickRef.current); return; }
    tickRef.current = setInterval(() => {
      const now = nowHHMM();
      setNowTime(now);
      autoCheckItems(now);
    }, 30_000); // every 30s
    return () => { if (tickRef.current) clearInterval(tickRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trackingActive, items]);

  const autoCheckItems = useCallback((now: string) => {
    const nowM = timeToMins(now);
    setItems((prev) => {
      let changed = false;
      const next = prev.map((it) => {
        if (it.day_number !== todayDayNum) return it;
        if (it.status === "completed" || it.status === "skipped") return it;
        const endM = timeToMins(it.end_time);
        if (nowM > endM + 5) {
          changed = true;
          return { ...it, status: "completed" as const };
        }
        // Overrun detection: active item whose end_time is more than 10 min past
        const startM = timeToMins(it.start_time);
        if (nowM >= startM && nowM > endM + 10) {
          setDelayAlert({ item: it as ItineraryItem, minsLate: nowM - endM });
        }
        return it;
      });
      return changed ? next : prev;
    });
  }, [todayDayNum]);

  // ── Reschedule remaining items ──
  const handleReschedule = (delayMins: number) => {
    setItems((prev) => {
      const nowM = timeToMins(nowTime);
      let pushing = false;
      return prev.map((it) => {
        if (it.day_number !== todayDayNum) return it;
        if (it.status === "completed" || it.status === "skipped") return it;
        if (timeToMins(it.start_time) >= nowM) pushing = true;
        if (!pushing) return it;
        return {
          ...it,
          start_time: addMinutesToTime(it.start_time, delayMins),
          end_time:   addMinutesToTime(it.end_time,   delayMins),
          status: "replanned" as const,
        };
      });
    });
    setDelayAlert(null);
    setRescheduled(true);
    setTimeout(() => setRescheduled(false), 3000);
  };

  // ── Manual status toggle ──
  const cycleStatus = (itemId: string) => {
    setItems((prev) => prev.map((it) => {
      if (it.id !== itemId) return it;
      const next: Record<string, ItineraryItem["status"]> = {
        scheduled: "in_progress", in_progress: "completed",
        completed: "scheduled",  skipped: "scheduled", replanned: "in_progress",
      };
      return { ...it, status: next[it.status] || "scheduled" };
    }));
    // Persist to backend silently
    const item = items.find((i) => i.id === itemId);
    if (item) {
      const nextStatus: Record<string, string> = {
        scheduled: "in_progress", in_progress: "completed",
        completed: "scheduled",  skipped: "scheduled", replanned: "in_progress",
      };
      api.updateItemStatus(itemId, nextStatus[item.status] || "scheduled").catch(() => {});
    }
  };

  // ── Day groups ──
  const dayGroups: Record<number, ItineraryItem[]> = {};
  items.forEach((it) => {
    (dayGroups[it.day_number] ??= []).push(it);
  });
  const days = Object.keys(dayGroups).map(Number).sort((a, b) => a - b);

  // ── Stats ──
  const totalCost    = items.reduce((s, i) => s + Number(i.estimated_cost_usd), 0);
  const completedCnt = items.filter(i => i.status === "completed").length;
  const totalCnt     = items.length;

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto mb-3" />
        <p className="text-muted-foreground text-sm">Loading your dream...</p>
      </div>
    </div>
  );

  if (!trip) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <p className="text-xl font-bold mb-2">Dream not found</p>
        <Link href="/profile" className="text-primary hover:underline text-sm">← Back to Profile</Link>
      </div>
    </div>
  );

  const transport = trip.selected_travel_summary;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* ══ HERO ══ */}
      <div className="relative h-[55vh] min-h-[380px] overflow-hidden">
        {heroImage ? (
          <img src={heroImage} alt={trip.destination_city} className="h-full w-full object-cover" />
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-primary/80 via-violet-600 to-pink-600" />
        )}
        {/* Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-black/20" />

        {/* Back */}
        <button
          onClick={() => router.back()}
          className="absolute top-20 left-6 flex items-center gap-2 px-4 py-2 rounded-full bg-black/30 backdrop-blur-md text-white text-sm font-medium hover:bg-black/50 transition"
        >
          <ChevronLeft className="h-4 w-4" /> Back
        </button>

        {/* Hero text */}
        <div className="absolute bottom-0 left-0 right-0 p-6 sm:p-10">
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-3 py-1 rounded-full bg-primary/90 text-white text-xs font-bold uppercase tracking-widest backdrop-blur-sm">
                Dream Itinerary
              </span>
              {trackingActive && (
                <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/90 text-white text-xs font-bold animate-pulse">
                  <div className="h-1.5 w-1.5 rounded-full bg-white" /> LIVE TRACKING
                </span>
              )}
            </div>
            <h1 className="text-4xl sm:text-5xl font-black text-white drop-shadow-lg tracking-tight">
              {trip.destination_city}
              <span className="text-white/60 font-light">, {trip.destination_country}</span>
            </h1>
            <div className="flex items-center gap-4 mt-3 flex-wrap">
              <span className="flex items-center gap-1.5 text-white/80 text-sm">
                <Calendar className="h-4 w-4" /> {formatDate(trip.start_date)} → {formatDate(trip.end_date)}
              </span>
              <span className="flex items-center gap-1.5 text-white/80 text-sm">
                <Clock className="h-4 w-4" /> {trip.duration_days} days
              </span>
              <span className="flex items-center gap-1.5 text-white/80 text-sm">
                <Users className="h-4 w-4" /> {trip.group_size} {trip.group_size === 1 ? "person" : "people"}
              </span>
            </div>
          </motion.div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 pb-24">

        {/* ══ STAT PILLS ══ */}
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
          className="flex flex-wrap gap-3 -mt-5 relative z-10 mb-8"
        >
          {[
            { icon: <TrendingUp className="h-4 w-4" />, label: "Budget",    value: `${symbol}${Math.round(convertFromUsd(Number(trip.budget_usd))).toLocaleString()}`,  color: "bg-blue-500/15 text-blue-600 dark:text-blue-400" },
            { icon: <MapPin className="h-4 w-4" />,      label: "Activities", value: `${totalCnt} stops`,           color: "bg-violet-500/15 text-violet-600 dark:text-violet-400" },
            { icon: <Zap className="h-4 w-4" />,          label: "Est. Cost",  value: `${symbol}${Math.round(convertFromUsd(totalCost)).toLocaleString()}`, color: "bg-amber-500/15 text-amber-600 dark:text-amber-400" },
            { icon: <Flag className="h-4 w-4" />,         label: "Pace",       value: trip.pace,                    color: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" },
          ].map((s) => (
            <div key={s.label} className={cn("flex items-center gap-2 px-4 py-2.5 rounded-2xl font-semibold text-sm backdrop-blur-sm border border-white/10 shadow-sm", s.color)}>
              {s.icon}
              <span className="text-muted-foreground/60 text-xs mr-0.5">{s.label}</span>
              <span className="capitalize">{s.value}</span>
            </div>
          ))}
        </motion.div>

        {/* ══ JOURNEY FLOW ══ */}
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          className="glass-card p-5 mb-8 rounded-2xl"
        >
          <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-widest mb-5">Journey Overview</h2>
          <div className="flex items-center gap-0 overflow-x-auto scrollbar-hide pb-2">
            {/* Origin */}
            <div className="flex flex-col items-center shrink-0 min-w-[90px]">
              <div className="h-10 w-10 rounded-full bg-primary/15 border-2 border-primary flex items-center justify-center mb-1.5">
                <Home className="h-4 w-4 text-primary" />
              </div>
              <p className="text-xs font-bold text-center leading-tight">{trip.departure_city || "Origin"}</p>
              <p className="text-[10px] text-muted-foreground">{formatDate(trip.start_date)}</p>
            </div>

            {/* Transport leg */}
            {transport && (
              <>
                <div className="flex-1 flex flex-col items-center min-w-[80px] px-2">
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted/60 border border-border/40 text-xs font-semibold text-foreground/80">
                    {TRANSPORT_ICONS[transport.transport_type] || <Plane className="h-4 w-4" />}
                    {transport.provider_name}
                  </div>
                  <div className="h-px w-full bg-border/40 mt-2 relative">
                    <ArrowRight className="h-3 w-3 text-muted-foreground absolute -right-1 -top-1.5" />
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {Math.floor(transport.duration_minutes / 60)}h {transport.duration_minutes % 60}m
                  </p>
                </div>
              </>
            )}
            {!transport && (
              <div className="flex-1 flex flex-col items-center px-2">
                <div className="h-px w-full bg-gradient-to-r from-primary/40 to-violet-500/40 relative mt-5">
                  <ArrowRight className="h-3 w-3 text-primary absolute right-0 -top-1.5" />
                </div>
              </div>
            )}

            {/* Destination */}
            <div className="flex flex-col items-center shrink-0 min-w-[90px]">
              <div className="h-10 w-10 rounded-full bg-gradient-to-br from-primary to-violet-600 border-2 border-primary flex items-center justify-center mb-1.5 shadow-md shadow-primary/30">
                <MapPin className="h-4 w-4 text-white" />
              </div>
              <p className="text-xs font-bold text-center leading-tight">{trip.destination_city}</p>
              <p className="text-[10px] text-muted-foreground">{trip.duration_days} days</p>
            </div>

            {/* Days dots */}
            {days.map((d, i) => (
              <React.Fragment key={d}>
                <div className="flex flex-col items-center px-2">
                  <div className="h-px w-10 bg-border/40" style={{ background: DAY_PALETTES[i % DAY_PALETTES.length].from }} />
                </div>
                <div className="flex flex-col items-center shrink-0">
                  <div
                    className="h-8 w-8 rounded-full flex items-center justify-center text-white text-[10px] font-black mb-1"
                    style={{ background: `linear-gradient(135deg,${DAY_PALETTES[i % DAY_PALETTES.length].from},${DAY_PALETTES[i % DAY_PALETTES.length].to})` }}
                  >D{d}</div>
                  <p className="text-[10px] text-muted-foreground">{(dayGroups[d] || []).length} stops</p>
                </div>
              </React.Fragment>
            ))}

            {/* Connector to return */}
            <div className="flex-1 flex flex-col items-center px-2">
              <div className="h-px w-full bg-border/40 mt-5" />
            </div>

            {/* Return */}
            <div className="flex flex-col items-center shrink-0 min-w-[90px]">
              <div className="h-10 w-10 rounded-full bg-emerald-500/15 border-2 border-emerald-500 flex items-center justify-center mb-1.5">
                <Home className="h-4 w-4 text-emerald-500" />
              </div>
              <p className="text-xs font-bold text-center leading-tight">{trip.departure_city || "Return"}</p>
              <p className="text-[10px] text-muted-foreground">{formatDate(trip.end_date)}</p>
            </div>
          </div>
        </motion.div>

        {/* ══ TRACKING PROGRESS BAR ══ */}
        {trackingActive && (
          <motion.div
            initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
            className="glass-card p-4 mb-6 rounded-2xl border border-emerald-500/30 bg-emerald-500/5"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">Live Tracking Active</span>
                <span className="text-xs text-muted-foreground">· Now {nowTime}</span>
              </div>
              <span className="text-sm font-bold text-foreground">{completedCnt}/{totalCnt} done</span>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-500"
                initial={{ width: 0 }}
                animate={{ width: `${totalCnt ? (completedCnt / totalCnt) * 100 : 0}%` }}
                transition={{ duration: 0.5 }}
              />
            </div>
            {rescheduled && (
              <p className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold mt-1.5 flex items-center gap-1">
                <RefreshCw className="h-3 w-3" /> Itinerary rescheduled!
              </p>
            )}
          </motion.div>
        )}

        {/* ══ DELAY ALERT ══ */}
        <AnimatePresence>
          {delayAlert && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}
              className="glass-card p-4 mb-6 rounded-2xl border border-amber-500/50 bg-amber-500/10"
            >
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-bold text-amber-700 dark:text-amber-400 text-sm">Running Late!</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    You are <strong className="text-amber-600">{delayAlert.minsLate} minutes</strong> behind schedule at{" "}
                    <strong>{delayAlert.item.place.name}</strong>. Reschedule remaining activities?
                  </p>
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={() => handleReschedule(delayAlert.minsLate)}
                      className="px-3 py-1.5 rounded-lg bg-amber-500 text-white text-xs font-bold hover:bg-amber-600 transition flex items-center gap-1.5"
                    >
                      <RefreshCw className="h-3 w-3" /> Reschedule +{delayAlert.minsLate}min
                    </button>
                    <button onClick={() => setDelayAlert(null)} className="px-3 py-1.5 rounded-lg bg-muted text-muted-foreground text-xs hover:bg-muted/80 transition">
                      Ignore
                    </button>
                  </div>
                </div>
                <button onClick={() => setDelayAlert(null)} className="text-muted-foreground/40 hover:text-muted-foreground">
                  <X className="h-4 w-4" />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ══ DAY-BY-DAY ITINERARY ══ */}
        <div className="space-y-5 mb-10">
          {days.map((dayNum, dayIdx) => {
            const palette  = DAY_PALETTES[dayIdx % DAY_PALETTES.length];
            const dayItems = (dayGroups[dayNum] || []).sort((a, b) => a.order - b.order);
            const isToday  = todayDayNum === dayNum;
            const isOpen   = expandedDays[dayNum] ?? false;
            const dayDate  = (() => {
              if (!trip) return "";
              const d = new Date(trip.start_date);
              d.setDate(d.getDate() + dayNum - 1);
              return formatDate(d.toISOString().slice(0, 10));
            })();
            const doneCnt  = dayItems.filter(i => i.status === "completed").length;

            return (
              <motion.div
                key={dayNum}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: dayIdx * 0.07 }}
                className={cn(
                  "rounded-2xl border overflow-hidden",
                  isToday && trackingActive
                    ? "border-emerald-500/40 shadow-lg shadow-emerald-500/10"
                    : "border-border/50"
                )}
              >
                {/* Day header */}
                <button
                  onClick={() => setExpandedDays((p) => ({ ...p, [dayNum]: !p[dayNum] }))}
                  className="w-full flex items-center gap-4 p-4 bg-card hover:bg-muted/30 transition text-left"
                >
                  <div
                    className="h-10 w-10 rounded-xl flex items-center justify-center text-white text-sm font-black shrink-0 shadow-md"
                    style={{ background: `linear-gradient(135deg,${palette.from},${palette.to})` }}
                  >
                    {dayNum}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-foreground text-base">Day {dayNum}</span>
                      {isToday && <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 text-[11px] font-bold">TODAY</span>}
                      <span className="text-muted-foreground text-sm">{dayDate}</span>
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                      <span className="text-xs text-muted-foreground">{dayItems.length} activities</span>
                      {trackingActive && isToday && (
                        <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">{doneCnt}/{dayItems.length} done</span>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {symbol}{Math.round(convertFromUsd(dayItems.reduce((s, i) => s + Number(i.estimated_cost_usd), 0))).toLocaleString()} est.
                      </span>
                    </div>
                  </div>
                  {/* Mini progress */}
                  {trackingActive && isToday && (
                    <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden shrink-0">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${dayItems.length ? (doneCnt / dayItems.length) * 100 : 0}%`,
                          background: `linear-gradient(90deg,${palette.from},${palette.to})`
                        }}
                      />
                    </div>
                  )}
                  {isOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
                </button>

                {/* Activity list */}
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      key="content"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="border-t border-border/30 divide-y divide-border/20">
                        {dayItems.map((item, itemIdx) => {
                          const isActive    = trackingActive && isToday && item.status === "in_progress";
                          const isDone      = item.status === "completed";
                          const isReplanned = item.status === "replanned";
                          const nowM        = timeToMins(nowTime);
                          const isCurrentSlot = isToday && timeToMins(item.start_time) <= nowM && nowM < timeToMins(item.end_time);

                          return (
                            <motion.div
                              key={item.id}
                              initial={{ opacity: 0, x: -8 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: itemIdx * 0.04 }}
                              className={cn(
                                "flex items-start gap-3 p-4 transition-all",
                                isActive || isCurrentSlot ? "bg-primary/5" : "",
                                isDone ? "opacity-60" : ""
                              )}
                            >
                              {/* Status orb / button */}
                              {trackingActive && isToday ? (
                                <button
                                  onClick={() => cycleStatus(item.id)}
                                  className="mt-0.5 shrink-0 transition-transform hover:scale-110"
                                  title="Click to advance status"
                                >
                                  {isDone ? (
                                    <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                                  ) : isActive || isCurrentSlot ? (
                                    <motion.div
                                      animate={{ scale: [1, 1.2, 1] }}
                                      transition={{ repeat: Infinity, duration: 1.5 }}
                                    >
                                      <div className="h-5 w-5 rounded-full border-2 border-primary flex items-center justify-center">
                                        <div className="h-2 w-2 rounded-full bg-primary" />
                                      </div>
                                    </motion.div>
                                  ) : isReplanned ? (
                                    <div className="h-5 w-5 rounded-full border-2 border-amber-400 flex items-center justify-center">
                                      <div className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                                    </div>
                                  ) : (
                                    <Circle className="h-5 w-5 text-muted-foreground/30 hover:text-primary" />
                                  )}
                                </button>
                              ) : (
                                <div
                                  className="mt-0.5 h-5 w-5 rounded-full shrink-0 flex items-center justify-center text-white text-[9px] font-black"
                                  style={{ background: `linear-gradient(135deg,${palette.from},${palette.to})` }}
                                >
                                  {itemIdx + 1}
                                </div>
                              )}

                              {/* Time */}
                              <div className="text-center shrink-0 w-14">
                                <span className="text-xs font-bold text-foreground/80 block">{formatTime(item.start_time)}</span>
                                <span className="text-[10px] text-muted-foreground/50">{formatTime(item.end_time)}</span>
                              </div>

                              {/* Info */}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-start gap-2 flex-wrap">
                                  <h3 className={cn("font-bold text-sm leading-tight flex-1", isDone && "line-through text-muted-foreground")}>
                                    {item.place.name}
                                  </h3>
                                  {isReplanned && (
                                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center gap-0.5">
                                      <RefreshCw className="h-2.5 w-2.5" /> Rescheduled
                                    </span>
                                  )}
                                  {isCurrentSlot && !isDone && trackingActive && (
                                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-500/15 text-blue-600 dark:text-blue-400 flex items-center gap-0.5 animate-pulse">
                                      <div className="h-1.5 w-1.5 rounded-full bg-blue-500" /> Now
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 mt-1 flex-wrap">
                                  <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                                    <CategoryIcon category={item.place.category} size="sm" />
                                    {item.place.category}
                                  </span>
                                  <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                                    <Clock className="h-3 w-3" />
                                    {Math.floor(item.duration_minutes / 60) > 0 ? `${Math.floor(item.duration_minutes / 60)}h ` : ""}
                                    {item.duration_minutes % 60 > 0 ? `${item.duration_minutes % 60}m` : ""}
                                  </span>
                                  {Number(item.estimated_cost_usd) > 0 && (
                                    <span className="text-[11px] font-bold" style={{ color: palette.from }}>
                                      {symbol}{Math.round(convertFromUsd(Number(item.estimated_cost_usd))).toLocaleString()}
                                    </span>
                                  )}
                                  {Number(item.place.rating) > 0 && (
                                    <span className="flex items-center gap-0.5 text-[11px] text-amber-500 font-semibold">
                                      <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                                      {Number(item.place.rating).toFixed(1)}
                                    </span>
                                  )}
                                </div>
                                {item.place.description && !isDone && (
                                  <p className="text-[11px] text-muted-foreground/70 mt-1 line-clamp-2 leading-relaxed">
                                    {item.place.description}
                                  </p>
                                )}
                                {item.travel_time_minutes > 0 && itemIdx < dayItems.length - 1 && (
                                  <div className="flex items-center gap-1.5 mt-2 text-[10px] text-muted-foreground/50">
                                    <Navigation className="h-3 w-3" />
                                    {item.travel_time_minutes}min to next stop
                                  </div>
                                )}
                              </div>
                            </motion.div>
                          );
                        })}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>

        {/* ══ RETURN JOURNEY ══ */}
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
          className="glass-card p-5 rounded-2xl border border-emerald-500/20 mb-10"
        >
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-full bg-emerald-500/15 border-2 border-emerald-500 flex items-center justify-center shrink-0">
              <Home className="h-5 w-5 text-emerald-500" />
            </div>
            <div className="flex-1">
              <p className="font-bold text-base text-foreground">Return to {trip.departure_city || "Home"}</p>
              <p className="text-sm text-muted-foreground">{formatDate(trip.end_date)} · End of dream journey</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Total spent</p>
              <p className="text-lg font-black text-foreground">{symbol}{Math.round(convertFromUsd(Number(trip.budget_spent_usd) || 0)).toLocaleString()}</p>
            </div>
          </div>
        </motion.div>

        {/* ══ CTA ══ */}
        <motion.div
          initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
          className="flex flex-col sm:flex-row gap-4 items-center justify-center"
        >
          {!trackingActive ? (
            <>
              <button
                onClick={() => {
                  setTrackingActive(true);
                  setNowTime(nowHHMM());
                  autoCheckItems(nowHHMM());
                  // Expand today
                  if (todayDayNum) setExpandedDays((p) => ({ ...p, [todayDayNum]: true }));
                  else setExpandedDays((p) => ({ ...p, 1: true }));
                }}
                className="group relative overflow-hidden flex items-center gap-3 px-8 py-4 rounded-2xl text-white font-black text-lg shadow-2xl shadow-primary/30 transition-all hover:scale-[1.03] hover:shadow-primary/50 active:scale-100"
                style={{ background: "linear-gradient(135deg,#6366f1,#8b5cf6,#ec4899)" }}
              >
                <span className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                <Sparkles className="h-5 w-5 animate-pulse" />
                Let the Dream Come True
                <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
              </button>
              <Link
                href={`/trip/${tripId}`}
                className="flex items-center gap-2 px-6 py-4 rounded-2xl border border-border font-semibold text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition"
              >
                View Full Trip Details
                <ArrowRight className="h-4 w-4" />
              </Link>
            </>
          ) : (
            <button
              onClick={() => setTrackingActive(false)}
              className="flex items-center gap-3 px-8 py-4 rounded-2xl border border-border font-bold text-base text-muted-foreground hover:text-foreground hover:bg-muted transition"
            >
              <Pause className="h-5 w-5" /> Pause Tracking
            </button>
          )}
        </motion.div>
      </div>
    </div>
  );
}