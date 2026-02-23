from django.urls import path
from .views import PlanTripView, GeocodeView, HealthView

urlpatterns = [
    path('plan-trip/', PlanTripView.as_view(), name='plan-trip'),
    path('geocode/', GeocodeView.as_view(), name='geocode'),
    path('health/', HealthView.as_view(), name='health'),
]
