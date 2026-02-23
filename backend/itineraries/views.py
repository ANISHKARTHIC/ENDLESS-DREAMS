"""Itinerary API views."""
from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.views import APIView
from .models import Itinerary, ItineraryItem
from .serializers import ItinerarySerializer, ItineraryItemSerializer, ItineraryItemReorderSerializer


class ItineraryDetailView(generics.RetrieveAPIView):
    queryset = Itinerary.objects.prefetch_related('items__place')
    serializer_class = ItinerarySerializer
    lookup_field = 'id'


class ItineraryByTripView(generics.ListAPIView):
    serializer_class = ItinerarySerializer

    def get_queryset(self):
        return Itinerary.objects.filter(
            trip_id=self.kwargs['trip_id']
        ).prefetch_related('items__place')


class ActiveItineraryView(APIView):
    """Get the active itinerary for a trip."""

    def get(self, request, trip_id):
        itinerary = Itinerary.objects.filter(
            trip_id=trip_id, is_active=True
        ).prefetch_related('items__place').first()

        if not itinerary:
            return Response({'error': 'No active itinerary found'}, status=404)

        return Response(ItinerarySerializer(itinerary).data)


class ItineraryItemUpdateView(generics.UpdateAPIView):
    queryset = ItineraryItem.objects.all()
    serializer_class = ItineraryItemSerializer
    lookup_field = 'id'


class ItineraryReorderView(APIView):
    """Reorder itinerary items (drag-and-drop)."""

    def post(self, request, itinerary_id):
        items = request.data.get('items', [])
        serializer = ItineraryItemReorderSerializer(data=items, many=True)
        serializer.is_valid(raise_exception=True)

        for item_data in serializer.validated_data:
            ItineraryItem.objects.filter(
                id=item_data['item_id'],
                itinerary_id=itinerary_id,
            ).update(
                day_number=item_data['day_number'],
                order=item_data['order'],
            )

        itinerary = Itinerary.objects.prefetch_related('items__place').get(id=itinerary_id)
        return Response(ItinerarySerializer(itinerary).data)


class ItineraryItemLockView(APIView):
    """Lock/unlock an itinerary item from replanning."""

    def post(self, request, item_id):
        try:
            item = ItineraryItem.objects.get(id=item_id)
        except ItineraryItem.DoesNotExist:
            return Response({'error': 'Item not found'}, status=404)

        item.is_locked = not item.is_locked
        item.save()
        return Response({'id': str(item.id), 'is_locked': item.is_locked})


class ItineraryItemStatusView(APIView):
    """Update the status of an itinerary item (for live trip day tracking)."""

    def post(self, request, item_id):
        try:
            item = ItineraryItem.objects.get(id=item_id)
        except ItineraryItem.DoesNotExist:
            return Response({'error': 'Item not found'}, status=404)

        new_status = request.data.get('status', '').strip()
        valid_statuses = ['scheduled', 'in_progress', 'completed', 'skipped', 'replanned']
        if new_status not in valid_statuses:
            return Response(
                {'error': f'Invalid status. Must be one of: {", ".join(valid_statuses)}'},
                status=400
            )

        item.status = new_status
        item.save(update_fields=['status'])
        return Response({
            'id': str(item.id),
            'status': item.status,
            'place_name': item.place.name if item.place else '',
        })
