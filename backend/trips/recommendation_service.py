"""Destination recommendation service — aggregates place data to recommend
budget, trip duration, and cost breakdowns for a given city."""
import logging
from decimal import Decimal
from places.models import Place

logger = logging.getLogger(__name__)

# Average cost-of-living indices (1.0 = India baseline)
CITY_COST_INDEX: dict[str, float] = {
    # India
    'Delhi': 1.0, 'Mumbai': 1.15, 'Bangalore': 1.05, 'Chennai': 0.95,
    'Kolkata': 0.85, 'Jaipur': 0.80, 'Goa': 0.90, 'Varanasi': 0.70,
    'Agra': 0.75, 'Udaipur': 0.80, 'Hyderabad': 0.90, 'Kochi': 0.85,
    # Asia
    'Tokyo': 2.8, 'Kyoto': 2.5, 'Osaka': 2.4, 'Seoul': 2.2,
    'Bangkok': 1.2, 'Singapore': 3.0, 'Bali': 1.1, 'Kuala Lumpur': 1.4,
    'Hong Kong': 3.2, 'Taipei': 1.8, 'Hanoi': 0.9, 'Ho Chi Minh City': 0.9,
    # Europe
    'Paris': 3.5, 'London': 3.8, 'Rome': 2.8, 'Barcelona': 2.7,
    'Amsterdam': 3.2, 'Berlin': 2.5, 'Vienna': 2.9, 'Prague': 2.0,
    'Istanbul': 1.6, 'Zurich': 4.5, 'Dublin': 3.3, 'Lisbon': 2.3,
    # Americas
    'New York': 4.0, 'Los Angeles': 3.5, 'San Francisco': 4.2,
    'Toronto': 3.0, 'Mexico City': 1.3, 'Rio de Janeiro': 1.8,
    # Middle East / Africa
    'Dubai': 3.0, 'Abu Dhabi': 2.8, 'Cairo': 0.8, 'Cape Town': 1.5,
    'Marrakech': 1.0, 'Doha': 2.8,
    # Oceania
    'Sydney': 3.5, 'Melbourne': 3.2, 'Auckland': 2.8,
}

# Recommended number of days per city
RECOMMENDED_DAYS: dict[str, dict] = {
    'Delhi': {'min': 3, 'ideal': 4, 'max': 6},
    'Mumbai': {'min': 3, 'ideal': 4, 'max': 6},
    'Bangalore': {'min': 2, 'ideal': 3, 'max': 5},
    'Chennai': {'min': 2, 'ideal': 3, 'max': 5},
    'Jaipur': {'min': 2, 'ideal': 3, 'max': 4},
    'Goa': {'min': 3, 'ideal': 5, 'max': 7},
    'Varanasi': {'min': 2, 'ideal': 3, 'max': 4},
    'Agra': {'min': 1, 'ideal': 2, 'max': 3},
    'Udaipur': {'min': 2, 'ideal': 3, 'max': 4},
    'Tokyo': {'min': 4, 'ideal': 6, 'max': 10},
    'Paris': {'min': 4, 'ideal': 5, 'max': 8},
    'London': {'min': 4, 'ideal': 5, 'max': 8},
    'Rome': {'min': 3, 'ideal': 4, 'max': 7},
    'Barcelona': {'min': 3, 'ideal': 4, 'max': 6},
    'New York': {'min': 4, 'ideal': 6, 'max': 10},
    'Dubai': {'min': 3, 'ideal': 5, 'max': 7},
    'Singapore': {'min': 3, 'ideal': 4, 'max': 5},
    'Bangkok': {'min': 3, 'ideal': 5, 'max': 7},
    'Bali': {'min': 4, 'ideal': 6, 'max': 10},
    'Sydney': {'min': 4, 'ideal': 5, 'max': 8},
}

# Best months to visit (1-12)
BEST_MONTHS: dict[str, list[int]] = {
    'Delhi': [10, 11, 12, 1, 2, 3],
    'Mumbai': [11, 12, 1, 2],
    'Goa': [11, 12, 1, 2, 3],
    'Jaipur': [10, 11, 12, 1, 2, 3],
    'Tokyo': [3, 4, 10, 11],
    'Paris': [4, 5, 6, 9, 10],
    'London': [5, 6, 7, 8, 9],
    'Rome': [4, 5, 6, 9, 10],
    'Barcelona': [5, 6, 9, 10],
    'New York': [4, 5, 9, 10],
    'Dubai': [11, 12, 1, 2, 3],
    'Singapore': [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    'Bangkok': [11, 12, 1, 2],
    'Bali': [4, 5, 6, 7, 8, 9],
    'Sydney': [9, 10, 11, 12, 1, 2, 3],
}

MONTH_NAMES = [
    '', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]


def get_destination_recommendations(city: str) -> dict:
    """Build recommendations for a destination city."""
    cost_idx = CITY_COST_INDEX.get(city, 1.5)  # default moderate

    # --- Pull place stats from DB ---
    places = Place.objects.filter(city__iexact=city)
    place_count = places.count()

    avg_activity_cost_usd = 0
    categories = {}
    if place_count:
        from django.db.models import Avg, Count
        avg_activity_cost_usd = float(
            places.aggregate(avg=Avg('avg_cost_usd'))['avg'] or 0
        )
        cat_counts = (
            places.values('category')
            .annotate(cnt=Count('id'))
            .order_by('-cnt')
        )
        categories = {r['category']: r['cnt'] for r in cat_counts}

    # --- Daily costs (in USD) ---
    base_food_per_day = round(8 * cost_idx, 2)
    base_transport_per_day = round(5 * cost_idx, 2)
    base_accommodation_per_day = round(25 * cost_idx, 2)
    base_activities_per_day = round(max(avg_activity_cost_usd * 3, 10 * cost_idx), 2)

    daily_budget_usd = round(
        base_food_per_day + base_transport_per_day
        + base_accommodation_per_day + base_activities_per_day,
        2,
    )

    # Budget tiers
    budget_tiers = {
        'budget': {
            'daily_usd': round(daily_budget_usd * 0.6, 2),
            'label': 'Budget',
            'description': 'Hostels, street food, public transport',
        },
        'moderate': {
            'daily_usd': round(daily_budget_usd, 2),
            'label': 'Moderate',
            'description': '3-star hotels, local restaurants, mix of transport',
        },
        'premium': {
            'daily_usd': round(daily_budget_usd * 1.8, 2),
            'label': 'Premium',
            'description': '4-5 star hotels, fine dining, private transport',
        },
        'luxury': {
            'daily_usd': round(daily_budget_usd * 3.0, 2),
            'label': 'Luxury',
            'description': 'Luxury resorts, Michelin dining, chauffeur',
        },
    }

    # --- Days recommendation ---
    days_rec = RECOMMENDED_DAYS.get(city, {'min': 3, 'ideal': 5, 'max': 8})

    # --- Best time to visit ---
    best = BEST_MONTHS.get(city, [10, 11, 12, 1, 2, 3])
    best_time = [MONTH_NAMES[m] for m in best]

    # --- Cost breakdown ---
    breakdown = {
        'accommodation': {
            'daily_usd': base_accommodation_per_day,
            'pct': round(base_accommodation_per_day / daily_budget_usd * 100),
        },
        'food': {
            'daily_usd': base_food_per_day,
            'pct': round(base_food_per_day / daily_budget_usd * 100),
        },
        'transport': {
            'daily_usd': base_transport_per_day,
            'pct': round(base_transport_per_day / daily_budget_usd * 100),
        },
        'activities': {
            'daily_usd': base_activities_per_day,
            'pct': round(base_activities_per_day / daily_budget_usd * 100),
        },
    }

    # Top places
    top_places = list(
        places.order_by('-rating', '-popularity_score')[:6].values(
            'name', 'category', 'rating', 'avg_cost_usd', 'avg_duration_minutes',
        )
    )

    return {
        'city': city,
        'cost_index': cost_idx,
        'place_count': place_count,
        'categories': categories,
        'daily_budget_usd': daily_budget_usd,
        'budget_tiers': budget_tiers,
        'recommended_days': days_rec,
        'best_time_to_visit': best_time,
        'breakdown': breakdown,
        'top_places': top_places,
    }
