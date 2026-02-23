/* Core types for The Endless Dreams */

export interface User {
  id: string;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  avatar_url: string | null;
  preferred_pace: 'relaxed' | 'moderate' | 'fast';
  budget_preference: 'budget' | 'mid' | 'premium';
  interest_culture: number;
  interest_nature: number;
  interest_food: number;
  interest_adventure: number;
  interest_relaxation: number;
  created_at: string;
  updated_at: string;
}

export interface Trip {
  id: string;
  title: string;
  departure_city: string;
  destination_city: string;
  destination_country: string;
  start_date: string;
  end_date: string;
  budget_usd: string | number;
  budget_spent_usd: string | number;
  pace: 'relaxed' | 'moderate' | 'fast';
  stay_type: 'hotel' | 'hostel' | 'resort' | 'airbnb' | 'boutique' | 'any';
  group_size: number;
  status: 'draft' | 'active' | 'completed' | 'cancelled';
  interest_culture: number;
  interest_nature: number;
  interest_food: number;
  interest_adventure: number;
  interest_relaxation: number;
  stability_index: string | number;
  risk_exposure: string | number;
  duration_days: number;
  budget_remaining: string | number;
  budget_usage_ratio: string | number;
  itinerary_count: number;
  selected_travel_summary: TravelSummary | null;
  created_at: string;
  updated_at: string;
}

export interface TravelSummary {
  id: string;
  transport_type: 'flight' | 'train' | 'bus';
  provider_name: string;
  departure_time: string | null;
  arrival_time: string | null;
  duration_minutes: number;
  price_inr: string;
  carbon_kg: number;
}

export interface TripGenerateRequest {
  departure_city?: string;
  destination_city: string;
  destination_country: string;
  start_date: string;
  end_date: string;
  budget_usd: number;
  pace?: 'relaxed' | 'moderate' | 'fast';
  stay_type?: 'hotel' | 'hostel' | 'resort' | 'airbnb' | 'boutique' | 'any';
  group_size?: number;
  interest_culture?: number;
  interest_nature?: number;
  interest_food?: number;
  interest_adventure?: number;
  interest_relaxation?: number;
  travel_option_id?: string;
}

/* ──── Travel Types ──── */

export interface TravelOption {
  id: string;
  transport_type: 'flight' | 'train' | 'bus';
  provider_name: string;
  route_number: string;
  departure_city: string;
  departure_station: string;
  arrival_city: string;
  arrival_station: string;
  departure_time: string;
  arrival_time: string;
  duration_minutes: number;
  price_inr: string | number;
  price_usd: string | number;
  stops: number;
  stop_details: string[];
  cabin_class: string;
  carbon_kg: number;
  delay_risk: number;
  amenities: string[];
  is_direct: boolean;
  is_mock: boolean;
  badges?: string[];
  created_at: string;
}

export interface TravelSearchRequest {
  departure_city: string;
  arrival_city: string;
  travel_date: string;
  transport_types?: ('flight' | 'train' | 'bus')[];
}

export interface TravelSearchResponse {
  departure_city: string;
  arrival_city: string;
  travel_date: string;
  total_options: number;
  options: TravelOption[];
}

export interface CurrencyRate {
  currency_code: string;
  currency_name: string;
  symbol: string;
  rate_from_inr: number;
  updated_at: string;
}

export interface CurrencyRatesResponse {
  base: string;
  rates: CurrencyRate[];
}

/* ──── Existing Types ──── */

export interface Place {
  id: string;
  name: string;
  description: string;
  category: string;
  city: string;
  country: string;
  latitude: number;
  longitude: number;
  avg_duration_minutes: number;
  avg_cost_usd: string | number;
  rating: string | number;
  popularity_score: string | number;
  image_url: string | null;
  opening_hour: string | null;
  closing_hour: string | null;
  is_outdoor: boolean;
}

export interface ItineraryItem {
  id: string;
  place: Place;
  day_number: number;
  order: number;
  start_time: string;
  end_time: string;
  duration_minutes: number;
  travel_time_minutes: number;
  estimated_cost_usd: string | number;
  score: string | number;
  status: 'scheduled' | 'in_progress' | 'completed' | 'skipped' | 'replanned';
  notes: string;
  is_locked: boolean;
}

export interface Itinerary {
  id: string;
  trip: string;
  version: number;
  is_active: boolean;
  generated_at: string;
  generation_time_ms: number;
  total_score: number;
  items: ItineraryItem[];
  day_groups: Record<string, ItineraryItem[]>;
}

export interface TripHealth {
  stability_index: number;
  status: 'excellent' | 'good' | 'fair' | 'poor' | 'critical';
  percentage: number;
  components: {
    budget_health: number;
    risk_health: number;
    weather_health: number;
    time_buffer_health: number;
  };
}

export interface WeatherData {
  city: string;
  temperature: number;
  feels_like: number;
  humidity: number;
  condition: string;
  description: string;
  icon: string;
  wind_speed: number;
  timestamp: string;
  is_mock?: boolean;
}

export interface WeatherForecast {
  city: string;
  forecasts: {
    datetime: string;
    temperature: number;
    condition: string;
    description: string;
    icon: string;
    wind_speed: number;
    humidity: number;
    rain_probability: number;
  }[];
}

export interface ReplanEvent {
  id: string;
  trip: string;
  trigger_type: 'weather' | 'traffic' | 'closure' | 'user' | 'schedule';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  affected_items: string[];
  risk_score_before: number;
  risk_score_after: number;
  was_applied: boolean;
  created_at: string;
}

export interface WSMessage {
  type: 'replan_notification' | 'weather_update' | 'health_update' | 'ai_response' | 'itinerary_update' | 'connection_established';
  data?: Record<string, unknown>;
  message?: string;
}

/* ──── Accommodation Types ──── */

export interface Accommodation {
  name: string;
  type: 'hotel' | 'hostel' | 'resort' | 'airbnb' | 'boutique';
  stars: number;
  price_per_night_usd: number;
  total_cost_usd: number;
  rating: number;
  amenities: string[];
  image_url: string;
  description: string;
  distance_to_attractions_km: number;
  travel_time_saved_pct: number;
  optimization_score: number;
  is_recommended: boolean;
  is_mock: boolean;
}

/* ──── Booking Insights Types ──── */

export interface PriceAlert {
  type: 'activity_deal' | 'accommodation_pricing' | 'crowd_insight';
  severity: 'low' | 'medium' | 'high';
  title: string;
  description: string;
  expires_in_hours: number | null;
  potential_savings_usd: number;
  action: string;
}

export interface DailyBudget {
  total_budget_usd: number;
  accommodation_cost_usd: number;
  travel_cost_usd: number;
  remaining_for_activities_usd: number;
  daily_activity_budget_usd: number;
  breakdown: {
    meals: number;
    attractions: number;
    transport: number;
    miscellaneous: number;
  };
}

export interface BookingWindow {
  day: number;
  date: string;
  avg_activity_cost_usd: number;
  price_trend: 'rising' | 'stable' | 'falling';
  confidence_pct: number;
  recommendation: string;
}

export interface CostForecast {
  day: number;
  predicted_cost_usd: number;
  cumulative_usd: number;
  budget_remaining_usd: number;
  on_track: boolean;
}

export interface SavingsTip {
  category: string;
  tip: string;
}

export interface BookingInsights {
  price_alerts: PriceAlert[];
  daily_budget: DailyBudget;
  savings_tips: SavingsTip[];
  booking_windows: BookingWindow[];
  cost_forecast: CostForecast[];
  is_mock: boolean;
}

export interface TripGenerateResponse {
  trip: Trip;
  itinerary: Itinerary;
  accommodation: Accommodation[];
  booking_insights: BookingInsights;
}
