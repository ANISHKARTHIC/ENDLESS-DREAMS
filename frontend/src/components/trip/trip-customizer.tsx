"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Send,
  Sparkles,
  Utensils,
  Mountain,
  Wallet,
  Landmark,
  Palmtree,
  Route,
  Music,
  Gem,
  Bot,
  User,
  Loader2,
  ChevronDown,
  ChevronUp,
  Wand2,
  MessageSquare,
  Trash2,
  MapPin as MapPinIcon,
} from "lucide-react";
import { api } from "@/lib/api";
import { formatTime } from "@/lib/utils";
import { CategoryIcon } from "@/components/ui/category-icon";
import type { Itinerary, ItineraryItem } from "@/types";

interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  changes?: string[];
  timestamp: Date;
}

interface QuickAction {
  id: string;
  label: string;
  icon: React.ReactNode;
  description: string;
}

const QUICK_ACTIONS: QuickAction[] = [
  {
    id: "more_food",
    label: "More Food",
    icon: <Utensils className="h-4 w-4" />,
    description: "Add local food & dining experiences",
  },
  {
    id: "more_adventure",
    label: "Adventure",
    icon: <Mountain className="h-4 w-4" />,
    description: "More thrilling outdoor activities",
  },
  {
    id: "budget_friendly",
    label: "Budget",
    icon: <Wallet className="h-4 w-4" />,
    description: "Make it more budget-friendly",
  },
  {
    id: "more_culture",
    label: "Culture",
    icon: <Landmark className="h-4 w-4" />,
    description: "Add museums & historical sites",
  },
  {
    id: "more_relaxation",
    label: "Relax",
    icon: <Palmtree className="h-4 w-4" />,
    description: "More leisure & relaxation",
  },
  {
    id: "optimize_route",
    label: "Optimize",
    icon: <Route className="h-4 w-4" />,
    description: "Optimize travel route order",
  },
  {
    id: "add_nightlife",
    label: "Nightlife",
    icon: <Music className="h-4 w-4" />,
    description: "Add evening entertainment",
  },
  {
    id: "local_hidden_gems",
    label: "Hidden Gems",
    icon: <Gem className="h-4 w-4" />,
    description: "Off-the-beaten-path spots",
  },
  {
    id: "alter_today",
    label: "Alter Today",
    icon: <Wand2 className="h-4 w-4" />,
    description: "AI-adjust today's live plan",
  },
];

interface TripCustomizerProps {
  tripId: string;
  destination: string;
  items: ItineraryItem[];
  isOpen: boolean;
  onClose: () => void;
  onItineraryUpdate: (itinerary: Itinerary) => void;
}

export function TripCustomizer({
  tripId,
  destination,
  items,
  isOpen,
  onClose,
  onItineraryUpdate,
}: TripCustomizerProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showQuickActions, setShowQuickActions] = useState(true);
  const [showItinerary, setShowItinerary] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Initialize/reset messages when panel opens with fresh welcome message
  useEffect(() => {
    if (isOpen && !initialized) {
      setMessages([
        {
          id: "welcome",
          role: "system",
          content: `Hi! I'm your AI travel assistant for ${destination}. I can help you add more food spots, swap activities, optimize your route, adjust the budget, and more. What would you like to change?`,
          timestamp: new Date(),
        },
      ]);
      setInput("");
      setIsLoading(false);
      setShowQuickActions(true);
      setInitialized(true);
    }
    if (!isOpen) {
      setInitialized(false);
    }
  }, [isOpen, initialized, destination]);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [isOpen]);

  const handleSend = async (message?: string, action?: string) => {
    const text = message || input.trim();
    if (!text && !action) return;

    // Add user message
    const userMsg: Message = {
      id: Date.now().toString(),
      role: "user",
      content: action
        ? QUICK_ACTIONS.find((a) => a.id === action)?.label || action
        : text,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);
    setShowQuickActions(false);

    try {
      const result = await api.customizeTrip(tripId, {
        message: text || undefined,
        action: action || undefined,
      });

      const assistantMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: result.message || "Done! Your itinerary has been updated.",
        changes: result.changes,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMsg]);

      // Update itinerary in parent
      if (result.itinerary) {
        onItineraryUpdate(result.itinerary);
      }
    } catch (err: unknown) {
      const errorText =
        err instanceof Error
          ? err.message
          : "Sorry, I encountered an error. Please try again or rephrase your request.";
      const errorMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: errorText.includes("detail")
          ? "I hit a snag. Try a different phrasing, like \"Add more food spots to Day 2\"."
          : errorText,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50"
            onClick={onClose}
          />

          {/* Panel */}
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="fixed right-0 top-0 bottom-0 w-full sm:w-[480px] bg-background border-l border-border z-50 flex flex-col shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-border bg-gradient-to-r from-primary/5 via-accent/5 to-primary/5">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg">
                  <Wand2 className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h2 className="font-semibold text-foreground text-lg">
                    AI Customizer
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    Powered by Claude AI
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="h-9 w-9 rounded-lg flex items-center justify-center hover:bg-muted transition-colors"
              >
                <X className="h-5 w-5 text-muted-foreground" />
              </button>
            </div>

            {/* Inline Itinerary — collapsible */}
            {items.length > 0 && (
              <div className="border-b border-border">
                <button
                  onClick={() => setShowItinerary(!showItinerary)}
                  className="flex items-center justify-between w-full px-4 py-2.5 text-sm hover:bg-muted/30 transition-colors"
                >
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <MapPinIcon className="h-3.5 w-3.5" />
                    <span className="font-medium">Current Itinerary</span>
                    <span className="text-xs bg-muted px-1.5 py-0.5 rounded-full">
                      {items.length}
                    </span>
                  </span>
                  {showItinerary ? (
                    <ChevronUp className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  )}
                </button>
                {showItinerary && (
                  <div className="px-3 pb-3 max-h-[250px] overflow-y-auto scrollbar-hide">
                    {(() => {
                      const days = [
                        ...new Set(items.map((i) => i.day_number)),
                      ].sort((a, b) => a - b);
                      return days.map((day) => {
                        const dayItems = items
                          .filter((i) => i.day_number === day)
                          .sort((a, b) => a.order - b.order);
                        return (
                          <div key={day} className="mb-2">
                            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-1 mb-1">
                              Day {day}
                            </p>
                            {dayItems.map((item) => (
                              <div
                                key={item.id}
                                className="flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-muted/50 group transition-colors"
                              >
                                <span className="text-sm flex-shrink-0">
                                  <CategoryIcon category={item.place.category} size="sm" />
                                </span>
                                <span className="flex-1 text-xs font-medium text-foreground truncate">
                                  {item.place.name}
                                </span>
                                <span className="text-[10px] text-muted-foreground flex-shrink-0">
                                  {formatTime(item.start_time)}
                                </span>
                                {!item.is_locked && (
                                  <button
                                    onClick={() =>
                                      handleSend(
                                        `Remove ${item.place.name} from my itinerary`
                                      )
                                    }
                                    disabled={isLoading}
                                    className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-500 transition-all flex-shrink-0 disabled:opacity-30"
                                    title={`Remove ${item.place.name}`}
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>
                        );
                      });
                    })()}
                  </div>
                )}
              </div>
            )}

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-hide">
              {messages.map((msg) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex gap-3 ${
                    msg.role === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  {msg.role !== "user" && (
                    <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center flex-shrink-0 mt-1">
                      <Bot className="h-4 w-4 text-primary" />
                    </div>
                  )}
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground rounded-br-md"
                        : msg.role === "system"
                        ? "bg-gradient-to-br from-primary/10 to-accent/10 border border-primary/10 text-foreground rounded-bl-md"
                        : "bg-muted text-foreground rounded-bl-md"
                    }`}
                  >
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">
                      {msg.content}
                    </p>

                    {/* Show changes badges */}
                    {msg.changes && msg.changes.length > 0 && (
                      <div className="mt-3 space-y-1.5">
                        <p className="text-xs font-medium opacity-70 uppercase tracking-wider">
                          Changes Applied
                        </p>
                        {msg.changes.map((change, i) => (
                          <div
                            key={i}
                            className="flex items-center gap-2 text-xs bg-success/10 text-success px-2.5 py-1.5 rounded-lg"
                          >
                            <Sparkles className="h-3 w-3 flex-shrink-0" />
                            {change}
                          </div>
                        ))}
                      </div>
                    )}

                    <span className="text-[10px] opacity-40 mt-1.5 block">
                      {msg.timestamp.toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  {msg.role === "user" && (
                    <div className="h-8 w-8 rounded-lg bg-foreground/10 flex items-center justify-center flex-shrink-0 mt-1">
                      <User className="h-4 w-4 text-foreground/60" />
                    </div>
                  )}
                </motion.div>
              ))}

              {isLoading && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex gap-3"
                >
                  <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center flex-shrink-0">
                    <Bot className="h-4 w-4 text-primary" />
                  </div>
                  <div className="bg-muted rounded-2xl rounded-bl-md px-4 py-3">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Analyzing your request...</span>
                    </div>
                  </div>
                </motion.div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Quick Actions */}
            <AnimatePresence>
              {showQuickActions && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden border-t border-border"
                >
                  <div className="p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                        <Sparkles className="h-3 w-3" />
                        Quick Actions
                      </span>
                      <button
                        onClick={() => setShowQuickActions(false)}
                        className="text-xs text-muted-foreground hover:text-foreground"
                      >
                        <ChevronDown className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {QUICK_ACTIONS.map((action) => (
                        <button
                          key={action.id}
                          onClick={() => handleSend(undefined, action.id)}
                          disabled={isLoading}
                          className="flex items-center gap-2.5 p-2.5 rounded-xl bg-muted/50 hover:bg-muted border border-transparent hover:border-primary/20 transition-all text-left group disabled:opacity-50"
                        >
                          <div className="h-8 w-8 rounded-lg bg-primary/10 group-hover:bg-primary/20 flex items-center justify-center text-primary transition-colors flex-shrink-0">
                            {action.icon}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-medium text-foreground truncate">
                              {action.label}
                            </p>
                            <p className="text-[10px] text-muted-foreground truncate">
                              {action.description}
                            </p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Input */}
            <div className="border-t border-border p-3">
              {!showQuickActions && (
                <button
                  onClick={() => setShowQuickActions(true)}
                  className="w-full text-xs text-muted-foreground hover:text-foreground flex items-center justify-center gap-1 mb-2 py-1"
                >
                  <Sparkles className="h-3 w-3" />
                  Show quick actions
                </button>
              )}
              <div className="flex items-center gap-2">
                <div className="flex-1 relative">
                  <input
                    ref={inputRef}
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="e.g., Add more food spots to Day 2..."
                    disabled={isLoading}
                    className="w-full px-4 py-3 rounded-xl bg-muted/50 border border-border focus:border-primary/40 focus:ring-2 focus:ring-primary/10 outline-none text-sm placeholder:text-muted-foreground/50 disabled:opacity-50 transition-all pr-10"
                  />
                  <MessageSquare className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/30" />
                </div>
                <button
                  onClick={() => handleSend()}
                  disabled={isLoading || !input.trim()}
                  className="h-11 w-11 rounded-xl bg-gradient-to-br from-primary to-accent text-white flex items-center justify-center hover:shadow-lg hover:shadow-primary/25 disabled:opacity-40 disabled:hover:shadow-none transition-all flex-shrink-0"
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
