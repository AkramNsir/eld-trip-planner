import json
import requests
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from .hos_calculator import calculate_trip


class PlanTripView(APIView):
    """
    POST /api/plan-trip/
    Calculate HOS-compliant trip plan with stops and ELD logs.
    """
    def post(self, request):
        data = request.data
        
        required = ['current_lat', 'current_lon', 'current_location',
                    'pickup_lat', 'pickup_lon', 'pickup_location',
                    'dropoff_lat', 'dropoff_lon', 'dropoff_location',
                    'cycle_hours_used']
        
        for field in required:
            if field not in data:
                return Response(
                    {'error': f'Missing required field: {field}'},
                    status=status.HTTP_400_BAD_REQUEST
                )
        
        try:
            cycle_hours = float(data['cycle_hours_used'])
            if cycle_hours < 0 or cycle_hours > 70:
                return Response(
                    {'error': 'cycle_hours_used must be between 0 and 70'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Hard block: driver is already at or over the 70-hour limit
            if cycle_hours >= 70:
                return Response({
                    'error': 'Cycle limit reached',
                    'cycle_warning': True,
                    'cycle_warning_type': 'hard_limit',
                    'message': (
                        f'You have used all 70 hours in your 8-day cycle. '
                        f'You cannot legally drive until enough days drop off '
                        f'your rolling 8-day window, or you take a 34-hour restart '
                        f'(34 consecutive hours off-duty) to reset your cycle to 0.'
                    )
                }, status=status.HTTP_400_BAD_REQUEST)

            result = calculate_trip(
                current_lat=float(data['current_lat']),
                current_lon=float(data['current_lon']),
                current_location_name=data['current_location'],
                pickup_lat=float(data['pickup_lat']),
                pickup_lon=float(data['pickup_lon']),
                pickup_location_name=data['pickup_location'],
                dropoff_lat=float(data['dropoff_lat']),
                dropoff_lon=float(data['dropoff_lon']),
                dropoff_location_name=data['dropoff_location'],
                cycle_hours_used=cycle_hours
            )

            # Soft warning: trip will hit the cycle limit mid-way
            # We detect this by checking if a 34-hr restart was needed
            hours_remaining = 70.0 - cycle_hours
            trip_on_duty_hours = sum(
                d['total_driving'] + d['total_on_duty']
                for d in result['day_logs']
            )

            if trip_on_duty_hours > hours_remaining:
                result['cycle_warning'] = True
                result['cycle_warning_type'] = 'soft_limit'
                result['cycle_warning_message'] = (
                    f'Warning: This trip requires approximately {trip_on_duty_hours:.1f} on-duty hours, '
                    f'but you only have {hours_remaining:.1f} hours remaining in your 70-hr/8-day cycle. '
                    f'The route has been planned assuming a 34-hour restart will be taken when needed. '
                    f'Verify with your carrier before departing.'
                )
            else:
                result['cycle_warning'] = False

            return Response(result, status=status.HTTP_200_OK)
        
        except ValueError as e:
            return Response(
                {'error': f'Invalid value: {str(e)}'},
                status=status.HTTP_400_BAD_REQUEST
            )
        except Exception as e:
            return Response(
                {'error': f'Calculation error: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class GeocodeView(APIView):
    """
    GET /api/geocode/?q=city+name
    Geocode a location using Nominatim (free, no API key needed).
    """
    def get(self, request):
        query = request.query_params.get('q', '')
        if not query:
            return Response({'error': 'Query parameter q is required'}, status=400)
        
        try:
            url = 'https://nominatim.openstreetmap.org/search'
            params = {
                'q': query,
                'format': 'json',
                'limit': 5,
                'countrycodes': 'us',
            }
            headers = {'User-Agent': 'ELD-TripPlanner/1.0'}
            resp = requests.get(url, params=params, headers=headers, timeout=5)
            resp.raise_for_status()
            results = resp.json()
            
            locations = []
            for r in results:
                locations.append({
                    'name': r.get('display_name', ''),
                    'lat': float(r['lat']),
                    'lon': float(r['lon']),
                    'type': r.get('type', ''),
                })
            
            return Response({'results': locations})
        
        except requests.RequestException as e:
            return Response({'error': f'Geocoding failed: {str(e)}'}, status=503)


class HealthView(APIView):
    def get(self, request):
        return Response({'status': 'ok', 'message': 'ELD Trip Planner API running'})
