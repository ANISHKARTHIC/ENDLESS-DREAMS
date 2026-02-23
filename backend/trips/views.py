"""Trip API views."""
import json
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
from ai_engine.llm_layer import LLMLayer
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

        # Enrich places with Mapbox geocoding (non-blocking best-effort)
        try:
            from services.mapbox_places_service import MapboxPlacesService
            mapbox = MapboxPlacesService()
            if mapbox.token:
                for place in places:
                    if not place.latitude or not place.longitude:
                        mapbox.enrich_place(place)
                        place.save(update_fields=['latitude', 'longitude'])
        except Exception as e:
            logger.warning(f'Mapbox enrichment skipped: {e}')

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


class TripCustomizeView(APIView):
    """AI-powered trip customizer — modify itinerary using natural language."""
    permission_classes = [permissions.AllowAny]

    @staticmethod
    def _build_alter_today_prompt(trip):
        """Build a prompt for altering today's plan based on current time & status."""
        import datetime
        today = datetime.date.today()
        try:
            trip_start = datetime.date.fromisoformat(str(trip.start_date))
            day_number = (today - trip_start).days + 1
        except Exception:
            day_number = 1
        now_hour = datetime.datetime.now().hour
        time_of_day = 'morning' if now_hour < 12 else ('afternoon' if now_hour < 17 else 'evening')
        return (
            f"Optimize Day {day_number} of my {trip.destination_city} trip for the {time_of_day}. "
            f"It's currently {time_of_day}, so adjust remaining activities to fit the time left. "
            f"Replace any completed or skipped activities with fresh alternatives."
        )

    def post(self, request, trip_id):
        try:
            trip = Trip.objects.get(id=trip_id)
        except Trip.DoesNotExist:
            return Response({'error': 'Trip not found'}, status=404)

        message = request.data.get('message', '').strip()
        action = request.data.get('action')  # optional quick-action

        if not message and not action:
            return Response({'error': 'Please provide a message or action.'}, status=400)

        itinerary = trip.itineraries.filter(is_active=True).first()
        if not itinerary:
            return Response({'error': 'No active itinerary to customize.'}, status=404)

        # Build current itinerary context
        items = list(
            ItineraryItem.objects.filter(itinerary=itinerary)
            .select_related('place')
            .order_by('day_number', 'order')
        )
        itinerary_context = []
        for item in items:
            itinerary_context.append({
                'id': str(item.id),
                'day': item.day_number,
                'order': item.order,
                'place_name': item.place.name if item.place else 'Unknown',
                'category': item.place.category if item.place else '',
                'start_time': str(item.start_time),
                'end_time': str(item.end_time),
                'cost_usd': float(item.estimated_cost_usd),
                'is_locked': item.is_locked,
            })

        trip_context = {
            'destination': trip.destination_city,
            'country': trip.destination_country,
            'days': trip.duration_days,
            'budget_usd': float(trip.budget_usd),
            'pace': trip.pace,
            'interests': {
                'culture': trip.interest_culture,
                'nature': trip.interest_nature,
                'food': trip.interest_food,
                'adventure': trip.interest_adventure,
                'relaxation': trip.interest_relaxation,
            },
            'itinerary': itinerary_context,
        }

        llm = LLMLayer()

        # Handle quick actions
        if action:
            action_prompts = {
                'more_food': f"Add more food and dining experiences to my {trip.destination_city} trip. Replace some lower-rated activities with popular local food spots.",
                'more_adventure': f"Make my {trip.destination_city} trip more adventurous. Swap relaxation or shopping activities for adventure and outdoor experiences.",
                'budget_friendly': f"Make my {trip.destination_city} trip more budget-friendly. Replace expensive activities with free or cheap alternatives.",
                'more_culture': f"Add more cultural experiences to my {trip.destination_city} trip. Include museums, temples, historical sites.",
                'more_relaxation': f"Make my {trip.destination_city} trip more relaxing. Replace rushed activities with leisure, spa, beach or park experiences.",
                'optimize_route': f"Optimize the route order of my {trip.destination_city} itinerary so nearby places are visited together, minimizing travel time.",
                'add_nightlife': f"Add nightlife and evening entertainment to my {trip.destination_city} trip.",
                'local_hidden_gems': f"Replace some tourist spots with local hidden gems and off-the-beaten-path experiences in {trip.destination_city}.",
                'alter_today': self._build_alter_today_prompt(trip),
            }
            message = action_prompts.get(action, message or f"Customize my {trip.destination_city} trip: {action}")

        # Step 1: Interpret the modification intent via AI
        modification = llm.interpret_modification(message)

        # Step 2: Apply the modification intelligently
        changes_made = []
        available_places = Place.objects.filter(city__iexact=trip.destination_city)

        mod_action = modification.get('action', 'unknown')

        if mod_action == 'swap' and modification.get('target_place'):
            # Swap a specific place
            target = modification['target_place'].lower()
            replacement_cat = modification.get('replacement_category')
            item_to_swap = None
            for item in items:
                if item.place and target in item.place.name.lower():
                    item_to_swap = item
                    break

            if item_to_swap:
                existing_ids = [i.place_id for i in items]
                candidates = available_places.exclude(id__in=existing_ids)
                if replacement_cat:
                    candidates = candidates.filter(category=replacement_cat)
                replacement = candidates.order_by('-popularity_score').first()
                if replacement:
                    old_name = item_to_swap.place.name
                    item_to_swap.place = replacement
                    item_to_swap.estimated_cost_usd = replacement.avg_cost_usd
                    item_to_swap.duration_minutes = replacement.avg_duration_minutes
                    item_to_swap.save()
                    changes_made.append(f"Swapped '{old_name}' with '{replacement.name}'")

        elif mod_action == 'add':
            # Add a new place
            existing_ids = [i.place_id for i in items]
            candidates = available_places.exclude(id__in=existing_ids)
            cat = modification.get('replacement_category')
            if cat:
                candidates = candidates.filter(category=cat)
            new_place = candidates.order_by('-popularity_score').first()
            if new_place:
                max_day = max(i.day_number for i in items) if items else 1
                target_day = modification.get('target_day') or max_day
                max_order = max((i.order for i in items if i.day_number == target_day), default=0)
                ItineraryItem.objects.create(
                    itinerary=itinerary,
                    place=new_place,
                    day_number=target_day,
                    order=max_order + 1,
                    start_time='14:00',
                    end_time='16:00',
                    duration_minutes=new_place.avg_duration_minutes,
                    estimated_cost_usd=new_place.avg_cost_usd,
                    score=new_place.popularity_score * 10,
                )
                changes_made.append(f"Added '{new_place.name}' to Day {target_day}")

        elif mod_action == 'remove' and modification.get('target_place'):
            target = modification['target_place'].lower()
            for item in items:
                if item.place and target in item.place.name.lower() and not item.is_locked:
                    changes_made.append(f"Removed '{item.place.name}' from Day {item.day_number}")
                    item.delete()
                    break

        elif mod_action in ('extend', 'shorten'):
            # Change duration of a place
            target = (modification.get('target_place') or '').lower()
            for item in items:
                if item.place and (not target or target in item.place.name.lower()):
                    old_dur = item.duration_minutes
                    if mod_action == 'extend':
                        item.duration_minutes = min(old_dur + 60, 480)
                    else:
                        item.duration_minutes = max(old_dur - 30, 30)
                    item.save()
                    changes_made.append(f"Changed '{item.place.name}' duration from {old_dur} to {item.duration_minutes} min")
                    break

        # If no structural changes, try a broad category-based swap
        if not changes_made:
            cat = modification.get('replacement_category')
            if cat:
                existing_ids = [i.place_id for i in items]
                # Find the lowest-scored unlocked item not of the desired category
                worst = None
                for item in sorted(items, key=lambda x: float(x.score)):
                    if not item.is_locked and item.place and item.place.category != cat:
                        worst = item
                        break
                replacement = (
                    available_places.exclude(id__in=existing_ids)
                    .filter(category=cat)
                    .order_by('-popularity_score')
                    .first()
                )
                if worst and replacement:
                    old_name = worst.place.name
                    worst.place = replacement
                    worst.estimated_cost_usd = replacement.avg_cost_usd
                    worst.duration_minutes = replacement.avg_duration_minutes
                    worst.save()
                    changes_made.append(f"Replaced '{old_name}' with '{replacement.name}' ({cat})")

        # Step 3: Generate AI response
        if changes_made:
            changes_text = "; ".join(changes_made)
            ai_response = llm.chat_response(
                f"I just made these changes to the user's {trip.destination_city} trip: {changes_text}. "
                f"Explain the changes positively and suggest what else they can customize.",
                trip_context,
            )
        else:
            ai_response = llm.chat_response(
                f"The user asked: '{message}' about their {trip.destination_city} trip. "
                f"I couldn't make automatic changes. Suggest what modifications are possible based on the trip context.",
                trip_context,
            )

        # Refetch updated itinerary
        updated_itinerary = ItinerarySerializer(itinerary).data

        return Response({
            'message': ai_response,
            'changes': changes_made,
            'modification': modification,
            'itinerary': updated_itinerary,
        })


class TripAIChatView(APIView):
    """General AI chat about a trip — advice, suggestions, questions."""
    permission_classes = [permissions.AllowAny]

    def post(self, request, trip_id):
        try:
            trip = Trip.objects.get(id=trip_id)
        except Trip.DoesNotExist:
            return Response({'error': 'Trip not found'}, status=404)

        message = request.data.get('message', '').strip()
        if not message:
            return Response({'error': 'Please provide a message.'}, status=400)

        # Build trip context
        itinerary = trip.itineraries.filter(is_active=True).first()
        items_list = []
        if itinerary:
            items = ItineraryItem.objects.filter(itinerary=itinerary).select_related('place').order_by('day_number', 'order')
            items_list = [
                {
                    'day': i.day_number,
                    'place': i.place.name if i.place else 'Unknown',
                    'category': i.place.category if i.place else '',
                    'cost': float(i.estimated_cost_usd),
                }
                for i in items
            ]

        trip_context = {
            'destination': trip.destination_city,
            'country': trip.destination_country,
            'days': trip.duration_days,
            'budget_usd': float(trip.budget_usd),
            'pace': trip.pace,
            'group_size': trip.group_size,
            'itinerary': items_list,
        }

        llm = LLMLayer()
        response_text = llm.chat_response(message, trip_context)
        return Response({'message': response_text})
