"""URL configuration for The Endless Dreams."""
from django.contrib import admin
from django.urls import path, include
from django.http import JsonResponse


def healthz(_request):
    return JsonResponse({'ok': True})

urlpatterns = [
    path('healthz/', healthz, name='healthz'),
    path('admin/', admin.site.urls),
    path('api/v1/', include('api.v1.urls')),
]
