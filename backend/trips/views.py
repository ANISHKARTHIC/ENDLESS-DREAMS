"""Trip API views."""
import json
import logging
import time
import uuid
from datetime import datetime
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from django.http import HttpResponse
from .models import Trip, TripNote, TripChecklist, ChecklistItem, TripExpense, TripPhoto, TripShare, TripCollaborator, SavedPlace
from .serializers import (
    TripSerializer, TripListSerializer, TripCreateSerializer,
    TripNoteSerializer, TripChecklistSerializer, ChecklistItemSerializer,
    TripExpenseSerializer, TripPhotoSerializer, TripShareSerializer,
    TripCollaboratorSerializer, SavedPlaceSerializer,
)
from itineraries.models import Itinerary, ItineraryItem
from itineraries.serializers import ItinerarySerializer
from ai_engine.scoring import ScoringEngine
from ai_engine.optimizer import RouteOptimizer
from ai_engine.health import TripHealthCalculator
from ai_engine.llm_layer import LLMLayer
from places.models import Place
from services.accommodation_service import AccommodationService
from services.booking_insights_service import BookingInsightsService
from services.place_discovery_service import PlaceDiscoveryService

logger = logging.getLogger('trips')


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

        # Deduct travel cost from budget if a travel option was selected
        if trip.selected_travel_option:
            from decimal import Decimal
            travel_cost_usd = float(trip.selected_travel_option.price_usd) if trip.selected_travel_option.price_usd else float(trip.selected_travel_option.price_inr) / 83.5
            trip.budget_spent_usd += Decimal(str(round(travel_cost_usd, 2)))

        trip.save()

        # Fetch candidate places
        places = Place.objects.filter(
            city__iexact=data['destination_city']
        ).prefetch_related('metrics')

        # AI-powered place discovery: if no seeded places exist, discover dynamically
        if not places.exists():
            logger.info(f"No seeded places for {data['destination_city']} — using AI discovery")
            discovery = PlaceDiscoveryService()
            discovered = discovery.discover_places(
                city=data['destination_city'],
                country=data['destination_country'],
                max_places=25,
            )
            if discovered:
                # Re-query to get the QuerySet with prefetch
                places = Place.objects.filter(
                    city__iexact=data['destination_city']
                ).prefetch_related('metrics')

        if not places.exists():
            return Response(
                {'error': f"Could not find or discover places for {data['destination_city']}. Please try another city."},
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

        # Deduct accommodation cost from budget
        from decimal import Decimal
        accommodation_cost = accommodation[0]['total_cost_usd'] if accommodation else 0
        if accommodation_cost:
            trip.budget_spent_usd += Decimal(str(round(float(accommodation_cost), 2)))

        # Also add up itinerary activity costs
        total_activity_cost = sum(item.get('estimated_cost_usd', 0) for item in itinerary_items)
        if total_activity_cost:
            trip.budget_spent_usd += Decimal(str(round(total_activity_cost, 2)))

        trip.save()

        # Booking insights
        insights_service = BookingInsightsService()
        travel_cost = 0
        if trip.selected_travel_option:
            travel_cost = float(trip.selected_travel_option.price_usd) if trip.selected_travel_option.price_usd else float(trip.selected_travel_option.price_inr) / 83.5

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


class DestinationRecommendationView(APIView):
    """Get price / days / breakdown recommendations for a destination city."""
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        city = request.query_params.get('city', '').strip()
        if not city:
            return Response({'error': 'city query param required'}, status=400)

        from trips.recommendation_service import get_destination_recommendations
        data = get_destination_recommendations(city)
        return Response(data)


# ═══════════ Trip Notes ═══════════

class TripNoteListCreateView(generics.ListCreateAPIView):
    """List/create notes for a trip."""
    serializer_class = TripNoteSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        return TripNote.objects.filter(trip_id=self.kwargs['trip_id'])

    def perform_create(self, serializer):
        serializer.save(trip_id=self.kwargs['trip_id'])


class TripNoteDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = TripNoteSerializer
    permission_classes = [permissions.AllowAny]
    lookup_field = 'id'

    def get_queryset(self):
        return TripNote.objects.all()


# ═══════════ Checklists ═══════════

class TripChecklistListCreateView(generics.ListCreateAPIView):
    serializer_class = TripChecklistSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        return TripChecklist.objects.filter(trip_id=self.kwargs['trip_id']).prefetch_related('items')

    def perform_create(self, serializer):
        cl = serializer.save(trip_id=self.kwargs['trip_id'])
        # Create default packing items if it's a packing list
        if 'packing' in cl.title.lower():
            defaults = [
                'Passport / ID', 'Phone charger', 'Clothes for {days} days',
                'Toiletries', 'Medications', 'Travel adapter', 'Sunscreen',
                'Comfortable shoes', 'Reusable water bottle', 'Snacks',
            ]
            for i, text in enumerate(defaults):
                text = text.replace('{days}', str(cl.trip.duration_days))
                ChecklistItem.objects.create(checklist=cl, text=text, order=i)


class ChecklistItemCreateView(generics.CreateAPIView):
    serializer_class = ChecklistItemSerializer
    permission_classes = [permissions.AllowAny]

    def perform_create(self, serializer):
        serializer.save(checklist_id=self.kwargs['checklist_id'])


class ChecklistItemUpdateView(generics.UpdateAPIView):
    serializer_class = ChecklistItemSerializer
    permission_classes = [permissions.AllowAny]
    lookup_field = 'id'
    queryset = ChecklistItem.objects.all()


class ChecklistItemDeleteView(generics.DestroyAPIView):
    permission_classes = [permissions.AllowAny]
    lookup_field = 'id'
    queryset = ChecklistItem.objects.all()


class ChecklistToggleAllView(APIView):
    """Toggle all items checked/unchecked."""
    permission_classes = [permissions.AllowAny]

    def post(self, request, checklist_id):
        items = ChecklistItem.objects.filter(checklist_id=checklist_id)
        all_checked = all(i.checked for i in items)
        items.update(checked=not all_checked)
        return Response({'checked': not all_checked, 'count': items.count()})


# ═══════════ Expenses ═══════════

class TripExpenseListCreateView(generics.ListCreateAPIView):
    serializer_class = TripExpenseSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        return TripExpense.objects.filter(trip_id=self.kwargs['trip_id'])

    def perform_create(self, serializer):
        expense = serializer.save(trip_id=self.kwargs['trip_id'])
        # Update budget_spent on trip
        trip = Trip.objects.get(id=self.kwargs['trip_id'])
        from django.db.models import Sum
        total = trip.expenses.aggregate(Sum('amount_usd'))['amount_usd__sum'] or 0
        trip.budget_spent_usd = total
        trip.save(update_fields=['budget_spent_usd'])


class TripExpenseDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = TripExpenseSerializer
    permission_classes = [permissions.AllowAny]
    lookup_field = 'id'
    queryset = TripExpense.objects.all()

    def perform_destroy(self, instance):
        trip = instance.trip
        instance.delete()
        from django.db.models import Sum
        total = trip.expenses.aggregate(Sum('amount_usd'))['amount_usd__sum'] or 0
        trip.budget_spent_usd = total
        trip.save(update_fields=['budget_spent_usd'])


class TripExpenseSummaryView(APIView):
    """Aggregated expense summary."""
    permission_classes = [permissions.AllowAny]

    def get(self, request, trip_id):
        from django.db.models import Sum
        trip = Trip.objects.get(id=trip_id)
        expenses = TripExpense.objects.filter(trip_id=trip_id)
        total = expenses.aggregate(Sum('amount_usd'))['amount_usd__sum'] or 0

        by_category = {}
        for cat, label in TripExpense.CATEGORY_CHOICES:
            cat_total = expenses.filter(category=cat).aggregate(Sum('amount_usd'))['amount_usd__sum'] or 0
            by_category[cat] = {'label': label, 'amount': float(cat_total)}

        by_day = {}
        for exp in expenses:
            day = exp.day_number or 0
            by_day.setdefault(day, 0)
            by_day[day] += float(exp.amount_usd)

        days = trip.duration_days or 1
        return Response({
            'total_spent': float(total),
            'budget_usd': float(trip.budget_usd),
            'remaining': float(trip.budget_usd) - float(total),
            'by_category': by_category,
            'by_day': by_day,
            'daily_average': round(float(total) / days, 2),
        })


# ═══════════ Photos ═══════════

class TripPhotoListCreateView(generics.ListCreateAPIView):
    serializer_class = TripPhotoSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        return TripPhoto.objects.filter(trip_id=self.kwargs['trip_id'])

    def perform_create(self, serializer):
        serializer.save(trip_id=self.kwargs['trip_id'])


class TripPhotoDeleteView(generics.DestroyAPIView):
    permission_classes = [permissions.AllowAny]
    lookup_field = 'id'
    queryset = TripPhoto.objects.all()


# ═══════════ Trip Sharing ═══════════

class TripShareCreateView(APIView):
    """Create a shareable link for a trip."""
    permission_classes = [permissions.AllowAny]

    def post(self, request, trip_id):
        import secrets
        trip = Trip.objects.get(id=trip_id)
        permission = request.data.get('permission', 'view')
        share = TripShare.objects.create(
            trip=trip,
            share_code=secrets.token_urlsafe(16),
            permission=permission,
            created_by=request.user if request.user.is_authenticated else None,
        )
        return Response(TripShareSerializer(share).data, status=status.HTTP_201_CREATED)


class SharedTripView(APIView):
    """Public endpoint to view a shared trip via share code."""
    permission_classes = [permissions.AllowAny]

    def get(self, request, share_code):
        try:
            share = TripShare.objects.get(share_code=share_code, is_active=True)
        except TripShare.DoesNotExist:
            return Response({'error': 'Share link not found or expired'}, status=404)

        trip = share.trip
        itinerary = trip.itineraries.filter(is_active=True).first()
        itinerary_data = ItinerarySerializer(itinerary).data if itinerary else None
        photos = TripPhotoSerializer(trip.photos.all(), many=True).data
        notes = TripNoteSerializer(trip.notes.all(), many=True).data if share.permission != 'view' else []

        return Response({
            'trip': TripSerializer(trip).data,
            'itinerary': itinerary_data,
            'photos': photos,
            'notes': notes,
            'permission': share.permission,
        })


# ═══════════ Saved Places (Wishlist) ═══════════

class SavedPlaceListCreateView(generics.ListCreateAPIView):
    serializer_class = SavedPlaceSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return SavedPlace.objects.filter(user=self.request.user).select_related('place')

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class SavedPlaceDeleteView(generics.DestroyAPIView):
    permission_classes = [permissions.IsAuthenticated]
    lookup_field = 'id'

    def get_queryset(self):
        return SavedPlace.objects.filter(user=self.request.user)


# ═══════════ Explore — Popular Destinations ═══════════

class ExploreDestinationsView(APIView):
    """Return curated destination data for the Explore page."""
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        from django.db.models import Count, Avg
        from services.unsplash_service import UnsplashService

        category = request.query_params.get('category', '')
        search = request.query_params.get('q', '').strip()

        cities = Place.objects.values('city', 'country').annotate(
            place_count=Count('id'),
            avg_rating=Avg('rating'),
        ).filter(place_count__gte=3).order_by('-avg_rating')

        if search:
            cities = cities.filter(city__icontains=search)

        if category:
            cities = Place.objects.filter(category=category).values('city', 'country').annotate(
                place_count=Count('id'),
                avg_rating=Avg('rating'),
            ).filter(place_count__gte=1).order_by('-avg_rating')

        unsplash = UnsplashService()
        results = []
        for c in cities[:30]:
            # Get top categories for this city
            cats = (
                Place.objects.filter(city=c['city'])
                .values('category')
                .annotate(count=Count('id'))
                .order_by('-count')[:4]
            )
            cat_list = [cat['category'] for cat in cats]

            # Get a representative image — try Unsplash first, then DB
            image_url = None
            if unsplash.is_configured:
                photo = unsplash.get_city_photo(c['city'], c['country'])
                if photo:
                    image_url = photo.get('url_regular') or photo.get('url_small')
            if not image_url:
                img_place = Place.objects.filter(city=c['city'], image_url__isnull=False).exclude(image_url='').first()
                image_url = img_place.image_url if img_place else None

            # Estimate budget range
            avg_cost = Place.objects.filter(city=c['city']).aggregate(Avg('avg_cost_usd'))['avg_cost_usd__avg'] or 30
            daily_budget = float(avg_cost) * 4  # rough: 4 activities per day

            results.append({
                'city': c['city'],
                'country': c['country'],
                'place_count': c['place_count'],
                'avg_rating': round(c['avg_rating'], 1),
                'categories': cat_list,
                'image_url': image_url,
                'daily_budget_usd': round(daily_budget, 0),
            })

        return Response({'destinations': results})


# ═══════════ Unsplash Photos for Destinations ═══════════

class UnsplashPhotosView(APIView):
    """Fetch Unsplash photos for a city or place."""
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        from services.unsplash_service import UnsplashService

        query = request.query_params.get('q', '').strip()
        city = request.query_params.get('city', '').strip()
        place = request.query_params.get('place', '').strip()
        count = min(int(request.query_params.get('count', '4')), 10)

        unsplash = UnsplashService()
        if not unsplash.is_configured:
            return Response({'photos': [], 'error': 'Unsplash not configured'})

        if query:
            photos = unsplash.search_photos(query, per_page=count)
        elif place and city:
            photos = unsplash.search_photos(f'{place} {city} travel', per_page=count)
        elif city:
            photos = unsplash.get_destination_photos(city, count=count)
        else:
            return Response({'photos': [], 'error': 'Provide q, city, or place parameter'})

        return Response({'photos': photos})


# ═══════════ PDF Export ═══════════

class TripPDFExportView(APIView):
    """Generate a PDF of the trip itinerary."""
    permission_classes = [permissions.AllowAny]

    def get(self, request, trip_id):
        try:
            trip = Trip.objects.get(id=trip_id)
        except Trip.DoesNotExist:
            return Response({'error': 'Trip not found'}, status=404)

        itinerary = trip.itineraries.filter(is_active=True).first()
        items = itinerary.items.select_related('place').order_by('day_number', 'order') if itinerary else []

        # Build PDF as text content (lightweight — no external PDF lib needed)
        # We generate a rich HTML document that browsers can print/save as PDF
        html = self._build_pdf_html(trip, items)

        response = HttpResponse(html, content_type='text/html')
        response['Content-Disposition'] = f'inline; filename="trip-{trip.destination_city}-itinerary.html"'
        return response

    def _build_pdf_html(self, trip, items):
        """Build a printable HTML itinerary."""
        days = {}
        for item in items:
            days.setdefault(item.day_number, []).append(item)

        day_rows = ''
        for day_num in sorted(days.keys()):
            day_items = days[day_num]
            day_rows += f'''
            <div class="day-section">
                <h2 class="day-header">Day {day_num}</h2>
                <div class="items">'''
            for item in day_items:
                place = item.place
                day_rows += f'''
                    <div class="item">
                        <div class="time">{item.start_time or ''} - {item.end_time or ''}</div>
                        <div class="details">
                            <h3>{place.name if place else 'Unknown'}</h3>
                            <p class="category">{place.category if place else ''} · {item.duration_minutes} min</p>
                            <p class="desc">{place.description[:120] if place and place.description else ''}</p>
                            {f'<p class="cost">${float(item.estimated_cost_usd):.0f}</p>' if item.estimated_cost_usd else ''}
                        </div>
                    </div>'''
            day_rows += '</div></div>'

        # Calculate totals
        total_cost = sum(float(i.estimated_cost_usd or 0) for i in items)
        total_activities = len(items)

        return f'''<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{trip.destination_city} Trip Itinerary - Endless Dreams</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
  * {{ margin: 0; padding: 0; box-sizing: border-box; }}
  body {{ font-family: 'Inter', sans-serif; color: #1a1a2e; background: #fff; padding: 40px; max-width: 800px; margin: 0 auto; }}
  .header {{ text-align: center; margin-bottom: 40px; padding-bottom: 24px; border-bottom: 2px solid #0ea5e9; }}
  .header .logo {{ font-size: 12px; letter-spacing: 3px; text-transform: uppercase; color: #0ea5e9; margin-bottom: 8px; }}
  .header h1 {{ font-size: 32px; font-weight: 700; color: #1a1a2e; margin-bottom: 4px; }}
  .header .subtitle {{ color: #6b7280; font-size: 14px; }}
  .meta {{ display: flex; justify-content: center; gap: 24px; margin-top: 16px; flex-wrap: wrap; }}
  .meta span {{ font-size: 13px; color: #6b7280; }}
  .meta strong {{ color: #1a1a2e; }}
  .stats {{ display: flex; justify-content: center; gap: 32px; margin: 24px 0 32px; padding: 16px; background: #f5f7fa; border-radius: 12px; }}
  .stats .stat {{ text-align: center; }}
  .stats .stat-value {{ font-size: 24px; font-weight: 700; color: #0ea5e9; }}
  .stats .stat-label {{ font-size: 11px; color: #6b7280; text-transform: uppercase; letter-spacing: 1px; }}
  .day-section {{ margin-bottom: 32px; page-break-inside: avoid; }}
  .day-header {{ font-size: 18px; font-weight: 600; color: #0ea5e9; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 1px solid #e5e7eb; }}
  .items {{ display: flex; flex-direction: column; gap: 12px; }}
  .item {{ display: flex; gap: 16px; padding: 12px; border: 1px solid #e5e7eb; border-radius: 10px; }}
  .item .time {{ font-size: 12px; font-weight: 500; color: #0ea5e9; min-width: 100px; padding-top: 2px; }}
  .item .details h3 {{ font-size: 15px; font-weight: 600; }}
  .item .details .category {{ font-size: 12px; color: #6b7280; margin-top: 2px; text-transform: capitalize; }}
  .item .details .desc {{ font-size: 12px; color: #9ca3af; margin-top: 4px; }}
  .item .details .cost {{ font-size: 12px; font-weight: 500; color: #059669; margin-top: 4px; }}
  .footer {{ margin-top: 40px; text-align: center; font-size: 11px; color: #9ca3af; padding-top: 16px; border-top: 1px solid #e5e7eb; }}
  @media print {{ body {{ padding: 20px; }} .day-section {{ page-break-inside: avoid; }} }}
</style>
</head>
<body>
  <div class="header">
    <div class="logo">✈ Endless Dreams</div>
    <h1>{trip.destination_city}, {trip.destination_country}</h1>
    <div class="subtitle">{trip.title or 'AI-Generated Itinerary'}</div>
    <div class="meta">
      <span>📅 <strong>{trip.start_date} → {trip.end_date}</strong></span>
      <span>⏱ <strong>{trip.duration_days} days</strong></span>
      <span>👥 <strong>{trip.group_size} travelers</strong></span>
      <span>🎯 <strong>{trip.pace} pace</strong></span>
    </div>
  </div>
  <div class="stats">
    <div class="stat">
      <div class="stat-value">{total_activities}</div>
      <div class="stat-label">Activities</div>
    </div>
    <div class="stat">
      <div class="stat-value">{trip.duration_days}</div>
      <div class="stat-label">Days</div>
    </div>
    <div class="stat">
      <div class="stat-value">${total_cost:.0f}</div>
      <div class="stat-label">Est. Cost</div>
    </div>
    <div class="stat">
      <div class="stat-value">${float(trip.budget_usd):.0f}</div>
      <div class="stat-label">Budget</div>
    </div>
  </div>
  {day_rows}
  <div class="footer">
    Generated by The Endless Dreams · AI Travel Intelligence · {datetime.now().strftime('%B %d, %Y')}
  </div>
</body>
</html>'''
