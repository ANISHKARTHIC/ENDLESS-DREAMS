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
  destination_city: string;
  destination_country: string;
  start_date: string;
  end_date: string;
  budget_usd: number;
  budget_spent_usd: number;
  pace: 'relaxed' | 'moderate' | 'fast';
  group_size: number;
  status: 'draft' | 'active' | 'completed' | 'cancelled';
  interest_culture: number;
  interest_nature: number;
  interest_food: number;
  interest_adventure: number;
  interest_relaxation: number;
  stability_index: number;
  risk_exposure: number;
  duration_days: number;
  budget_remaining: number;
  budget_usage_ratio: number;
  itinerary_count: number;
  created_at: string;
  updated_at: string;
}

export interface TripGenerateRequest {
  destination_city: string;
  destination_country: string;
  start_date: string;
  end_date: string;
  budget_usd: number;
  pace?: 'relaxed' | 'moderate' | 'fast';
  group_size?: number;
  interest_culture?: number;
  interest_nature?: number;
  interest_food?: number;
  interest_adventure?: number;
  interest_relaxation?: number;
}

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
  avg_cost_usd: number;
  rating: number;
  popularity_score: number;
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
  estimated_cost_usd: number;
  score: number;
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
