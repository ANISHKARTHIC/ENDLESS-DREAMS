"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";
import type { CurrencyRate } from "@/types";

interface CurrencyContextType {
  currency: string;
  setCurrency: (code: string) => void;
  rates: CurrencyRate[];
  convert: (amountInr: number) => number;
  symbol: string;
  loading: boolean;
}

const CurrencyContext = createContext<CurrencyContextType>({
  currency: "INR",
  setCurrency: () => {},
  rates: [],
  convert: (a) => a,
  symbol: "\u20b9",
  loading: false,
});

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const [currency, setCurrencyState] = useState("INR");
  const [rates, setRates] = useState<CurrencyRate[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Load saved preference
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("preferred_currency");
      if (saved) setCurrencyState(saved);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    api
      .getCurrencyRates()
      .then((data) => setRates(data.rates))
      .catch(() => {
        // Fallback mock rates
        setRates([
          { currency_code: "INR", currency_name: "Indian Rupee", symbol: "\u20b9", rate_from_inr: 1, updated_at: "" },
          { currency_code: "USD", currency_name: "US Dollar", symbol: "$", rate_from_inr: 0.011976, updated_at: "" },
          { currency_code: "EUR", currency_name: "Euro", symbol: "\u20ac", rate_from_inr: 0.01098, updated_at: "" },
          { currency_code: "GBP", currency_name: "British Pound", symbol: "\u00a3", rate_from_inr: 0.00946, updated_at: "" },
          { currency_code: "JPY", currency_name: "Japanese Yen", symbol: "\u00a5", rate_from_inr: 1.835, updated_at: "" },
        ]);
      })
      .finally(() => setLoading(false));
  }, []);

  const setCurrency = useCallback((code: string) => {
    setCurrencyState(code);
    if (typeof window !== "undefined") {
      localStorage.setItem("preferred_currency", code);
    }
  }, []);

  const convert = useCallback(
    (amountInr: number) => {
      if (currency === "INR") return amountInr;
      const rate = rates.find((r) => r.currency_code === currency);
      if (!rate) return amountInr;
      return Math.round(amountInr * rate.rate_from_inr * 100) / 100;
    },
    [currency, rates]
  );

  const symbol =
    rates.find((r) => r.currency_code === currency)?.symbol ?? "\u20b9";

  return (
    <CurrencyContext.Provider
      value={{ currency, setCurrency, rates, convert, symbol, loading }}
    >
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  return useContext(CurrencyContext);
}
