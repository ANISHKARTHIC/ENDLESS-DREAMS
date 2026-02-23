"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "@/lib/api";
import type { TripShare } from "@/types";
import {
  Share2,
  Link2,
  Copy,
  Check,
  Globe,
  Eye,
  MessageSquare,
  Edit3,
  Loader2,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface ShareDialogProps {
  tripId: string;
  tripName: string;
  isOpen: boolean;
  onClose: () => void;
}

export function ShareDialog({ tripId, tripName, isOpen, onClose }: ShareDialogProps) {
  const [shareLink, setShareLink] = useState<TripShare | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [permission, setPermission] = useState<"view" | "comment" | "edit">("view");

  const handleCreateLink = async () => {
    setLoading(true);
    try {
      const data = await api.createShareLink(tripId, permission);
      setShareLink(data);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!shareLink) return;
    const url = shareLink.share_url || `${window.location.origin}/shared/${shareLink.share_code}`;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: "spring", duration: 0.5 }}
            className="fixed inset-0 z-[101] flex items-center justify-center p-4"
          >
            <div className="w-full max-w-md bg-card border border-border rounded-2xl shadow-2xl overflow-hidden">
              {/* Header */}
              <div className="px-6 pt-6 pb-4">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                      <Share2 className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-foreground">Share Trip</h2>
                      <p className="text-xs text-muted-foreground">{tripName}</p>
                    </div>
                  </div>
                  <button
                    onClick={onClose}
                    className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                {/* Permission select */}
                <div className="space-y-2 mb-4">
                  <label className="text-xs font-medium text-muted-foreground">Access level</label>
                  <div className="grid grid-cols-3 gap-2">
                    {([
                      { key: "view" as const, label: "View", icon: Eye, desc: "Can view only" },
                      { key: "comment" as const, label: "Comment", icon: MessageSquare, desc: "Can add comments" },
                      { key: "edit" as const, label: "Edit", icon: Edit3, desc: "Can make changes" },
                    ]).map((p) => (
                      <button
                        key={p.key}
                        onClick={() => setPermission(p.key)}
                        className={cn(
                          "flex flex-col items-center gap-1.5 p-3 rounded-xl border transition",
                          permission === p.key
                            ? "border-primary bg-primary/5 text-primary"
                            : "border-border text-muted-foreground hover:text-foreground hover:bg-muted/50"
                        )}
                      >
                        <p.icon className="h-4 w-4" />
                        <span className="text-xs font-medium">{p.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Generate link */}
                {!shareLink ? (
                  <Button
                    onClick={handleCreateLink}
                    disabled={loading}
                    className="w-full py-5 rounded-xl"
                  >
                    {loading ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Link2 className="h-4 w-4 mr-2" />
                    )}
                    Generate Share Link
                  </Button>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 p-3 rounded-xl bg-muted/50 border border-border">
                      <Globe className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="flex-1 text-sm text-foreground truncate font-mono">
                        {shareLink.share_url || `${window.location.origin}/shared/${shareLink.share_code}`}
                      </span>
                      <button
                        onClick={handleCopy}
                        className={cn(
                          "p-2 rounded-lg transition shrink-0",
                          copied
                            ? "bg-emerald-500/10 text-emerald-500"
                            : "hover:bg-muted text-muted-foreground hover:text-foreground"
                        )}
                      >
                        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                      </button>
                    </div>
                    <p className="text-xs text-muted-foreground text-center">
                      Anyone with this link can {permission} this trip
                    </p>
                    <Button
                      variant="outline"
                      className="w-full rounded-xl"
                      onClick={() => {
                        setShareLink(null);
                      }}
                    >
                      Generate New Link
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
