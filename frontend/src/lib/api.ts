/* API Client - Centralized REST API layer */
import type {
  Trip,
  TripGenerateRequest,
  TripGenerateResponse,
  Itinerary,
  Place,
  TripHealth,
  WeatherData,
  WeatherForecast,
  ReplanEvent,
  Accommodation,
  BookingInsights,
} from '@/types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

class ApiClient {
  private baseUrl: string;
  private isRefreshing = false;
  private refreshPromise: Promise<string> | null = null;

  constructor() {
    this.baseUrl = API_URL;
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

  private getHeaders(token?: string): HeadersInit {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      'X-Session-Id': this.getOrCreateSessionId(),
    };
    const accessToken = token ?? (typeof window !== 'undefined' ? localStorage.getItem('access_token') : null);
    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
    }
    return headers;
  }

  private async refreshAccessToken(): Promise<string> {
    // Deduplicate concurrent refresh calls
    if (this.isRefreshing && this.refreshPromise) {
      return this.refreshPromise;
    }
    this.isRefreshing = true;
    this.refreshPromise = (async () => {
      const refresh = typeof window !== 'undefined' ? localStorage.getItem('refresh_token') : null;
      if (!refresh) throw new Error('No refresh token available');

      const response = await fetch(`${this.baseUrl}/auth/refresh/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh }),
      });

      if (!response.ok) {
        // Refresh token itself is expired – clear everything
        if (typeof window !== 'undefined') {
          localStorage.removeItem('access_token');
          localStorage.removeItem('refresh_token');
        }
        throw new Error('Session expired. Please log in again.');
      }

      const data = await response.json();
      if (typeof window !== 'undefined') {
        localStorage.setItem('access_token', data.access);
        // simplejwt returns a new refresh token when ROTATE_REFRESH_TOKENS=True
        if (data.refresh) {
          localStorage.setItem('refresh_token', data.refresh);
        }
      }
      return data.access as string;
    })();

    try {
      return await this.refreshPromise;
    } finally {
      this.isRefreshing = false;
      this.refreshPromise = null;
    }
  }

  private async request<T>(path: string, options: RequestInit = {}, retry = true): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers: { ...this.getHeaders(), ...options.headers },
    });

    if (response.status === 401 && retry) {
      const hasRefresh = typeof window !== 'undefined' && !!localStorage.getItem('refresh_token');
      const hadAccessToken = typeof window !== 'undefined' && !!localStorage.getItem('access_token');

      if (hasRefresh) {
        try {
          const newToken = await this.refreshAccessToken();
          // Retry with the fresh token
          const retryResponse = await fetch(`${this.baseUrl}${path}`, {
            ...options,
            headers: { ...this.getHeaders(newToken), ...options.headers },
          });
          if (!retryResponse.ok) {
            const error = await retryResponse.json().catch(() => ({ detail: 'Request failed' }));
            throw new Error(error.detail || error.error || JSON.stringify(error));
          }
          return retryResponse.json();
        } catch {
          // Refresh failed; tokens already cleared by refreshAccessToken()
        }
      } else if (hadAccessToken) {
        // Stale access token with no refresh token – discard it
        localStorage.removeItem('access_token');
      }

      // If we had a token but it's now gone, retry anonymously so AllowAny endpoints succeed.
      if (hadAccessToken && typeof window !== 'undefined' && !localStorage.getItem('access_token')) {
        return this.request<T>(path, options, false);
      }
    }

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
    return this.request<TripGenerateResponse>('/trips/generate/', {
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

  // Travel
  async searchTravel(data: { departure_city: string; arrival_city: string; travel_date: string; transport_types?: string[] }) {
    return this.request<import('@/types').TravelSearchResponse>('/travel/search/', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getTravelOption(id: string) {
    return this.request<import('@/types').TravelOption>(`/travel/options/${id}/`);
  }

  // Currency
  async getCurrencyRates() {
    return this.request<import('@/types').CurrencyRatesResponse>('/travel/currency/rates/');
  }

  async convertCurrency(amount: number, from: string, to: string) {
    return this.request<{ original_amount: number; from: string; to: string; converted_amount: number }>(
      `/travel/currency/convert/?amount=${amount}&from=${from}&to=${to}`
    );
  }

  // Accommodation
  async getAccommodation(tripId: string) {
    return this.request<{ results: Accommodation[] }>(`/trips/${tripId}/accommodation/`);
  }

  // Booking Insights
  async getBookingInsights(tripId: string) {
    return this.request<BookingInsights>(`/trips/${tripId}/booking-insights/`);
  }
}

export const api = new ApiClient();
