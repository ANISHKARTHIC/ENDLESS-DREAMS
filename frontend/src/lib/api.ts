/* API Client - Centralized REST API layer */
import type {
  Trip,
  TripGenerateRequest,
  Itinerary,
  Place,
  TripHealth,
  WeatherData,
  WeatherForecast,
  ReplanEvent,
} from '@/types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

class ApiClient {
  private baseUrl: string;
  private sessionId: string;

  constructor() {
    this.baseUrl = API_URL;
    this.sessionId = this.getOrCreateSessionId();
  }

  private getOrCreateSessionId(): string {
    if (typeof window === 'undefined') return '';
    let id = localStorage.getItem('session_id');
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem('session_id', id);
    }
    return id;
  }

  private getHeaders(): HeadersInit {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      'X-Session-Id': this.sessionId,
    };
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('access_token');
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
    }
    return headers;
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers: { ...this.getHeaders(), ...options.headers },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Request failed' }));
      throw new Error(error.detail || error.error || JSON.stringify(error));
    }

    return response.json();
  }

  // Auth
  async register(data: { username: string; email: string; password: string; password_confirm: string }) {
    return this.request<{ user: any; tokens: { access: string; refresh: string } }>('/auth/register/', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async login(username: string, password: string) {
    const result = await this.request<{ access: string; refresh: string }>('/auth/login/', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    localStorage.setItem('access_token', result.access);
    localStorage.setItem('refresh_token', result.refresh);
    return result;
  }

  async logout() {
    const refresh = localStorage.getItem('refresh_token');
    if (refresh) {
      await this.request('/auth/logout/', {
        method: 'POST',
        body: JSON.stringify({ refresh }),
      }).catch(() => {});
    }
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
  }

  // Trips
  async generateTrip(data: TripGenerateRequest) {
    return this.request<{ trip: Trip; itinerary: Itinerary }>('/trips/generate/', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getTrips() {
    return this.request<{ results: Trip[] }>('/trips/');
  }

  async getTrip(id: string) {
    return this.request<Trip>(`/trips/${id}/`);
  }

  async getTripHealth(tripId: string) {
    return this.request<TripHealth>(`/trips/${tripId}/health/`);
  }

  // Itineraries
  async getActiveItinerary(tripId: string) {
    return this.request<Itinerary>(`/trips/${tripId}/itinerary/active/`);
  }

  async reorderItems(itineraryId: string, items: { item_id: string; day_number: number; order: number }[]) {
    return this.request<Itinerary>(`/itineraries/${itineraryId}/reorder/`, {
      method: 'POST',
      body: JSON.stringify({ items }),
    });
  }

  async toggleLockItem(itemId: string) {
    return this.request<{ id: string; is_locked: boolean }>(`/itineraries/items/${itemId}/lock/`, {
      method: 'POST',
    });
  }

  // Places
  async getPlaces(params?: { city?: string; category?: string }) {
    const query = new URLSearchParams(params as Record<string, string>).toString();
    return this.request<{ results: Place[] }>(`/places/?${query}`);
  }

  async getPlacesByCity(city: string) {
    return this.request<{ results: Place[] }>(`/places/city/${city}/`);
  }

  // Weather
  async getWeather(city: string) {
    return this.request<WeatherData>(`/weather/?city=${encodeURIComponent(city)}`);
  }

  async getWeatherForecast(city: string, days = 5) {
    return this.request<WeatherForecast>(`/weather/forecast/?city=${encodeURIComponent(city)}&days=${days}`);
  }

  // Monitoring
  async getReplanEvents(tripId: string) {
    return this.request<{ results: ReplanEvent[] }>(`/trips/${tripId}/events/`);
  }

  // Feedback
  async submitFeedback(data: { trip: string; itinerary_item?: string; rating: number; comment?: string }) {
    return this.request('/feedback/', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }
}

export const api = new ApiClient();
