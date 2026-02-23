"use client";

import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "@/lib/api";
import type { TripChecklist, ChecklistItem } from "@/types";
import {
  ListChecks,
  Plus,
  Trash2,
  CheckCircle2,
  Circle,
  ChevronDown,
  ChevronRight,
  GripVertical,
  Loader2,
  Package,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface TripChecklistsProps {
  tripId: string;
}

export function TripChecklists({ tripId }: TripChecklistsProps) {
  const [checklists, setChecklists] = useState<TripChecklist[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [expandedLists, setExpandedLists] = useState<Set<string>>(new Set());
  const [addingItemTo, setAddingItemTo] = useState<string | null>(null);
  const [newItemText, setNewItemText] = useState("");

  const fetchChecklists = useCallback(async () => {
    try {
      const data = await api.getTripChecklists(tripId);
      const list = Array.isArray(data) ? data : (data as any).results || [];
      setChecklists(list);
      // Auto-expand all
      const ids = new Set<string>(list.map((c: TripChecklist) => c.id));
      setExpandedLists(ids);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [tripId]);

  useEffect(() => {
    fetchChecklists();
  }, [fetchChecklists]);

  const handleCreateList = async () => {
    if (!newTitle.trim()) return;
    setCreating(true);
    try {
      await api.createChecklist(tripId, { title: newTitle });
      setNewTitle("");
      fetchChecklists();
    } catch {
      // silent
    } finally {
      setCreating(false);
    }
  };

  const handleAddItem = async (checklistId: string) => {
    if (!newItemText.trim()) return;
    try {
      await api.addChecklistItem(checklistId, { text: newItemText });
      setNewItemText("");
      setAddingItemTo(null);
      fetchChecklists();
    } catch {
      // silent
    }
  };

  const handleToggleItem = async (item: ChecklistItem) => {
    try {
      await api.updateChecklistItem(item.id, { checked: !item.checked });
      fetchChecklists();
    } catch {
      // silent
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    try {
      await api.deleteChecklistItem(itemId);
      fetchChecklists();
    } catch {
      // silent
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedLists((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2].map((i) => (
          <div key={i} className="h-32 rounded-xl shimmer" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ListChecks className="h-5 w-5 text-primary" />
          <h3 className="font-semibold text-foreground">Checklists</h3>
        </div>
      </div>

      {/* Create new checklist */}
      <div className="flex gap-2">
        <input
          type="text"
          placeholder="New checklist name (e.g., Packing List)"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleCreateList()}
          className="flex-1 px-3 py-2 rounded-xl bg-muted/50 border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
        />
        <button
          onClick={handleCreateList}
          disabled={!newTitle.trim() || creating}
          className="flex items-center gap-1.5 px-4 py-2 text-sm rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition"
        >
          {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
          Add
        </button>
      </div>

      {/* Quick actions */}
      <div className="flex gap-2">
        <button
          onClick={async () => {
            try {
              await api.createChecklist(tripId, { title: "Packing List" });
              fetchChecklists();
            } catch {/**/}
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted/50 transition"
        >
          <Package className="h-3 w-3" />
          Quick: Packing List
        </button>
      </div>

      {/* Checklists */}
      {checklists.length === 0 ? (
        <div className="text-center py-8">
          <ListChecks className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No checklists yet. Create one above!</p>
        </div>
      ) : (
        <div className="space-y-3">
          <AnimatePresence mode="popLayout">
            {checklists.map((checklist) => {
              const isExpanded = expandedLists.has(checklist.id);
              const progress = checklist.progress;

              return (
                <motion.div
                  key={checklist.id}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="glass-card overflow-hidden"
                >
                  {/* List header */}
                  <button
                    onClick={() => toggleExpand(checklist.id)}
                    className="w-full flex items-center gap-3 p-4 hover:bg-muted/30 transition"
                  >
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                    )}
                    <span className="text-lg">{checklist.icon || "📋"}</span>
                    <div className="flex-1 text-left">
                      <h4 className="font-medium text-foreground text-sm">{checklist.title}</h4>
                      <p className="text-xs text-muted-foreground">
                        {progress.checked}/{progress.total} items done
                      </p>
                    </div>
                    {/* Progress ring */}
                    <div className="relative h-8 w-8 shrink-0">
                      <svg className="h-8 w-8 -rotate-90" viewBox="0 0 36 36">
                        <circle
                          cx="18" cy="18" r="15"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="3"
                          className="text-muted/50"
                        />
                        <circle
                          cx="18" cy="18" r="15"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="3"
                          strokeDasharray={`${progress.percentage * 0.94} 94`}
                          strokeLinecap="round"
                          className={cn(
                            "transition-all duration-500",
                            progress.percentage === 100 ? "text-emerald-500" : "text-primary"
                          )}
                        />
                      </svg>
                      <span className="absolute inset-0 flex items-center justify-center text-[8px] font-bold text-foreground">
                        {Math.round(progress.percentage)}%
                      </span>
                    </div>
                  </button>

                  {/* Items */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0 }}
                        animate={{ height: "auto" }}
                        exit={{ height: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="px-4 pb-4 space-y-1">
                          {checklist.items.map((item) => (
                            <div
                              key={item.id}
                              className="flex items-center gap-2 group py-1.5 px-2 rounded-lg hover:bg-muted/30 transition"
                            >
                              <GripVertical className="h-3 w-3 text-muted-foreground/30 opacity-0 group-hover:opacity-100 transition cursor-grab" />
                              <button
                                onClick={() => handleToggleItem(item)}
                                className="shrink-0"
                              >
                                {item.checked ? (
                                  <CheckCircle2 className="h-4.5 w-4.5 text-emerald-500" />
                                ) : (
                                  <Circle className="h-4.5 w-4.5 text-muted-foreground hover:text-primary transition" />
                                )}
                              </button>
                              <span
                                className={cn(
                                  "flex-1 text-sm transition",
                                  item.checked
                                    ? "line-through text-muted-foreground"
                                    : "text-foreground"
                                )}
                              >
                                {item.text}
                              </span>
                              <button
                                onClick={() => handleDeleteItem(item.id)}
                                className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-muted transition"
                              >
                                <Trash2 className="h-3 w-3 text-muted-foreground hover:text-red-400" />
                              </button>
                            </div>
                          ))}

                          {/* Add item */}
                          {addingItemTo === checklist.id ? (
                            <div className="flex items-center gap-2 pl-8">
                              <input
                                type="text"
                                placeholder="New item..."
                                value={newItemText}
                                onChange={(e) => setNewItemText(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") handleAddItem(checklist.id);
                                  if (e.key === "Escape") setAddingItemTo(null);
                                }}
                                autoFocus
                                className="flex-1 px-2 py-1.5 rounded-lg bg-muted/50 border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                              />
                              <button
                                onClick={() => handleAddItem(checklist.id)}
                                disabled={!newItemText.trim()}
                                className="p-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 disabled:opacity-50 transition"
                              >
                                <Plus className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => {
                                setAddingItemTo(checklist.id);
                                setNewItemText("");
                              }}
                              className="flex items-center gap-2 pl-8 py-1.5 text-sm text-muted-foreground hover:text-primary transition"
                            >
                              <Plus className="h-3.5 w-3.5" />
                              Add item
                            </button>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
