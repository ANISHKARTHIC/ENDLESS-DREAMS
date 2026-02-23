"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Plane,
  Moon,
  Sun,
  Menu,
  X,
  LayoutDashboard,
  Sparkles,
  ChevronDown,
  Compass,
  User,
  LogOut,
  Bookmark,
  Settings,
} from "lucide-react";
import { useTheme } from "next-themes";
import { motion, AnimatePresence } from "framer-motion";
import { useCurrency } from "@/contexts/currency-context";
import { AuthModal } from "@/components/auth/auth-modal";

export function Navbar() {
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [currencyOpen, setCurrencyOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const { currency, setCurrency, rates } = useCurrency();

  useEffect(() => {
    setMounted(true);
    // Check if user is logged in
    const token = typeof window !== "undefined" ? localStorage.getItem("access_token") : null;
    setIsLoggedIn(!!token);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    setIsLoggedIn(false);
    setUserMenuOpen(false);
    window.location.href = "/";
  };

  const links = [
    { href: "/", label: "Home" },
    { href: "/explore", label: "Explore", icon: Compass },
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  ];

  return (
    <header className="fixed top-0 left-0 right-0 z-50">
      <div className="glass border-b border-border/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-1.5 group">
              <img src="/logo.svg" alt="Endless Dreams" className="h-8 w-auto" />
              <div className="hidden sm:block">
                <span className="text-lg font-bold text-foreground tracking-tight">
                  Endless Dreams
                </span>
              </div>
            </Link>

            {/* Desktop Nav */}
            <nav className="hidden md:flex items-center gap-1">
              {links.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200",
                    pathname === link.href
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  )}
                >
                  {link.label}
                </Link>
              ))}
            </nav>

            {/* Actions */}
            <div className="flex items-center gap-2">
              {/* Currency Switcher */}
              <div className="relative hidden md:block">
                <button
                  onClick={() => setCurrencyOpen(!currencyOpen)}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-all duration-200 border border-border/50"
                >
                  <span className="text-sm">
                    {rates.find((r) => r.currency_code === currency)?.symbol ?? "\u20b9"}
                  </span>
                  <span>{currency}</span>
                  <ChevronDown className="h-3 w-3" />
                </button>

                <AnimatePresence>
                  {currencyOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -4, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -4, scale: 0.95 }}
                      transition={{ duration: 0.15 }}
                      className="absolute right-0 top-full mt-1 w-48 glass rounded-xl border border-border/50 shadow-xl overflow-hidden z-50"
                    >
                      <div className="p-1 max-h-64 overflow-y-auto">
                        {rates.map((rate) => (
                          <button
                            key={rate.currency_code}
                            onClick={() => {
                              setCurrency(rate.currency_code);
                              setCurrencyOpen(false);
                            }}
                            className={cn(
                              "w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition",
                              currency === rate.currency_code
                                ? "bg-primary/10 text-primary"
                                : "text-muted-foreground hover:text-foreground hover:bg-muted"
                            )}
                          >
                            <span className="text-sm w-5">{rate.symbol}</span>
                            <span className="font-medium">{rate.currency_code}</span>
                            <span className="text-[10px] ml-auto opacity-60">
                              {rate.currency_name}
                            </span>
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <button
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                className={cn(
                  "p-2.5 rounded-xl transition-all duration-200",
                  "text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
                aria-label="Toggle theme"
              >
                {mounted ? (
                  theme === "dark" ? (
                    <Sun className="h-4.5 w-4.5" />
                  ) : (
                    <Moon className="h-4.5 w-4.5" />
                  )
                ) : (
                  <Moon className="h-4.5 w-4.5" />
                )}
              </button>

              <div className="hidden md:block">
                <Link href="/dashboard">
                  <Button size="sm" variant="default">
                    <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                    Plan a Trip
                  </Button>
                </Link>
              </div>

              {/* User avatar / login */}
              <div className="relative hidden md:block">
                {isLoggedIn ? (
                  <>
                    <button
                      onClick={() => setUserMenuOpen(!userMenuOpen)}
                      className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center text-primary hover:bg-primary/30 transition border border-primary/20"
                    >
                      <User className="h-4 w-4" />
                    </button>
                    <AnimatePresence>
                      {userMenuOpen && (
                        <motion.div
                          initial={{ opacity: 0, y: -4, scale: 0.95 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: -4, scale: 0.95 }}
                          className="absolute right-0 top-full mt-1 w-44 glass rounded-xl border border-border/50 shadow-xl overflow-hidden z-50"
                        >
                          <div className="p-1">
                            <Link
                              href="/profile"
                              onClick={() => setUserMenuOpen(false)}
                              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition"
                            >
                              <User className="h-3.5 w-3.5" />
                              Profile
                            </Link>
                            <Link
                              href="/profile#saved"
                              onClick={() => setUserMenuOpen(false)}
                              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition"
                            >
                              <Bookmark className="h-3.5 w-3.5" />
                              Saved Places
                            </Link>
                            <hr className="my-1 border-border/50" />
                            <button
                              onClick={handleLogout}
                              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-red-500 hover:bg-red-500/10 transition"
                            >
                              <LogOut className="h-3.5 w-3.5" />
                              Sign Out
                            </button>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </>
                ) : (
                  <button
                    onClick={() => setAuthOpen(true)}
                    className="px-3 py-1.5 rounded-xl text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition border border-border/50"
                  >
                    Sign In
                  </button>
                )}
              </div>

              {/* Mobile menu */}
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className="md:hidden p-2.5 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition"
              >
                {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile menu dropdown */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="md:hidden glass border-b border-border/50"
          >
            <nav className="max-w-7xl mx-auto px-4 py-3 space-y-1">
              {links.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMenuOpen(false)}
                  className={cn(
                    "block px-4 py-2.5 rounded-xl text-sm font-medium transition",
                    pathname === link.href
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  )}
                >
                  {link.label}
                </Link>
              ))}

              {/* Mobile currency selector */}
              <div className="px-4 py-2">
                <label className="text-xs text-muted-foreground mb-1 block">Currency</label>
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="w-full py-2 px-3 rounded-xl bg-muted/50 border border-border text-sm text-foreground"
                >
                  {rates.map((r) => (
                    <option key={r.currency_code} value={r.currency_code}>
                      {r.symbol} {r.currency_code} - {r.currency_name}
                    </option>
                  ))}
                </select>
              </div>

              <Link href="/dashboard" onClick={() => setMenuOpen(false)}>
                <Button size="sm" className="w-full mt-2">
                  Plan a Trip
                </Button>
              </Link>

              {/* Mobile auth */}
              {isLoggedIn ? (
                <div className="space-y-1 mt-2 pt-2 border-t border-border/50">
                  <Link
                    href="/profile"
                    onClick={() => setMenuOpen(false)}
                    className="block px-4 py-2.5 rounded-xl text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition"
                  >
                    Profile
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="w-full text-left px-4 py-2.5 rounded-xl text-sm font-medium text-red-500 hover:bg-red-500/10 transition"
                  >
                    Sign Out
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => { setAuthOpen(true); setMenuOpen(false); }}
                  className="w-full mt-2 px-4 py-2.5 rounded-xl text-sm font-medium text-primary hover:bg-primary/10 transition border border-primary/30"
                >
                  Sign In / Sign Up
                </button>
              )}
            </nav>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Auth Modal */}
      <AuthModal
        isOpen={authOpen}
        onClose={() => setAuthOpen(false)}
        onSuccess={() => {
          setIsLoggedIn(true);
          setAuthOpen(false);
        }}
      />
    </header>
  );
}
