"use client";

import { Plane, Github, Heart } from "lucide-react";
import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t border-border bg-background/50 backdrop-blur-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Brand */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                <Plane className="h-4 w-4 text-white rotate-[-30deg]" />
              </div>
              <span className="text-lg font-bold gradient-text">
                Endless Dreams
              </span>
            </div>
            <p className="text-sm text-muted-foreground max-w-xs">
              AI-powered travel intelligence that dynamically crafts, monitors,
              and adapts your perfect itinerary in real-time.
            </p>
          </div>

          {/* Links */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-foreground">Product</h3>
            <div className="space-y-2">
              {[
                { label: "Dashboard", href: "/dashboard" },
                { label: "How It Works", href: "/#how-it-works" },
                { label: "Features", href: "/#features" },
              ].map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="block text-sm text-muted-foreground hover:text-foreground transition"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>

          {/* Tech */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-foreground">Built With</h3>
            <div className="flex flex-wrap gap-2">
              {["Next.js", "Django", "Tailwind", "Framer Motion", "Mapbox"].map(
                (tech) => (
                  <span
                    key={tech}
                    className="px-2.5 py-1 text-xs rounded-full bg-muted text-muted-foreground"
                  >
                    {tech}
                  </span>
                )
              )}
            </div>
          </div>
        </div>

        <div className="mt-10 pt-6 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} The Endless Dreams. All rights reserved.
          </p>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            Made with <Heart className="h-3 w-3 text-red-500 fill-red-500 mx-0.5" /> for Hackathon
          </div>
        </div>
      </div>
    </footer>
  );
}
