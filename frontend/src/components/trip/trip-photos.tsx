"use client";

import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "@/lib/api";
import type { TripPhoto } from "@/types";
import {
  Camera,
  Plus,
  Trash2,
  X,
  Maximize2,
  MapPin,
  Calendar,
  Loader2,
  Image as ImageIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface TripPhotosProps {
  tripId: string;
}

export function TripPhotos({ tripId }: TripPhotosProps) {
  const [photos, setPhotos] = useState<TripPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [adding, setAdding] = useState(false);
  const [lightbox, setLightbox] = useState<TripPhoto | null>(null);

  // Form
  const [formUrl, setFormUrl] = useState("");
  const [formCaption, setFormCaption] = useState("");
  const [formPlace, setFormPlace] = useState("");

  const fetchPhotos = useCallback(async () => {
    try {
      const data = await api.getTripPhotos(tripId);
      setPhotos(Array.isArray(data) ? data : (data as any).results || []);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [tripId]);

  useEffect(() => {
    fetchPhotos();
  }, [fetchPhotos]);

  const handleAdd = async () => {
    if (!formUrl.trim()) return;
    setAdding(true);
    try {
      await api.addPhoto(tripId, {
        image_url: formUrl,
        caption: formCaption,
        place_name: formPlace,
      });
      setFormUrl("");
      setFormCaption("");
      setFormPlace("");
      setShowForm(false);
      fetchPhotos();
    } catch {
      // silent
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.deletePhoto(id);
      fetchPhotos();
    } catch {
      // silent
    }
  };

  if (loading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="aspect-square rounded-xl shimmer" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Camera className="h-5 w-5 text-primary" />
          <h3 className="font-semibold text-foreground">Photos</h3>
          <span className="text-xs text-muted-foreground">({photos.length})</span>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition"
        >
          {showForm ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
          {showForm ? "Cancel" : "Add Photo"}
        </button>
      </div>

      {/* Add form */}
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
                type="url"
                placeholder="Image URL (paste a link)"
                value={formUrl}
                onChange={(e) => setFormUrl(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-muted/50 border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="text"
                  placeholder="Caption (optional)"
                  value={formCaption}
                  onChange={(e) => setFormCaption(e.target.value)}
                  className="px-3 py-2 rounded-xl bg-muted/50 border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
                <input
                  type="text"
                  placeholder="Place name (optional)"
                  value={formPlace}
                  onChange={(e) => setFormPlace(e.target.value)}
                  className="px-3 py-2 rounded-xl bg-muted/50 border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
              {formUrl && (
                <div className="h-32 rounded-xl overflow-hidden bg-muted">
                  <img
                    src={formUrl}
                    alt="Preview"
                    className="w-full h-full object-cover"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                  />
                </div>
              )}
              <button
                onClick={handleAdd}
                disabled={!formUrl.trim() || adding}
                className="w-full flex items-center justify-center gap-1.5 px-4 py-2.5 text-sm rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition"
              >
                {adding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                Add Photo
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Photos grid */}
      {photos.length === 0 ? (
        <div className="text-center py-8">
          <ImageIcon className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No photos yet. Add your first photo!</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <AnimatePresence mode="popLayout">
            {photos.map((photo, idx) => (
              <motion.div
                key={photo.id}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ delay: idx * 0.05 }}
                className="group relative aspect-square rounded-xl overflow-hidden border border-border/50 cursor-pointer"
                onClick={() => setLightbox(photo)}
              >
                <img
                  src={photo.image_url}
                  alt={photo.caption || "Trip photo"}
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
                {/* Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                  <div className="absolute bottom-0 left-0 right-0 p-3">
                    {photo.caption && (
                      <p className="text-xs text-white font-medium truncate">{photo.caption}</p>
                    )}
                    {photo.place_name && (
                      <p className="text-[10px] text-white/70 flex items-center gap-1 mt-0.5">
                        <MapPin className="h-2.5 w-2.5" />
                        {photo.place_name}
                      </p>
                    )}
                  </div>
                  <div className="absolute top-2 right-2 flex gap-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setLightbox(photo);
                      }}
                      className="p-1.5 rounded-lg bg-black/40 text-white hover:bg-black/60 transition"
                    >
                      <Maximize2 className="h-3 w-3" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(photo.id);
                      }}
                      className="p-1.5 rounded-lg bg-black/40 text-white hover:bg-red-500/80 transition"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Lightbox */}
      <AnimatePresence>
        {lightbox && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4"
            onClick={() => setLightbox(null)}
          >
            <button
              className="absolute top-4 right-4 p-2 rounded-xl text-white/80 hover:text-white hover:bg-white/10 transition z-10"
              onClick={() => setLightbox(null)}
            >
              <X className="h-6 w-6" />
            </button>

            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              className="max-w-4xl max-h-[85vh] relative"
              onClick={(e) => e.stopPropagation()}
            >
              <img
                src={lightbox.image_url}
                alt={lightbox.caption || "Trip photo"}
                className="max-w-full max-h-[80vh] rounded-xl object-contain"
              />
              {(lightbox.caption || lightbox.place_name) && (
                <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent rounded-b-xl">
                  {lightbox.caption && (
                    <p className="text-white font-medium">{lightbox.caption}</p>
                  )}
                  {lightbox.place_name && (
                    <p className="text-white/70 text-sm flex items-center gap-1 mt-1">
                      <MapPin className="h-3 w-3" />
                      {lightbox.place_name}
                    </p>
                  )}
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
