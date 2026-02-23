import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number, currencyCode: string = 'INR', symbol: string = '₹'): string {
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: currencyCode,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    // Fallback if currency code is unknown to Intl
    return `${symbol}${Math.round(amount).toLocaleString()}`;
  }
}

export function formatDate(date: string): string {
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function formatTime(time: string): string {
  const [h, m] = time.split(':');
  const hour = parseInt(h);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${m} ${ampm}`;
}

export function getStabilityColor(index: number): string {
  if (index >= 0.85) return 'text-success';
  if (index >= 0.70) return 'text-emerald-500';
  if (index >= 0.50) return 'text-warning';
  if (index >= 0.30) return 'text-orange-500';
  return 'text-danger';
}

export function getStabilityBg(index: number): string {
  if (index >= 0.85) return 'bg-success/10';
  if (index >= 0.70) return 'bg-emerald-500/10';
  if (index >= 0.50) return 'bg-warning/10';
  if (index >= 0.30) return 'bg-orange-500/10';
  return 'bg-danger/10';
}

export function getCategoryIcon(category: string): string {
  // Returns the category key for use with CategoryIcon component
  // Kept for backward compat — use CategoryIcon component for rendering
  return category || 'default';
}

export function getCategoryColor(category: string): string {
  const colors: Record<string, string> = {
    culture: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
    nature: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
    food: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
    adventure: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
    relaxation: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
    shopping: 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300',
    nightlife: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300',
    landmark: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  };
  return colors[category] || 'bg-gray-100 text-gray-700';
}
