"use client";

import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "@/lib/api";
import type { TripExpense, ExpenseSummary } from "@/types";
import {
  DollarSign,
  Plus,
  Trash2,
  X,
  PieChart,
  TrendingDown,
  Utensils,
  Bus,
  Building,
  Ticket,
  ShoppingBag,
  MoreHorizontal,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useCurrency } from "@/contexts/currency-context";

const EXPENSE_CATEGORIES = [
  { key: "food", label: "Food & Drinks", icon: Utensils, color: "text-orange-500 bg-orange-500/10" },
  { key: "transport", label: "Transport", icon: Bus, color: "text-blue-500 bg-blue-500/10" },
  { key: "accommodation", label: "Accommodation", icon: Building, color: "text-purple-500 bg-purple-500/10" },
  { key: "activities", label: "Activities", icon: Ticket, color: "text-emerald-500 bg-emerald-500/10" },
  { key: "shopping", label: "Shopping", icon: ShoppingBag, color: "text-pink-500 bg-pink-500/10" },
  { key: "other", label: "Other", icon: MoreHorizontal, color: "text-gray-500 bg-gray-500/10" },
];

interface TripExpensesProps {
  tripId: string;
  budgetUsd: number;
}

export function TripExpenses({ tripId, budgetUsd }: TripExpensesProps) {
  const [expenses, setExpenses] = useState<TripExpense[]>([]);
  const [summary, setSummary] = useState<ExpenseSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const { convert, symbol } = useCurrency();

  // Form state
  const [formTitle, setFormTitle] = useState("");
  const [formAmount, setFormAmount] = useState("");
  const [formCategory, setFormCategory] = useState("food");
  const [formNotes, setFormNotes] = useState("");
  const [formPaidBy, setFormPaidBy] = useState("");

  const fetchData = useCallback(async () => {
    try {
      const [expData, sumData] = await Promise.all([
        api.getTripExpenses(tripId),
        api.getExpenseSummary(tripId),
      ]);
      setExpenses(Array.isArray(expData) ? expData : (expData as any).results || []);
      setSummary(sumData);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [tripId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCreate = async () => {
    if (!formTitle.trim() || !formAmount) return;
    setCreating(true);
    try {
      await api.createExpense(tripId, {
        title: formTitle,
        amount_usd: parseFloat(formAmount),
        category: formCategory,
        notes: formNotes,
        paid_by: formPaidBy,
      });
      setFormTitle("");
      setFormAmount("");
      setFormCategory("food");
      setFormNotes("");
      setFormPaidBy("");
      setShowForm(false);
      fetchData();
    } catch {
      // silent
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.deleteExpense(id);
      fetchData();
    } catch {
      // silent
    }
  };

  const getCategoryInfo = (key: string) => {
    return EXPENSE_CATEGORIES.find((c) => c.key === key) || EXPENSE_CATEGORIES[5];
  };

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="h-32 rounded-xl shimmer" />
        <div className="h-24 rounded-xl shimmer" />
      </div>
    );
  }

  const totalSpent = summary?.total_spent || 0;
  const remaining = summary?.remaining || budgetUsd;
  const percentUsed = budgetUsd > 0 ? (totalSpent / budgetUsd) * 100 : 0;

  return (
    <div className="space-y-4">
      {/* Budget Overview Card */}
      <div className="glass-card p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-primary" />
            <h3 className="font-semibold text-foreground">Budget Tracker</h3>
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition"
          >
            {showForm ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
            {showForm ? "Cancel" : "Add Expense"}
          </button>
        </div>

        {/* Budget progress */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">
              {symbol}{convert(totalSpent).toFixed(0)} spent
            </span>
            <span className="font-medium text-foreground">
              {symbol}{convert(budgetUsd).toFixed(0)} budget
            </span>
          </div>
          <div className="h-3 rounded-full bg-muted overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(percentUsed, 100)}%` }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              className={cn(
                "h-full rounded-full transition-colors",
                percentUsed > 90 ? "bg-red-500" : percentUsed > 70 ? "bg-amber-500" : "bg-emerald-500"
              )}
            />
          </div>
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{Math.round(percentUsed)}% used</span>
            <span>{symbol}{convert(remaining).toFixed(0)} remaining</span>
          </div>
        </div>

        {/* Category breakdown */}
        {summary?.by_category && Object.keys(summary.by_category).length > 0 && (
          <div className="mt-4 grid grid-cols-2 gap-2">
            {Object.entries(summary.by_category).map(([key, val]) => {
              const cat = getCategoryInfo(key);
              const Icon = cat.icon;
              return (
                <div
                  key={key}
                  className={cn(
                    "flex items-center gap-2 p-2 rounded-lg",
                    cat.color.split(" ")[1]
                  )}
                >
                  <Icon className={cn("h-3.5 w-3.5", cat.color.split(" ")[0])} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-foreground truncate">{val.label}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {symbol}{convert(val.amount).toFixed(0)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {summary?.daily_average !== undefined && summary.daily_average > 0 && (
          <div className="mt-3 flex items-center gap-2 p-2 rounded-lg bg-muted/50">
            <TrendingDown className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">
              Daily average: {symbol}{convert(summary.daily_average).toFixed(0)}
            </span>
          </div>
        )}
      </div>

      {/* Add expense form */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="glass-card p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="text"
                  placeholder="Expense title"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  className="col-span-2 px-3 py-2 rounded-xl bg-muted/50 border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="Amount (USD)"
                    value={formAmount}
                    onChange={(e) => setFormAmount(e.target.value)}
                    className="w-full pl-7 pr-3 py-2 rounded-xl bg-muted/50 border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                </div>
                <select
                  value={formCategory}
                  onChange={(e) => setFormCategory(e.target.value)}
                  className="px-3 py-2 rounded-xl bg-muted/50 border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                >
                  {EXPENSE_CATEGORIES.map((c) => (
                    <option key={c.key} value={c.key}>{c.label}</option>
                  ))}
                </select>
              </div>
              <input
                type="text"
                placeholder="Paid by (optional)"
                value={formPaidBy}
                onChange={(e) => setFormPaidBy(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-muted/50 border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
              <input
                type="text"
                placeholder="Notes (optional)"
                value={formNotes}
                onChange={(e) => setFormNotes(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-muted/50 border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
              <button
                onClick={handleCreate}
                disabled={!formTitle.trim() || !formAmount || creating}
                className="w-full flex items-center justify-center gap-1.5 px-4 py-2.5 text-sm rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition"
              >
                {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                Add Expense
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Expense list */}
      {expenses.length === 0 ? (
        <div className="text-center py-6">
          <PieChart className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No expenses recorded yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          <AnimatePresence mode="popLayout">
            {expenses.map((expense) => {
              const cat = getCategoryInfo(expense.category);
              const Icon = cat.icon;
              return (
                <motion.div
                  key={expense.id}
                  layout
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  className="flex items-center gap-3 p-3 rounded-xl border border-border/50 hover:bg-muted/30 transition group"
                >
                  <div className={cn("p-2 rounded-xl shrink-0", cat.color.split(" ")[1])}>
                    <Icon className={cn("h-4 w-4", cat.color.split(" ")[0])} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {expense.title}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {cat.label}
                      {expense.paid_by && ` · ${expense.paid_by}`}
                      {expense.day_number && ` · Day ${expense.day_number}`}
                    </p>
                  </div>
                  <span className="text-sm font-semibold text-foreground shrink-0">
                    {symbol}{convert(Number(expense.amount_usd)).toFixed(0)}
                  </span>
                  <button
                    onClick={() => handleDelete(expense.id)}
                    className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-muted transition"
                  >
                    <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-red-400" />
                  </button>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
