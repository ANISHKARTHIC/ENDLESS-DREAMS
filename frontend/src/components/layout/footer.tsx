"use client";

import { Github, Heart } from "lucide-react";
import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t border-border bg-background/50 backdrop-blur-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-start">
          {/* Left - Product links */}
          <div className="space-y-4 order-2 md:order-1">
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

          {/* Center - Brand */}
          <div className="space-y-4 order-1 md:order-2 flex flex-col items-center text-center">
            <div className="flex items-center gap-1.5">
              <img src="/logo.svg" alt="Endless Dreams" className="h-7 w-auto" />
              <span className="text-lg font-bold text-foreground">
                Endless Dreams
              </span>
            </div>
            <p className="text-sm text-muted-foreground max-w-xs">
              AI-powered travel intelligence that dynamically crafts, monitors,
              and adapts your perfect itinerary in real-time.
            </p>
          </div>

          {/* Right - Built With */}
          <div className="space-y-4 order-3 md:text-right">
            <h3 className="text-sm font-semibold text-foreground">Built With</h3>
            <div className="flex flex-wrap gap-2 md:justify-end">
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
      </div>
    </footer>
  );
}
