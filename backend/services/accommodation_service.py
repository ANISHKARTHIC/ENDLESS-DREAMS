"""
Accommodation Service — Hotel/Stay search with proximity optimization.

When no external API key is set, uses rich mock data.
Selects stays near the centroid of itinerary activities,
minimizing average travel time to attractions.
"""
import math
import random
import logging
from decimal import Decimal
from typing import List, Dict, Any, Optional

logger = logging.getLogger(__name__)

# ── Mock hotel database keyed by city ──────────────────────────────────

MOCK_HOTELS: Dict[str, List[Dict[str, Any]]] = {
    "Paris": [
        {"name": "Hotel Le Marais", "type": "hotel", "stars": 4, "lat": 48.8566, "lng": 2.3522,
         "price_per_night": 180, "rating": 4.5, "amenities": ["WiFi", "Breakfast", "Concierge"],
         "image": "https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?w=400&q=75",
         "distance_to_center_km": 0.3, "description": "Charming boutique in the heart of Le Marais."},
        {"name": "Ibis Eiffel Tower", "type": "hotel", "stars": 3, "lat": 48.8530, "lng": 2.2900,
         "price_per_night": 95, "rating": 4.0, "amenities": ["WiFi", "AC"],
         "image": "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=400&q=75",
         "distance_to_center_km": 1.5, "description": "Budget-friendly near the Eiffel Tower."},
        {"name": "The Ritz Paris", "type": "resort", "stars": 5, "lat": 48.8682, "lng": 2.3282,
         "price_per_night": 850, "rating": 4.9, "amenities": ["WiFi", "Spa", "Pool", "Fine Dining", "Butler"],
         "image": "https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=400&q=75",
         "distance_to_center_km": 0.5, "description": "Legendary luxury on Place Vendôme."},
        {"name": "Generator Paris", "type": "hostel", "stars": 2, "lat": 48.8809, "lng": 2.3700,
         "price_per_night": 35, "rating": 4.1, "amenities": ["WiFi", "Shared Kitchen", "Lounge"],
         "image": "https://images.unsplash.com/photo-1555854877-bab0e564b8d5?w=400&q=75",
         "distance_to_center_km": 2.0, "description": "Vibrant hostel near Colonel Fabien."},
        {"name": "Maison Souquet", "type": "boutique", "stars": 5, "lat": 48.8825, "lng": 2.3374,
         "price_per_night": 420, "rating": 4.8, "amenities": ["WiFi", "Spa", "Bar", "Garden"],
         "image": "https://images.unsplash.com/photo-1618773928121-c32242e63f39?w=400&q=75",
         "distance_to_center_km": 1.2, "description": "Intimate luxury in Montmartre."},
    ],
    "Tokyo": [
        {"name": "Shinjuku Granbell", "type": "hotel", "stars": 4, "lat": 35.6938, "lng": 139.7034,
         "price_per_night": 120, "rating": 4.4, "amenities": ["WiFi", "Onsen", "Rooftop Bar"],
         "image": "https://images.unsplash.com/photo-1590490360182-c33d57733427?w=400&q=75",
         "distance_to_center_km": 0.5, "description": "Modern design hotel in Shinjuku."},
        {"name": "Park Hyatt Tokyo", "type": "resort", "stars": 5, "lat": 35.6868, "lng": 139.6917,
         "price_per_night": 650, "rating": 4.9, "amenities": ["WiFi", "Spa", "Pool", "Fine Dining"],
         "image": "https://images.unsplash.com/photo-1564501049412-61c2a3083791?w=400&q=75",
         "distance_to_center_km": 0.8, "description": "Iconic luxury from Lost in Translation."},
        {"name": "Khaosan Tokyo Kabuki", "type": "hostel", "stars": 2, "lat": 35.7100, "lng": 139.7950,
         "price_per_night": 25, "rating": 4.2, "amenities": ["WiFi", "Shared Kitchen"],
         "image": "https://images.unsplash.com/photo-1555854877-bab0e564b8d5?w=400&q=75",
         "distance_to_center_km": 3.0, "description": "Lively backpacker hub in Asakusa."},
        {"name": "Hotel Ryumeikan", "type": "boutique", "stars": 4, "lat": 35.6812, "lng": 139.7671,
         "price_per_night": 200, "rating": 4.6, "amenities": ["WiFi", "Onsen", "Japanese Breakfast"],
         "image": "https://images.unsplash.com/photo-1618773928121-c32242e63f39?w=400&q=75",
         "distance_to_center_km": 0.3, "description": "Traditional elegance near Tokyo Station."},
    ],
}

# Generic template for cities without specific data
_GENERIC_TEMPLATES = [
    {"name": "Central Grand Hotel", "type": "hotel", "stars": 4,
     "price_per_night": 150, "rating": 4.4, "amenities": ["WiFi", "Breakfast", "Gym"],
     "distance_to_center_km": 0.5, "description": "Comfortable stay in the city center."},
    {"name": "Luxury Palace Resort", "type": "resort", "stars": 5,
     "price_per_night": 500, "rating": 4.8, "amenities": ["WiFi", "Spa", "Pool", "Fine Dining"],
     "distance_to_center_km": 1.0, "description": "Premium resort experience."},
    {"name": "Traveler's Hostel", "type": "hostel", "stars": 2,
     "price_per_night": 30, "rating": 4.0, "amenities": ["WiFi", "Shared Kitchen", "Lounge"],
     "distance_to_center_km": 2.5, "description": "Budget-friendly with a social vibe."},
    {"name": "The Boutique Inn", "type": "boutique", "stars": 4,
     "price_per_night": 220, "rating": 4.6, "amenities": ["WiFi", "Breakfast", "Garden"],
     "distance_to_center_km": 0.8, "description": "Curated design hotel with local character."},
    {"name": "City Budget Hotel", "type": "hotel", "stars": 3,
     "price_per_night": 75, "rating": 3.8, "amenities": ["WiFi", "AC"],
     "distance_to_center_km": 1.8, "description": "No-frills comfort at a great price."},
    {"name": "Skyline Airbnb Apartment", "type": "airbnb", "stars": 0,
     "price_per_night": 100, "rating": 4.3, "amenities": ["WiFi", "Kitchen", "Washer"],
     "distance_to_center_km": 1.2, "description": "Spacious apartment with a city view."},
]


class AccommodationService:
    """Finds and ranks accommodation options for a trip."""

    def search(
        self,
        city: str,
        budget_per_night: float,
        stay_type: Optional[str] = None,
        num_nights: int = 1,
        attraction_centroid: Optional[tuple] = None,
    ) -> List[Dict[str, Any]]:
        """
        Search for accommodation.

        Args:
            city: Destination city
            budget_per_night: Max nightly budget in USD
            stay_type: Preferred type (hotel/hostel/resort/airbnb/boutique) or None for all
            num_nights: Number of nights
            attraction_centroid: (lat, lng) center of itinerary activities for proximity calc

        Returns:
            List of accommodation dicts sorted by optimization score.
        """
        # Get mock data for this city
        raw_hotels = self._get_hotels_for_city(city)

        results = []
        for h in raw_hotels:
            # Filter by stay type preference
            if stay_type and stay_type != "any" and h["type"] != stay_type:
                continue

            nightly = h["price_per_night"]
            total_cost = nightly * num_nights

            # Budget feasibility (allow up to 30% over for premium options)
            if nightly > budget_per_night * 1.3:
                continue

            # Proximity score: closer to attraction centroid = better
            proximity_score = 1.0
            distance_km = h.get("distance_to_center_km", 2.0)
            if attraction_centroid and "lat" in h and "lng" in h:
                distance_km = self._haversine(
                    attraction_centroid[0], attraction_centroid[1],
                    h["lat"], h["lng"],
                )
            proximity_score = math.exp(-distance_km / 3.0)

            # Travel time saved estimate (vs a hotel 5km away)
            baseline_km = 5.0
            travel_time_saved_pct = max(0, int((1 - distance_km / baseline_km) * 100))

            # Value score
            price_score = 1 - min(1.0, nightly / max(1, budget_per_night))
            rating_score = h["rating"] / 5.0
            optimization_score = (
                proximity_score * 0.35 +
                price_score * 0.30 +
                rating_score * 0.25 +
                (0.10 if h["type"] == stay_type else 0.05)
            )

            results.append({
                "name": h["name"],
                "type": h["type"],
                "stars": h["stars"],
                "price_per_night_usd": nightly,
                "total_cost_usd": total_cost,
                "rating": h["rating"],
                "amenities": h.get("amenities", []),
                "image_url": h.get("image", ""),
                "description": h.get("description", ""),
                "distance_to_attractions_km": round(distance_km, 1),
                "travel_time_saved_pct": travel_time_saved_pct,
                "optimization_score": round(optimization_score, 3),
                "is_recommended": False,
                "is_mock": True,
            })

        # Sort by optimization score
        results.sort(key=lambda x: x["optimization_score"], reverse=True)

        # Mark top result as recommended
        if results:
            results[0]["is_recommended"] = True

        return results

    def get_optimal_stay(
        self,
        city: str,
        budget_per_night: float,
        stay_type: Optional[str] = None,
        num_nights: int = 1,
        attraction_centroid: Optional[tuple] = None,
    ) -> Optional[Dict[str, Any]]:
        """Get the single best accommodation option."""
        results = self.search(city, budget_per_night, stay_type, num_nights, attraction_centroid)
        return results[0] if results else None

    def _get_hotels_for_city(self, city: str) -> List[Dict[str, Any]]:
        """Get hotel data — real API or mock fallback."""
        # City-specific mock data
        if city in MOCK_HOTELS:
            return MOCK_HOTELS[city]

        # Generate plausible hotels for unknown cities
        random.seed(hash(city) % (2**32))  # Deterministic per city
        hotels = []
        for template in _GENERIC_TEMPLATES:
            h = dict(template)
            h["name"] = f"{city} {h['name']}"
            # Randomize price ±20%
            factor = 0.8 + random.random() * 0.4
            h["price_per_night"] = int(h["price_per_night"] * factor)
            h["rating"] = round(h["rating"] + (random.random() - 0.5) * 0.4, 1)
            h["rating"] = min(5.0, max(3.0, h["rating"]))
            h["image"] = "https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?w=400&q=75"
            hotels.append(h)
        return hotels

    @staticmethod
    def _haversine(lat1, lon1, lat2, lon2) -> float:
        R = 6371
        dlat = math.radians(lat2 - lat1)
        dlon = math.radians(lon2 - lon1)
        a = (math.sin(dlat / 2) ** 2 +
             math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) *
             math.sin(dlon / 2) ** 2)
        return R * 2 * math.asin(math.sqrt(a))
