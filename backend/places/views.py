"""Place API views."""
from rest_framework import generics, filters
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
