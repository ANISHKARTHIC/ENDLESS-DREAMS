"""Travel URL configuration."""
from django.urls import path
from .views import (
    TravelSearchView,
    TravelOptionDetailView,
    CurrencyRatesView,
    CurrencyConvertView,
)

urlpatterns = [
    path('search/', TravelSearchView.as_view(), name='travel-search'),
    path('options/<uuid:option_id>/', TravelOptionDetailView.as_view(), name='travel-option'),
    path('currency/rates/', CurrencyRatesView.as_view(), name='currency-rates'),
    path('currency/convert/', CurrencyConvertView.as_view(), name='currency-convert'),
]
