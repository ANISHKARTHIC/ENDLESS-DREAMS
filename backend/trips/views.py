"""Trip API views."""
import time
import uuid
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from .models import Trip
from .serializers import TripSerializer, TripListSerializer, TripCreateSerializer
from itineraries.models import Itinerary, ItineraryItem
from itineraries.serializers import ItinerarySerializer
from ai_engine.scoring import ScoringEngine
from ai_engine.optimizer import RouteOptimizer
from ai_engine.health import TripHealthCalculator
from places.models import Place
from services.accommodation_service import AccommodationService
from services.booking_insights_service import BookingInsightsService


class TripListView(generics.ListAPIView):
    serializer_class = TripListSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Trip.objects.filter(user=self.request.user)


class TripDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = TripSerializer
    lookup_field = 'id'

    def get_queryset(self):
        if self.request.user.is_authenticated:
            return Trip.objects.filter(user=self.request.user)
        session_id = self.request.headers.get('X-Session-Id', '')
        return Trip.objects.filter(session_id=session_id)


class TripGenerateView(APIView):
    """Generate a complete trip itinerary."""
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = TripCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        start_time = time.time()

        # Create trip
        trip = Trip(
            title=f"{data['destination_city']} Adventure",
            departure_city=data.get('departure_city', ''),
            destination_city=data['destination_city'],
            destination_country=data['destination_country'],
            start_date=data['start_date'],
            end_date=data['end_date'],
            budget_usd=data['budget_usd'],
            pace=data.get('pace', 'moderate'),
            stay_type=data.get('stay_type', 'any'),
            group_size=data.get('group_size', 1),
            interest_culture=data.get('interest_culture', 0.5),
            interest_nature=data.get('interest_nature', 0.5),
            interest_food=data.get('interest_food', 0.5),
            interest_adventure=data.get('interest_adventure', 0.5),
            interest_relaxation=data.get('interest_relaxation', 0.5),
        )

        # Attach selected travel option if provided
        travel_option_id = data.get('travel_option_id')
        if travel_option_id:
            from travel.models import TravelOption
            try:
                travel_opt = TravelOption.objects.get(id=travel_option_id)
                trip.selected_travel_option = travel_opt
            except TravelOption.DoesNotExist:
                pass

        if request.user.is_authenticated:
            trip.user = request.user
        else:
            trip.session_id = request.headers.get('X-Session-Id', str(uuid.uuid4()))

        trip.save()

        # Fetch candidate places
        places = Place.objects.filter(
            city__iexact=data['destination_city']
        ).prefetch_related('metrics')

        if not places.exists():
            return Response(
                {'error': f"No places found for {data['destination_city']}. Please seed the database."},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Score places
        scorer = ScoringEngine(trip)
        scored_places = scorer.score_all(places)

        # Optimize route
        optimizer = RouteOptimizer(trip, scored_places)
        itinerary_items = optimizer.optimize()

        # Create itinerary
        generation_time = int((time.time() - start_time) * 1000)
        itinerary = Itinerary.objects.create(
            trip=trip,
            version=1,
            generation_time_ms=generation_time,
            total_score=sum(item['score'] for item in itinerary_items),
        )

        # Create itinerary items
        for item_data in itinerary_items:
            ItineraryItem.objects.create(
                itinerary=itinerary,
                place_id=item_data['place_id'],
                day_number=item_data['day_number'],
                order=item_data['order'],
                start_time=item_data['start_time'],
                end_time=item_data['end_time'],
                duration_minutes=item_data['duration_minutes'],
                travel_time_minutes=item_data.get('travel_time_minutes', 0),
                estimated_cost_usd=item_data.get('estimated_cost_usd', 0),
                score=item_data['score'],
            )

        # Calculate trip health
        health = TripHealthCalculator(trip, itinerary)
        trip.stability_index = health.calculate_stability_index()
        trip.status = 'active'
        trip.save()

        # Accommodation optimization
        accommodation_service = AccommodationService()
        num_nights = (data['end_date'] - data['start_date']).days
        budget_per_night = float(data['budget_usd']) / max(1, num_nights) * 0.4  # 40% of daily to stay

        # Compute attraction centroid from itinerary items
        centroid = None
        place_coords = [(p.latitude, p.longitude) for p in places if p.latitude and p.longitude]
        if place_coords:
            centroid = (
                sum(c[0] for c in place_coords) / len(place_coords),
                sum(c[1] for c in place_coords) / len(place_coords),
            )

        accommodation = accommodation_service.search(
            city=data['destination_city'],
            budget_per_night=budget_per_night,
            stay_type=data.get('stay_type', 'any'),
            num_nights=num_nights,
            attraction_centroid=centroid,
        )

        # Booking insights
        insights_service = BookingInsightsService()
        accommodation_cost = accommodation[0]['total_cost_usd'] if accommodation else 0
        travel_cost = 0
        if trip.selected_travel_option:
            travel_cost = float(trip.selected_travel_option.price_inr) / 83  # approx INR to USD

        booking_insights = insights_service.generate_insights(
            city=data['destination_city'],
            start_date=data['start_date'],
            end_date=data['end_date'],
            budget_usd=float(data['budget_usd']),
            accommodation_cost=accommodation_cost,
            travel_cost=travel_cost,
            num_activities=len(itinerary_items),
        )

        return Response({
            'trip': TripSerializer(trip).data,
            'itinerary': ItinerarySerializer(itinerary).data,
            'accommodation': accommodation,
            'booking_insights': booking_insights,
        }, status=status.HTTP_201_CREATED)


class TripHealthView(APIView):
    """Get trip health / stability index."""

    def get(self, request, trip_id):
        try:
            trip = Trip.objects.get(id=trip_id)
        except Trip.DoesNotExist:
            return Response({'error': 'Trip not found'}, status=404)

        itinerary = trip.itineraries.filter(is_active=True).first()
        if not itinerary:
            return Response({'error': 'No active itinerary'}, status=404)

        health = TripHealthCalculator(trip, itinerary)
        return Response(health.get_full_report())


class AccommodationView(APIView):
    """Get accommodation recommendations for a trip."""
    permission_classes = [permissions.AllowAny]

    def get(self, request, trip_id):
        try:
            trip = Trip.objects.get(id=trip_id)
        except Trip.DoesNotExist:
            return Response({'error': 'Trip not found'}, status=404)

        num_nights = trip.duration_days - 1 or 1
        budget_per_night = float(trip.budget_usd) / max(1, num_nights) * 0.4

        # Compute attraction centroid from places in the itinerary
        centroid = None
        items = ItineraryItem.objects.filter(
            itinerary__trip=trip, itinerary__is_active=True
        ).select_related('place')
        coords = [(i.place.latitude, i.place.longitude)
                   for i in items if i.place and i.place.latitude and i.place.longitude]
        if coords:
            centroid = (
                sum(c[0] for c in coords) / len(coords),
                sum(c[1] for c in coords) / len(coords),
            )

        service = AccommodationService()
        results = service.search(
            city=trip.destination_city,
            budget_per_night=budget_per_night,
            stay_type=trip.stay_type,
            num_nights=num_nights,
            attraction_centroid=centroid,
        )
        return Response({'results': results})


class BookingInsightsView(APIView):
    """Get booking insights and price recommendations for a trip."""
    permission_classes = [permissions.AllowAny]

    def get(self, request, trip_id):
        try:
            trip = Trip.objects.get(id=trip_id)
        except Trip.DoesNotExist:
            return Response({'error': 'Trip not found'}, status=404)

        # Get accommodation cost
        accommodation_cost = 0
        service = AccommodationService()
        num_nights = trip.duration_days - 1 or 1
        budget_per_night = float(trip.budget_usd) / max(1, num_nights) * 0.4
        optimal = service.get_optimal_stay(
            city=trip.destination_city,
            budget_per_night=budget_per_night,
            stay_type=trip.stay_type,
            num_nights=num_nights,
        )
        if optimal:
            accommodation_cost = optimal['total_cost_usd']

        travel_cost = 0
        if trip.selected_travel_option:
            travel_cost = float(trip.selected_travel_option.price_inr) / 83

        items_count = ItineraryItem.objects.filter(
            itinerary__trip=trip, itinerary__is_active=True
        ).count()

        insights_service = BookingInsightsService()
        insights = insights_service.generate_insights(
            city=trip.destination_city,
            start_date=trip.start_date,
            end_date=trip.end_date,
            budget_usd=float(trip.budget_usd),
            accommodation_cost=accommodation_cost,
            travel_cost=travel_cost,
            num_activities=items_count,
        )
        return Response(insights)
