"use client";

import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "@/lib/api";
import type { TripNote } from "@/types";
import {
  StickyNote,
  Plus,
  Pin,
  PinOff,
  Trash2,
  Edit3,
  X,
  Check,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NOTE_COLORS: { key: string; label: string; bg: string; border: string }[] = [
  { key: "default", label: "Gray", bg: "bg-muted/60", border: "border-border/50" },
  { key: "blue", label: "Blue", bg: "bg-blue-500/10", border: "border-blue-500/20" },
  { key: "green", label: "Green", bg: "bg-emerald-500/10", border: "border-emerald-500/20" },
  { key: "yellow", label: "Yellow", bg: "bg-amber-500/10", border: "border-amber-500/20" },
  { key: "pink", label: "Pink", bg: "bg-pink-500/10", border: "border-pink-500/20" },
  { key: "purple", label: "Purple", bg: "bg-purple-500/10", border: "border-purple-500/20" },
];

interface TripNotesProps {
  tripId: string;
}

export function TripNotes({ tripId }: TripNotesProps) {
  const [notes, setNotes] = useState<TripNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // New note form
  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");
  const [newColor, setNewColor] = useState("default");
  const [showForm, setShowForm] = useState(false);

  // Edit form
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [editColor, setEditColor] = useState<string>("default");

  const fetchNotes = useCallback(async () => {
    try {
      const data = await api.getTripNotes(tripId);
      setNotes(Array.isArray(data) ? data : (data as any).results || []);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [tripId]);

  useEffect(() => {
    fetchNotes();
  }, [fetchNotes]);

  const handleCreate = async () => {
    if (!newContent.trim()) return;
    setCreating(true);
    try {
      await api.createNote(tripId, {
        title: newTitle,
        content: newContent,
        color: newColor,
      });
      setNewTitle("");
      setNewContent("");
      setNewColor("default");
      setShowForm(false);
      fetchNotes();
    } catch {
      // silent
    } finally {
      setCreating(false);
    }
  };

  const handleUpdate = async (noteId: string) => {
    try {
      await api.updateNote(noteId, {
        title: editTitle,
        content: editContent,
        color: editColor as TripNote["color"],
      });
      setEditingId(null);
      fetchNotes();
    } catch {
      // silent
    }
  };

  const handleDelete = async (noteId: string) => {
    try {
      await api.deleteNote(noteId);
      fetchNotes();
    } catch {
      // silent
    }
  };

  const handlePin = async (note: TripNote) => {
    try {
      await api.updateNote(note.id, { pinned: !note.pinned });
      fetchNotes();
    } catch {
      // silent
    }
  };

  const startEdit = (note: TripNote) => {
    setEditingId(note.id);
    setEditTitle(note.title);
    setEditContent(note.content);
    setEditColor(note.color);
  };

  const getColorClass = (color: string) => {
    return NOTE_COLORS.find((c) => c.key === color) || NOTE_COLORS[0];
  };

  const sortedNotes = [...notes].sort((a, b) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 rounded-xl shimmer" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <StickyNote className="h-5 w-5 text-primary" />
          <h3 className="font-semibold text-foreground">Notes</h3>
          <span className="text-xs text-muted-foreground">({notes.length})</span>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition"
        >
          {showForm ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
          {showForm ? "Cancel" : "Add Note"}
        </button>
      </div>

      {/* New note form */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="glass-card p-4 space-y-3">
              <input
                type="text"
                placeholder="Note title (optional)"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-muted/50 border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
              <textarea
                placeholder="Write your note..."
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 rounded-lg bg-muted/50 border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
              />
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  {NOTE_COLORS.map((c) => (
                    <button
                      key={c.key}
                      onClick={() => setNewColor(c.key)}
                      className={cn(
                        "h-6 w-6 rounded-full border-2 transition",
                        c.bg,
                        newColor === c.key ? "border-foreground scale-110" : c.border
                      )}
                      title={c.label}
                    />
                  ))}
                </div>
                <button
                  onClick={handleCreate}
                  disabled={!newContent.trim() || creating}
                  className="flex items-center gap-1.5 px-4 py-1.5 text-sm rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition"
                >
                  {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                  Save
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Notes grid */}
      {sortedNotes.length === 0 ? (
        <div className="text-center py-8">
          <StickyNote className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No notes yet. Add your first note!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <AnimatePresence mode="popLayout">
            {sortedNotes.map((note) => {
              const colorCls = getColorClass(note.color);
              const isEditing = editingId === note.id;

              return (
                <motion.div
                  key={note.id}
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className={cn(
                    "rounded-xl border p-4 transition-all",
                    colorCls.bg,
                    colorCls.border,
                    note.pinned && "ring-1 ring-primary/30"
                  )}
                >
                  {isEditing ? (
                    <div className="space-y-2">
                      <input
                        type="text"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        className="w-full px-2 py-1 rounded bg-background/50 border border-border text-sm focus:outline-none"
                        placeholder="Title"
                      />
                      <textarea
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        rows={3}
                        className="w-full px-2 py-1 rounded bg-background/50 border border-border text-sm focus:outline-none resize-none"
                      />
                      <div className="flex items-center justify-between">
                        <div className="flex gap-1">
                          {NOTE_COLORS.map((c) => (
                            <button
                              key={c.key}
                              onClick={() => setEditColor(c.key)}
                              className={cn(
                                "h-5 w-5 rounded-full border-2 transition",
                                c.bg,
                                editColor === c.key ? "border-foreground" : c.border
                              )}
                            />
                          ))}
                        </div>
                        <div className="flex gap-1">
                          <button
                            onClick={() => setEditingId(null)}
                            className="p-1.5 rounded-lg hover:bg-muted transition"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => handleUpdate(note.id)}
                            className="p-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition"
                          >
                            <Check className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-start justify-between mb-2">
                        <h4 className="font-medium text-foreground text-sm leading-tight">
                          {note.title || "Untitled"}
                        </h4>
                        <div className="flex items-center gap-0.5 shrink-0 ml-2">
                          <button
                            onClick={() => handlePin(note)}
                            className="p-1 rounded hover:bg-background/50 transition"
                            title={note.pinned ? "Unpin" : "Pin"}
                          >
                            {note.pinned ? (
                              <PinOff className="h-3 w-3 text-primary" />
                            ) : (
                              <Pin className="h-3 w-3 text-muted-foreground" />
                            )}
                          </button>
                          <button
                            onClick={() => startEdit(note)}
                            className="p-1 rounded hover:bg-background/50 transition"
                          >
                            <Edit3 className="h-3 w-3 text-muted-foreground" />
                          </button>
                          <button
                            onClick={() => handleDelete(note.id)}
                            className="p-1 rounded hover:bg-background/50 transition"
                          >
                            <Trash2 className="h-3 w-3 text-muted-foreground hover:text-red-400" />
                          </button>
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap line-clamp-4">
                        {note.content}
                      </p>
                      {note.day_number && (
                        <span className="inline-block mt-2 text-[10px] px-2 py-0.5 rounded-full bg-background/50 text-muted-foreground">
                          Day {note.day_number}
                        </span>
                      )}
                    </>
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
