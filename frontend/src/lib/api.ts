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

  // Destination cities (all cities in DB)
  async getDestinationCities(q?: string) {
    const params = q ? `?q=${encodeURIComponent(q)}` : '';
    return this.request<{ cities: { city: string; country: string; place_count: number; lat: number; lng: number }[] }>(
      `/places/destinations/${params}`
    );
  }

  // Destination Recommendations
  async getRecommendations(city: string) {
    return this.request<{
      city: string;
      cost_index: number;
      place_count: number;
      categories: Record<string, number>;
      daily_budget_usd: number;
      budget_tiers: Record<string, { daily_usd: number; label: string; description: string }>;
      recommended_days: { min: number; ideal: number; max: number };
      best_time_to_visit: string[];
      breakdown: Record<string, { daily_usd: number; pct: number }>;
      top_places: { name: string; category: string; rating: number; avg_cost_usd: number; avg_duration_minutes: number }[];
    }>(`/recommendations/?city=${encodeURIComponent(city)}`);
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

  // AI Customizer
  async customizeTrip(tripId: string, data: { message?: string; action?: string }) {
    return this.request<{
      message: string;
      changes: string[];
      modification: Record<string, unknown>;
      itinerary: Itinerary;
    }>(`/trips/${tripId}/customize/`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async aiChat(tripId: string, message: string) {
    return this.request<{ message: string }>(`/trips/${tripId}/ai-chat/`, {
      method: 'POST',
      body: JSON.stringify({ message }),
    });
  }

  // Item Status (live trip day tracking)
  async updateItemStatus(itemId: string, status: string) {
    return this.request<{ id: string; status: string; place_name: string }>(
      `/itineraries/items/${itemId}/status/`,
      { method: 'POST', body: JSON.stringify({ status }) }
    );
  }

  // Telegram Bot
  async getTelegramStatus() {
    return this.request<{ bot_configured: boolean; webhook_url: string; linked_users: number }>(
      '/telegram/status/'
    );
  }

  async setupTelegramWebhook() {
    return this.request<{ ok: boolean; webhook_url: string }>(
      '/telegram/setup/',
      { method: 'POST' }
    );
  }

  // ──── Notes ────
  async getTripNotes(tripId: string) {
    return this.request<import('@/types').TripNote[]>(`/trips/${tripId}/notes/`);
  }

  async createNote(tripId: string, data: { title?: string; content?: string; color?: string; day_number?: number }) {
    return this.request<import('@/types').TripNote>(`/trips/${tripId}/notes/`, {
      method: 'POST', body: JSON.stringify(data),
    });
  }

  async updateNote(noteId: string, data: Partial<import('@/types').TripNote>) {
    return this.request<import('@/types').TripNote>(`/notes/${noteId}/`, {
      method: 'PATCH', body: JSON.stringify(data),
    });
  }

  async deleteNote(noteId: string) {
    return this.request(`/notes/${noteId}/`, { method: 'DELETE' });
  }

  // ──── Checklists ────
  async getTripChecklists(tripId: string) {
    return this.request<import('@/types').TripChecklist[]>(`/trips/${tripId}/checklists/`);
  }

  async createChecklist(tripId: string, data: { title: string; icon?: string }) {
    return this.request<import('@/types').TripChecklist>(`/trips/${tripId}/checklists/`, {
      method: 'POST', body: JSON.stringify(data),
    });
  }

  async addChecklistItem(checklistId: string, data: { text: string; order?: number }) {
    return this.request<import('@/types').ChecklistItem>(`/checklists/${checklistId}/items/`, {
      method: 'POST', body: JSON.stringify(data),
    });
  }

  async updateChecklistItem(itemId: string, data: { text?: string; checked?: boolean; order?: number }) {
    return this.request<import('@/types').ChecklistItem>(`/checklist-items/${itemId}/`, {
      method: 'PATCH', body: JSON.stringify(data),
    });
  }

  async deleteChecklistItem(itemId: string) {
    return this.request(`/checklist-items/${itemId}/delete/`, { method: 'DELETE' });
  }

  async toggleAllChecklistItems(checklistId: string) {
    return this.request<{ checked: boolean; count: number }>(`/checklists/${checklistId}/toggle-all/`, {
      method: 'POST',
    });
  }

  // ──── Expenses ────
  async getTripExpenses(tripId: string) {
    return this.request<import('@/types').TripExpense[]>(`/trips/${tripId}/expenses/`);
  }

  async createExpense(tripId: string, data: { title: string; amount_usd: number; category?: string; day_number?: number; notes?: string; paid_by?: string }) {
    return this.request<import('@/types').TripExpense>(`/trips/${tripId}/expenses/`, {
      method: 'POST', body: JSON.stringify(data),
    });
  }

  async deleteExpense(expenseId: string) {
    return this.request(`/expenses/${expenseId}/`, { method: 'DELETE' });
  }

  async getExpenseSummary(tripId: string) {
    return this.request<import('@/types').ExpenseSummary>(`/trips/${tripId}/expenses/summary/`);
  }

  // ──── Photos ────
  async getTripPhotos(tripId: string) {
    return this.request<import('@/types').TripPhoto[]>(`/trips/${tripId}/photos/`);
  }

  async addPhoto(tripId: string, data: { image_url: string; caption?: string; day_number?: number; place_name?: string }) {
    return this.request<import('@/types').TripPhoto>(`/trips/${tripId}/photos/`, {
      method: 'POST', body: JSON.stringify(data),
    });
  }

  async deletePhoto(photoId: string) {
    return this.request(`/photos/${photoId}/`, { method: 'DELETE' });
  }

  // ──── Sharing ────
  async createShareLink(tripId: string, permission: string = 'view') {
    return this.request<import('@/types').TripShare>(`/trips/${tripId}/share/`, {
      method: 'POST', body: JSON.stringify({ permission }),
    });
  }

  async getSharedTrip(shareCode: string) {
    return this.request<{
      trip: Trip;
      itinerary: import('@/types').Itinerary | null;
      photos: import('@/types').TripPhoto[];
      notes: import('@/types').TripNote[];
      permission: string;
    }>(`/shared/${shareCode}/`);
  }

  // ──── Saved Places ────
  async getSavedPlaces() {
    return this.request<import('@/types').SavedPlace[]>('/saved-places/');
  }

  async savePlace(placeId: string, tripId?: string, notes?: string) {
    return this.request<import('@/types').SavedPlace>('/saved-places/', {
      method: 'POST', body: JSON.stringify({ place: placeId, trip: tripId, notes }),
    });
  }

  async removeSavedPlace(savedId: string) {
    return this.request(`/saved-places/${savedId}/`, { method: 'DELETE' });
  }

  // ──── Explore ────
  async getExploreDestinations(params?: { q?: string; category?: string }) {
    const query = new URLSearchParams(params as Record<string, string>).toString();
    return this.request<{ destinations: import('@/types').ExploreDestination[] }>(`/explore/?${query}`);
  }

  // ──── User Profile ────
  async getProfile() {
    return this.request<import('@/types').User>('/user/profile/');
  }

  async updateProfile(data: Partial<import('@/types').User>) {
    return this.request<import('@/types').User>('/user/profile/', {
      method: 'PUT', body: JSON.stringify(data),
    });
  }

  // ──── Google OAuth ────
  async googleLogin(credential: string) {
    const result = await this.request<{
      user: import('@/types').User;
      tokens: { access: string; refresh: string };
      created: boolean;
    }>('/auth/google/', {
      method: 'POST',
      body: JSON.stringify({ credential }),
    });
    if (result.tokens) {
      localStorage.setItem('access_token', result.tokens.access);
      localStorage.setItem('refresh_token', result.tokens.refresh);
    }
    return result;
  }

  // ──── Unsplash Photos ────
  async getUnsplashPhotos(params: { q?: string; city?: string; place?: string; count?: number }) {
    const query = new URLSearchParams();
    if (params.q) query.set('q', params.q);
    if (params.city) query.set('city', params.city);
    if (params.place) query.set('place', params.place);
    if (params.count) query.set('count', params.count.toString());
    return this.request<{
      photos: Array<{
        id: string;
        url_full: string;
        url_regular: string;
        url_small: string;
        url_thumb: string;
        description: string;
        photographer: string;
        photographer_url: string;
        attribution: string;
      }>;
    }>(`/photos/unsplash/?${query.toString()}`);
  }

  // ──── PDF Export ────
  getTripPDFUrl(tripId: string): string {
    return `${this.baseUrl}/trips/${tripId}/export/pdf/`;
  }

  // ──── AI Budget Estimation ────
  async estimateBudget(data: {
    destination_city: string;
    destination_country?: string;
    departure_city?: string;
    start_date?: string;
    end_date?: string;
    pace?: string;
    stay_type?: string;
    group_size?: number;
    currency?: string;
    transport_mode?: string;
  }) {
    return this.request<BudgetEstimateResponse>('/trips/estimate-budget/', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }
}

export interface BudgetAllocationItem {
  category: string;
  amount: number;
  percentage: number;
  reason: string;
}

export interface BudgetEstimateResponse {
  budget: number;
  goal: string;
  assumptions: string[];
  allocation: BudgetAllocationItem[];
  hidden_costs: string[];
  optimization_tips: string[];
  overspending_risk: string;
  confidence: 'low' | 'medium' | 'high';
  currency: string;
  duration_days: number;
  preference: string;
  ai_generated: boolean;
}

export const api = new ApiClient();
