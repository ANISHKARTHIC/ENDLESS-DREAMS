/**
 * Mapbox API Service
 * 
 * Provides clean, reusable functions for:
 * - Geocoding (location autocomplete, place search)
 * - Directions (route geometry, distance, duration)
 * 
 * All functions use async/await with proper error handling.
 */

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";

/* ─────────────────────────────────────────────────────────────────────────────
 * Types
 * ───────────────────────────────────────────────────────────────────────────── */

export interface GeocodingResult {
  id: string;
  placeName: string;
  text: string;
  lat: number;
  lng: number;
  country: string;
  region: string;
  placeType: string[];
}

export interface DirectionsResult {
  geometry: GeoJSON.LineString;
  distance: number;       // meters
  duration: number;       // seconds
  distanceKm: number;     // kilometers
  durationMinutes: number; // minutes
  summary: string;
}

export interface RouteInfo {
  distanceKm: number;
  durationMinutes: number;
  durationFormatted: string;
  geometry: GeoJSON.LineString | null;
}

/* ─────────────────────────────────────────────────────────────────────────────
 * Debounce Utility
 * ───────────────────────────────────────────────────────────────────────────── */

/**
 * Creates a debounced version of an async function.
 * Useful for search inputs to avoid excessive API calls.
 */
export function debounce<TArgs extends unknown[], TReturn>(
  fn: (...args: TArgs) => Promise<TReturn>,
  delay: number
): (...args: TArgs) => Promise<TReturn> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let pendingPromise: { resolve: (value: TReturn) => void; reject: (err: unknown) => void } | null = null;

  return (...args: TArgs): Promise<TReturn> => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    return new Promise((resolve, reject) => {
      pendingPromise = { resolve, reject };
      timeoutId = setTimeout(async () => {
        try {
          const result = await fn(...args);
          pendingPromise?.resolve(result);
        } catch (err) {
          pendingPromise?.reject(err);
        }
      }, delay);
    });
  };
}

/* ─────────────────────────────────────────────────────────────────────────────
 * Geocoding API
 * ───────────────────────────────────────────────────────────────────────────── */

/**
 * Search for places using Mapbox Geocoding API.
 * Returns autocomplete suggestions with coordinates.
 * 
 * @param query - Search text (e.g., "Paris", "123 Main St")
 * @param options - Search options
 * @returns Array of geocoding results
 * 
 * @example
 * const results = await searchPlaces("San Francisco");
 * console.log(results[0].lat, results[0].lng);
 */
export async function searchPlaces(
  query: string,
  options: {
    types?: string[];  // 'place', 'address', 'poi', 'locality', 'region', 'country'
    limit?: number;
    country?: string;  // ISO 3166-1 alpha-2 country code
    proximity?: { lat: number; lng: number };
    language?: string;
  } = {}
): Promise<GeocodingResult[]> {
  if (!MAPBOX_TOKEN) {
    console.warn("Mapbox token not configured");
    return [];
  }

  const trimmedQuery = query.trim();
  if (!trimmedQuery || trimmedQuery.length < 2) {
    return [];
  }

  const {
    types = ["place"],
    limit = 8,
    country,
    proximity,
    language = "en",
  } = options;

  try {
    const params = new URLSearchParams({
      access_token: MAPBOX_TOKEN,
      types: types.join(","),
      limit: String(limit),
      language,
      autocomplete: "true",
    });

    if (country) {
      params.set("country", country);
    }

    if (proximity) {
      params.set("proximity", `${proximity.lng},${proximity.lat}`);
    }

    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(trimmedQuery)}.json?${params}`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Geocoding API error: ${response.status}`);
    }

    const data = await response.json();

    return (data.features || []).map((feature: Record<string, unknown>): GeocodingResult => {
      const coords = (feature.geometry as { coordinates: number[] })?.coordinates || [0, 0];
      const context = (feature.context as Array<{ id: string; text: string }>) || [];
      const country = context.find((c) => c.id.startsWith("country"))?.text || "";
      const region = context.find((c) => c.id.startsWith("region"))?.text || "";

      return {
        id: feature.id as string,
        placeName: feature.place_name as string,
        text: feature.text as string,
        lat: coords[1],
        lng: coords[0],
        country,
        region,
        placeType: (feature.place_type as string[]) || [],
      };
    });
  } catch (error) {
    console.error("Geocoding search failed:", error);
    return [];
  }
}

/**
 * Search specifically for cities.
 * Convenience wrapper around searchPlaces.
 */
export async function searchCities(
  query: string,
  limit: number = 8
): Promise<GeocodingResult[]> {
  return searchPlaces(query, {
    types: ["place", "locality"],
    limit,
  });
}

/**
 * Search for addresses and POIs.
 * Useful for detailed location input.
 */
export async function searchAddresses(
  query: string,
  options: {
    limit?: number;
    proximity?: { lat: number; lng: number };
  } = {}
): Promise<GeocodingResult[]> {
  return searchPlaces(query, {
    types: ["address", "poi"],
    ...options,
  });
}

/**
 * Reverse geocode coordinates to get place name.
 * 
 * @param lat - Latitude
 * @param lng - Longitude
 * @returns Place information or null
 */
export async function reverseGeocode(
  lat: number,
  lng: number
): Promise<GeocodingResult | null> {
  if (!MAPBOX_TOKEN) {
    console.warn("Mapbox token not configured");
    return null;
  }

  try {
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${MAPBOX_TOKEN}&types=place,locality&limit=1&language=en`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Reverse geocoding error: ${response.status}`);
    }

    const data = await response.json();
    const feature = data.features?.[0];

    if (!feature) return null;

    const coords = (feature.geometry as { coordinates: number[] })?.coordinates || [lng, lat];
    const context = (feature.context as Array<{ id: string; text: string }>) || [];

    return {
      id: feature.id,
      placeName: feature.place_name,
      text: feature.text,
      lat: coords[1],
      lng: coords[0],
      country: context.find((c) => c.id.startsWith("country"))?.text || "",
      region: context.find((c) => c.id.startsWith("region"))?.text || "",
      placeType: feature.place_type || [],
    };
  } catch (error) {
    console.error("Reverse geocoding failed:", error);
    return null;
  }
}

/* ─────────────────────────────────────────────────────────────────────────────
 * Directions API
 * ───────────────────────────────────────────────────────────────────────────── */

export type TravelProfile = "driving" | "walking" | "cycling" | "driving-traffic";

/**
 * Get route directions between two or more points.
 * 
 * @param coordinates - Array of [lng, lat] coordinates (minimum 2)
 * @param profile - Travel mode: 'driving', 'walking', 'cycling', 'driving-traffic'
 * @returns Route information with geometry, distance, and duration
 * 
 * @example
 * const route = await getDirections([
 *   { lng: -122.4194, lat: 37.7749 }, // San Francisco
 *   { lng: -118.2437, lat: 34.0522 }, // Los Angeles
 * ]);
 * console.log(`${route.distanceKm} km, ${route.durationMinutes} minutes`);
 */
export async function getDirections(
  coordinates: Array<{ lat: number; lng: number }>,
  profile: TravelProfile = "driving"
): Promise<DirectionsResult | null> {
  if (!MAPBOX_TOKEN) {
    console.warn("Mapbox token not configured");
    return null;
  }

  if (coordinates.length < 2) {
    console.warn("At least 2 coordinates required for directions");
    return null;
  }

  // Mapbox expects coordinates as "lng,lat;lng,lat;..."
  const coordString = coordinates
    .map((c) => `${c.lng},${c.lat}`)
    .join(";");

  try {
    const params = new URLSearchParams({
      access_token: MAPBOX_TOKEN,
      geometries: "geojson",
      overview: "full",
      steps: "false",
    });

    const url = `https://api.mapbox.com/directions/v5/mapbox/${profile}/${coordString}?${params}`;
    const response = await fetch(url);

    if (!response.ok) {
      // 401 = token doesn't have Directions API access
      // 403 = rate limited or forbidden
      // Fall back gracefully instead of throwing
      console.warn(`Directions API returned ${response.status}, using straight-line estimate`);
      return null;
    }

    const data = await response.json();
    const route = data.routes?.[0];

    if (!route) {
      console.warn("No route found");
      return null;
    }

    const distanceKm = Math.round((route.distance / 1000) * 10) / 10;
    const durationMinutes = Math.round(route.duration / 60);

    return {
      geometry: route.geometry,
      distance: route.distance,
      duration: route.duration,
      distanceKm,
      durationMinutes,
      summary: route.legs?.[0]?.summary || "",
    };
  } catch (error) {
    console.error("Directions request failed:", error);
    return null;
  }
}

/**
 * Get route between departure and destination with formatted info.
 * Returns a simplified RouteInfo object suitable for UI display.
 */
export async function getRouteInfo(
  departure: { lat: number; lng: number },
  destination: { lat: number; lng: number },
  profile: TravelProfile = "driving"
): Promise<RouteInfo> {
  const result = await getDirections([departure, destination], profile);

  if (!result) {
    // Return straight-line fallback
    const straightLineDistance = haversineDistance(
      departure.lat,
      departure.lng,
      destination.lat,
      destination.lng
    );
    const estimatedMinutes = Math.round((straightLineDistance / 80) * 60); // ~80 km/h average

    return {
      distanceKm: Math.round(straightLineDistance * 10) / 10,
      durationMinutes: estimatedMinutes,
      durationFormatted: formatDuration(estimatedMinutes),
      geometry: null,
    };
  }

  return {
    distanceKm: result.distanceKm,
    durationMinutes: result.durationMinutes,
    durationFormatted: formatDuration(result.durationMinutes),
    geometry: result.geometry,
  };
}

/* ─────────────────────────────────────────────────────────────────────────────
 * Utility Functions
 * ───────────────────────────────────────────────────────────────────────────── */

/**
 * Calculate straight-line distance between two points using Haversine formula.
 * @returns Distance in kilometers
 */
export function haversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371; // Earth's radius in km
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}

/**
 * Format duration in minutes to human-readable string.
 * @example formatDuration(90) // "1h 30m"
 * @example formatDuration(45) // "45 min"
 */
export function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `${minutes} min`;
  }
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (mins === 0) {
    return `${hours}h`;
  }
  return `${hours}h ${mins}m`;
}

/**
 * Format distance in kilometers to human-readable string.
 * @example formatDistance(1.5) // "1.5 km"
 * @example formatDistance(0.8) // "800 m"
 */
export function formatDistance(km: number): string {
  if (km < 1) {
    return `${Math.round(km * 1000)} m`;
  }
  return `${km.toFixed(1)} km`;
}

/**
 * Create a bounding box that contains all given coordinates.
 * Useful for fitting map view to show all points.
 */
export function getBoundingBox(
  coordinates: Array<{ lat: number; lng: number }>
): { sw: { lat: number; lng: number }; ne: { lat: number; lng: number } } | null {
  if (coordinates.length === 0) return null;

  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLng = Infinity;
  let maxLng = -Infinity;

  for (const coord of coordinates) {
    minLat = Math.min(minLat, coord.lat);
    maxLat = Math.max(maxLat, coord.lat);
    minLng = Math.min(minLng, coord.lng);
    maxLng = Math.max(maxLng, coord.lng);
  }

  // Add padding (10%)
  const latPadding = (maxLat - minLat) * 0.1;
  const lngPadding = (maxLng - minLng) * 0.1;

  return {
    sw: { lat: minLat - latPadding, lng: minLng - lngPadding },
    ne: { lat: maxLat + latPadding, lng: maxLng + lngPadding },
  };
}

/* ─────────────────────────────────────────────────────────────────────────────
 * Pre-debounced Functions for Direct Use
 * ───────────────────────────────────────────────────────────────────────────── */

/**
 * Debounced city search - use this directly in input handlers.
 * Waits 300ms after user stops typing before making API call.
 */
export const searchCitiesDebounced = debounce(searchCities, 300);

/**
 * Debounced place search - use this directly in input handlers.
 */
export const searchPlacesDebounced = debounce(searchPlaces, 300);

/* ─────────────────────────────────────────────────────────────────────────────
 * Token Check
 * ───────────────────────────────────────────────────────────────────────────── */

/**
 * Check if Mapbox is configured and available.
 */
export function isMapboxConfigured(): boolean {
  return !!MAPBOX_TOKEN;
}

export { MAPBOX_TOKEN };
