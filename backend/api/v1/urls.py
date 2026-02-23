"""API v1 URL configuration."""
from django.urls import path, include
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from users.views import RegisterView, ProfileView, PreferencesView, LogoutView
from trips.views import TripListView, TripDetailView, TripGenerateView, TripHealthView, AccommodationView, BookingInsightsView, TripCustomizeView, TripAIChatView, DestinationRecommendationView
from itineraries.views import (
    ItineraryDetailView, ItineraryByTripView, ActiveItineraryView,
    ItineraryItemUpdateView, ItineraryReorderView, ItineraryItemLockView,
    ItineraryItemStatusView,
)
from places.views import PlaceListView, PlaceDetailView, PlaceByCityView, PlaceGeocodeView, PlaceEnrichView, DestinationCitiesView
from monitoring.views import ReplanEventListView, WeatherView, WeatherForecastView
from feedback.views import FeedbackCreateView, FeedbackListView

urlpatterns = [
    # Auth
    path('auth/register/', RegisterView.as_view(), name='register'),
    path('auth/login/', TokenObtainPairView.as_view(), name='token_obtain'),
    path('auth/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('auth/logout/', LogoutView.as_view(), name='logout'),

    # User
    path('user/profile/', ProfileView.as_view(), name='profile'),
    path('user/preferences/', PreferencesView.as_view(), name='preferences'),

    # Trips
    path('trips/', TripListView.as_view(), name='trip-list'),
    path('trips/<uuid:id>/', TripDetailView.as_view(), name='trip-detail'),
    path('trips/generate/', TripGenerateView.as_view(), name='trip-generate'),
    path('trips/<uuid:trip_id>/health/', TripHealthView.as_view(), name='trip-health'),
    path('trips/<uuid:trip_id>/accommodation/', AccommodationView.as_view(), name='trip-accommodation'),
    path('trips/<uuid:trip_id>/booking-insights/', BookingInsightsView.as_view(), name='trip-booking-insights'),
    path('trips/<uuid:trip_id>/customize/', TripCustomizeView.as_view(), name='trip-customize'),
    path('trips/<uuid:trip_id>/ai-chat/', TripAIChatView.as_view(), name='trip-ai-chat'),

    # Itineraries
    path('itineraries/<uuid:id>/', ItineraryDetailView.as_view(), name='itinerary-detail'),
    path('trips/<uuid:trip_id>/itineraries/', ItineraryByTripView.as_view(), name='trip-itineraries'),
    path('trips/<uuid:trip_id>/itinerary/active/', ActiveItineraryView.as_view(), name='active-itinerary'),
    path('itineraries/items/<uuid:id>/', ItineraryItemUpdateView.as_view(), name='item-update'),
    path('itineraries/<uuid:itinerary_id>/reorder/', ItineraryReorderView.as_view(), name='itinerary-reorder'),
    path('itineraries/items/<uuid:item_id>/lock/', ItineraryItemLockView.as_view(), name='item-lock'),
    path('itineraries/items/<uuid:item_id>/status/', ItineraryItemStatusView.as_view(), name='item-status'),

    # Places
    path('places/', PlaceListView.as_view(), name='place-list'),
    path('places/<uuid:id>/', PlaceDetailView.as_view(), name='place-detail'),
    path('places/city/<str:city>/', PlaceByCityView.as_view(), name='places-by-city'),
    path('places/geocode/', PlaceGeocodeView.as_view(), name='place-geocode'),
    path('places/enrich/', PlaceEnrichView.as_view(), name='place-enrich'),
    path('places/destinations/', DestinationCitiesView.as_view(), name='destination-cities'),

    # Recommendations
    path('recommendations/', DestinationRecommendationView.as_view(), name='destination-recommendations'),

    # Travel & Currency
    path('travel/', include('travel.urls')),

    # Telegram Bot
    path('telegram/', include('telegram_bot.urls')),

    # Monitoring
    path('trips/<uuid:trip_id>/events/', ReplanEventListView.as_view(), name='replan-events'),
    path('weather/', WeatherView.as_view(), name='weather'),
    path('weather/forecast/', WeatherForecastView.as_view(), name='weather-forecast'),

    # Feedback
    path('feedback/', FeedbackCreateView.as_view(), name='feedback-create'),
    path('trips/<uuid:trip_id>/feedback/', FeedbackListView.as_view(), name='feedback-list'),
]
