"""Place API views."""
from rest_framework import generics, filters, status
from rest_framework.response import Response
from rest_framework.views import APIView
from django_filters.rest_framework import DjangoFilterBackend
from .models import Place
from .serializers import PlaceSerializer, PlaceListSerializer


class PlaceListView(generics.ListAPIView):
    queryset = Place.objects.all()
    serializer_class = PlaceListSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['category', 'city', 'country', 'is_outdoor']
    search_fields = ['name', 'description', 'city']
    ordering_fields = ['rating', 'avg_cost_usd', 'popularity_score']


class PlaceDetailView(generics.RetrieveAPIView):
    queryset = Place.objects.prefetch_related('metrics')
    serializer_class = PlaceSerializer
    lookup_field = 'id'


class PlaceByCityView(generics.ListAPIView):
    serializer_class = PlaceListSerializer

    def get_queryset(self):
        city = self.kwargs['city']
        return Place.objects.filter(city__iexact=city)


class PlaceGeocodeView(APIView):
    """Geocode a place name using Mapbox Places API."""

    def get(self, request):
        query = request.query_params.get('q', '').strip()
        if not query:
            return Response({'error': 'q parameter required'}, status=400)

        from services.mapbox_places_service import MapboxPlacesService
        svc = MapboxPlacesService()
        results = svc.geocode(query, limit=5)
        return Response({'results': results})


class PlaceEnrichView(APIView):
    """Enrich all places in a city with accurate Mapbox coordinates."""

    def post(self, request):
        city = request.data.get('city', '').strip()
        if not city:
            return Response({'error': 'city required'}, status=400)

        from services.mapbox_places_service import MapboxPlacesService
        svc = MapboxPlacesService()
        updated = svc.enrich_city_places(city, save=True)
        total = Place.objects.filter(city__iexact=city).count()
        return Response({
            'city': city,
            'places_enriched': updated,
            'total_places': total,
        })


class DestinationCitiesView(APIView):
    """Return all unique destination cities from the places database,
    with place count and average coordinates — for the destination search."""

    def get(self, request):
        q = request.query_params.get('q', '').strip()
        try:
            from django.db.models import Count, Avg, Q
            valid_coord_q = Q(latitude__isnull=False) & Q(longitude__isnull=False) & ~Q(latitude=0) & ~Q(longitude=0)
            qs = Place.objects.values('city', 'country').annotate(
                place_count=Count('id'),
                lat=Avg('latitude', filter=valid_coord_q),
                lng=Avg('longitude', filter=valid_coord_q),
            ).order_by('-place_count')

            if q:
                qs = qs.filter(Q(city__icontains=q) | Q(country__icontains=q))

            cities = [
                {
                    'city': r['city'],
                    'country': r['country'],
                    'place_count': r['place_count'],
                    'lat': round(r['lat'], 4) if r['lat'] else 0,
                    'lng': round(r['lng'], 4) if r['lng'] else 0,
                }
                for r in qs[:100]
            ]
        except Exception as e:
            import logging
            logging.getLogger(__name__).error(f"DestinationCitiesView DB error: {e}")
            cities = []
        return Response({'cities': cities})
