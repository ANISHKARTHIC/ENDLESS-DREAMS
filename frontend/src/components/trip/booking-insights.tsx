"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { BookingInsights } from "@/types";
import {
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Minus,
  Lightbulb,
  Clock,
  BarChart3,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
  Coins,
} from "lucide-react";
import { useCurrency } from "@/contexts/currency-context";

interface BookingInsightsProps {
  insights: BookingInsights;
}

function SeverityDot({ severity }: { severity: string }) {
  const colors: Record<string, string> = {
    high: "bg-red-500",
    medium: "bg-amber-500",
    low: "bg-blue-500",
  };
  return (
    <span className={`inline-block h-2 w-2 rounded-full shrink-0 ${colors[severity] || "bg-muted"}`} />
  );
}

function TrendIcon({ trend }: { trend: string }) {
  if (trend === "rising") return <TrendingUp className="h-3.5 w-3.5 text-red-500" />;
  if (trend === "falling") return <TrendingDown className="h-3.5 w-3.5 text-green-500" />;
  return <Minus className="h-3.5 w-3.5 text-muted-foreground" />;
}

export function BookingInsightsPanel({ insights }: BookingInsightsProps) {
  const [expandedSection, setExpandedSection] = useState<string | null>("alerts");
  const { convert, symbol } = useCurrency();

  const toggleSection = (section: string) => {
    setExpandedSection((prev) => (prev === section ? null : section));
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="glass-card overflow-hidden"
    >
      {/* Header */}
      <div className="p-4 pb-3 border-b border-border/50">
        <h3 className="font-semibold text-foreground flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-primary" />
          Booking Insights
        </h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Smart pricing and budget recommendations
        </p>
      </div>

      {/* Price Alerts */}
      <div className="border-b border-border/30">
        <button
          onClick={() => toggleSection("alerts")}
          className="w-full flex items-center justify-between p-4 py-3 text-left hover:bg-muted/20 transition"
        >
          <span className="flex items-center gap-2 text-sm font-medium">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            Price Alerts
            {insights.price_alerts.length > 0 && (
              <span className="px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-600 text-[10px] font-bold">
                {insights.price_alerts.length}
              </span>
            )}
          </span>
          {expandedSection === "alerts" ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </button>
        <AnimatePresence>
          {expandedSection === "alerts" && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="px-4 pb-4 space-y-2">
                {insights.price_alerts.map((alert, i) => (
                  <div
                    key={i}
                    className="p-3 rounded-lg bg-muted/30 border border-border/30"
                  >
                    <div className="flex items-start gap-2">
                      <SeverityDot severity={alert.severity} />
                      <div className="flex-1">
                        <p className="text-xs font-medium text-foreground">
                          {alert.title}
                        </p>
                        <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                          {alert.description}
                        </p>
                        <div className="flex items-center gap-3 mt-2">
                          {alert.expires_in_hours && (
                            <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                              <Clock className="h-3 w-3" />
                              {alert.expires_in_hours}h left
                            </span>
                          )}
                          {alert.potential_savings_usd > 0 && (
                            <span className="flex items-center gap-1 text-[10px] text-green-600 font-medium">
                              <Coins className="h-3 w-3" />
                              Save {symbol}{Math.round(convert(alert.potential_savings_usd))}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Daily Budget */}
      <div className="border-b border-border/30">
        <button
          onClick={() => toggleSection("budget")}
          className="w-full flex items-center justify-between p-4 py-3 text-left hover:bg-muted/20 transition"
        >
          <span className="flex items-center gap-2 text-sm font-medium">
            <Coins className="h-4 w-4 text-green-500" />
            Budget Breakdown
          </span>
          {expandedSection === "budget" ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </button>
        <AnimatePresence>
          {expandedSection === "budget" && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="px-4 pb-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Total Budget</span>
                    <span className="font-medium">{symbol}{Math.round(convert(insights.daily_budget.total_budget_usd))}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Accommodation</span>
                    <span className="font-medium">-{symbol}{Math.round(convert(insights.daily_budget.accommodation_cost_usd))}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Travel</span>
                    <span className="font-medium">-{symbol}{Math.round(convert(insights.daily_budget.travel_cost_usd))}</span>
                  </div>
                  <div className="h-px bg-border/50 my-1" />
                  <div className="flex justify-between text-xs">
                    <span className="text-foreground font-medium">Daily Activity Budget</span>
                    <span className="font-bold text-primary">{symbol}{Math.round(convert(insights.daily_budget.daily_activity_budget_usd))}</span>
                  </div>

                  {/* Breakdown bars */}
                  <div className="mt-3 space-y-1.5">
                    {Object.entries(insights.daily_budget.breakdown).map(([key, val]) => (
                      <div key={key} className="flex items-center gap-2">
                        <span className="text-[10px] text-muted-foreground w-20 capitalize">{key}</span>
                        <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full rounded-full bg-foreground/50"
                            style={{
                              width: `${Math.min(100, (val / insights.daily_budget.daily_activity_budget_usd) * 100)}%`,
                            }}
                          />
                        </div>
                        <span className="text-[10px] font-medium w-10 text-right">{symbol}{Math.round(convert(val))}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Booking Windows */}
      <div className="border-b border-border/30">
        <button
          onClick={() => toggleSection("windows")}
          className="w-full flex items-center justify-between p-4 py-3 text-left hover:bg-muted/20 transition"
        >
          <span className="flex items-center gap-2 text-sm font-medium">
            <TrendingUp className="h-4 w-4 text-blue-500" />
            Price Trends by Day
          </span>
          {expandedSection === "windows" ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </button>
        <AnimatePresence>
          {expandedSection === "windows" && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="px-4 pb-4 space-y-1.5">
                {insights.booking_windows.map((w) => (
                  <div
                    key={w.day}
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/20 transition"
                  >
                    <span className="text-xs font-medium w-12 shrink-0">Day {w.day}</span>
                    <TrendIcon trend={w.price_trend} />
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] text-foreground truncate">{w.recommendation}</p>
                    </div>
                    <span className="text-xs font-medium shrink-0">{symbol}{Math.round(convert(w.avg_activity_cost_usd))}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Savings Tips */}
      <div>
        <button
          onClick={() => toggleSection("tips")}
          className="w-full flex items-center justify-between p-4 py-3 text-left hover:bg-muted/20 transition"
        >
          <span className="flex items-center gap-2 text-sm font-medium">
            <Lightbulb className="h-4 w-4 text-amber-500" />
            Savings Tips
          </span>
          {expandedSection === "tips" ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </button>
        <AnimatePresence>
          {expandedSection === "tips" && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="px-4 pb-4 space-y-2">
                {insights.savings_tips.map((tip, i) => (
                  <div key={i} className="flex items-start gap-2 p-2 rounded-lg bg-muted/20">
                    <ShieldCheck className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                    <div>
                      <p className="text-[10px] font-semibold text-primary uppercase tracking-wide">
                        {tip.category}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                        {tip.tip}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Mock indicator */}
      {insights.is_mock && (
        <div className="px-4 pb-3 border-t border-border/30">
          <p className="text-[10px] text-muted-foreground/60 text-center pt-2">
            Simulated insights — connect API for live pricing data
          </p>
        </div>
      )}
    </motion.div>
  );
}
