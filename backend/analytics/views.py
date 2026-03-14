from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated, IsAdminUser, AllowAny
from django.db.models import Sum, Count, Q
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from datetime import timedelta, date
from django.contrib.auth import get_user_model
from donations.models import Donation, PickupRequest
from .models import DailyAnalytics, UserActivity, LocationAnalytics, FoodCategoryAnalytics, PerformanceMetrics, Feedback
from .algorithms import (
    predict_food_safety_with_image,
    haversine_distance_km,
    nearest_ngos,
    prioritize_available_donations,
    recommend_ngos,
)
from .serializers import (
    DailyAnalyticsSerializer, UserActivitySerializer,
    LocationAnalyticsSerializer, FoodCategoryAnalyticsSerializer,
    PerformanceMetricsSerializer, DashboardStatsSerializer,
    ChartDataSerializer, TopDonorSerializer, TopNGOSerializer,
    FoodWasteImpactSerializer, FeedbackSerializer
)
from .models import AnalyticsManager

User = get_user_model()


def resolve_time_window(range_value):
    selected_range = (range_value or '').lower()
    if selected_range in ['7days', 'week']:
        return timezone.now() - timedelta(days=7)
    if selected_range in ['90days', 'quarter', 'year']:
        return timezone.now() - timedelta(days=90)
    if selected_range in ['30days', 'month']:
        return timezone.now() - timedelta(days=30)
    return None


def error_response(message, http_status=status.HTTP_400_BAD_REQUEST):
    return Response({'error': message}, status=http_status)


def parse_int(value, default, minimum=1, maximum=None):
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        return default

    if parsed < minimum:
        return default
    if maximum is not None:
        return min(parsed, maximum)
    return parsed


def parse_geo_payload(payload, default_limit=5):
    try:
        latitude = float(payload.get('latitude'))
        longitude = float(payload.get('longitude'))
    except (TypeError, ValueError):
        return None, error_response('latitude, longitude must be valid numbers.')

    limit = parse_int(payload.get('limit', default_limit), default_limit)
    return {
        'latitude': latitude,
        'longitude': longitude,
        'limit': limit,
    }, None

class DashboardStatsView(APIView):
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        user = request.user
        
        # Base stats for all users
        today = timezone.now().date()
        week_ago = today - timedelta(days=7)
        month_ago = today - timedelta(days=30)
        
        # Calculate overall stats
        total_donations = Donation.objects.count()
        active_donations = Donation.objects.filter(status='AVAILABLE', expiry_time__gt=timezone.now()).count()
        total_meals_saved = Donation.objects.aggregate(
            total=Sum('quantity')
        )['total'] or 0
        total_meals_saved = float(total_meals_saved) * 2.5  # 1kg = 2.5 meals
        
        # User counts
        total_users = User.objects.count()
        total_ngos = User.objects.filter(role='NGO').count()
        total_volunteers = User.objects.filter(role='VOLUNTEER').count()
        
        # Environmental impact
        food_waste_prevented = Donation.objects.aggregate(
            total=Sum('quantity')
        )['total'] or 0
        food_waste_prevented = float(food_waste_prevented)
        co2_emissions_saved = food_waste_prevented * 2.5  # 1kg food = 2.5kg CO2
        
        # Growth calculations
        week_donations = Donation.objects.filter(created_at__date__gte=week_ago).count()
        month_donations = Donation.objects.filter(created_at__date__gte=month_ago).count()
        
        previous_week_donations = Donation.objects.filter(
            created_at__date__gte=week_ago - timedelta(days=7),
            created_at__date__lt=week_ago
        ).count()
        
        previous_month_donations = Donation.objects.filter(
            created_at__date__gte=month_ago - timedelta(days=30),
            created_at__date__lt=month_ago
        ).count()
        
        weekly_growth = None
        if previous_week_donations > 0:
            weekly_growth = ((week_donations - previous_week_donations) / previous_week_donations) * 100
        
        monthly_growth = None
        if previous_month_donations > 0:
            monthly_growth = ((month_donations - previous_month_donations) / previous_month_donations) * 100
        
        stats = {
            'total_donations': total_donations,
            'active_donations': active_donations,
            'total_meals_saved': total_meals_saved,
            'active_users': total_users,
            'total_ngos': total_ngos,
            'total_volunteers': total_volunteers,
            'food_waste_prevented_kg': food_waste_prevented,
            'co2_emissions_saved': co2_emissions_saved,
            'weekly_growth': weekly_growth,
            'monthly_growth': monthly_growth
        }
        
        # Filter stats based on user role
        if user.is_donor:
            donor_donations = Donation.objects.filter(donor=user)
            donor_meals = donor_donations.aggregate(
                total=Sum('quantity')
            )['total'] or 0
            stats.update({
                'my_donations': donor_donations.count(),
                'my_active_donations': donor_donations.filter(status='AVAILABLE').count(),
                'my_completed_donations': donor_donations.filter(status='DELIVERED').count(),
                'my_total_meals_saved': float(donor_meals) * 2.5
            })
        
        elif user.is_ngo:
            ngo_pickups = PickupRequest.objects.filter(ngo=user)
            ngo_meals = ngo_pickups.filter(
                status='DELIVERED'
            ).aggregate(
                total=Sum('donation__quantity')
            )['total'] or 0
            stats.update({
                'my_pickups': ngo_pickups.count(),
                'my_completed_pickups': ngo_pickups.filter(status='DELIVERED').count(),
                'my_pending_pickups': ngo_pickups.filter(status='PENDING').count(),
                'my_total_meals_received': float(ngo_meals) * 2.5
            })
        
        elif user.is_volunteer:
            volunteer_deliveries = PickupRequest.objects.filter(volunteer=user)
            stats.update({
                'my_deliveries': volunteer_deliveries.count(),
                'my_completed_deliveries': volunteer_deliveries.filter(status='DELIVERED').count(),
                'my_active_deliveries': volunteer_deliveries.filter(status='ASSIGNED').count()
            })
        
        serializer = DashboardStatsSerializer(stats)
        return Response(serializer.data)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def donation_chart_data(request):
    """Get donation data for charts"""
    period = request.query_params.get('period', 'month')  # week, month, year
    
    if period in ['week', '7days']:
        start_date = timezone.now().date() - timedelta(days=7)
        dates = [(start_date + timedelta(days=i)) for i in range(8)]
        date_format = '%m-%d'
    elif period in ['year', '90days']:
        start_date = timezone.now().date() - timedelta(days=90)
        dates = [(start_date + timedelta(days=15 * i)) for i in range(7)]
        date_format = '%m-%d'
    elif period == '30days':
        start_date = timezone.now().date() - timedelta(days=30)
        dates = [(start_date + timedelta(days=5 * i)) for i in range(7)]
        date_format = '%m-%d'
    else:  # month
        start_date = timezone.now().date() - timedelta(days=30)
        dates = [(start_date + timedelta(days=i)) for i in range(31)]
        date_format = '%m-%d'
    
    labels = [d.strftime(date_format) for d in dates]
    donation_counts = []
    meal_counts = []
    
    for date in dates:
        count = Donation.objects.filter(created_at__date=date).count()
        meals = Donation.objects.filter(created_at__date=date).aggregate(
            total=Sum('quantity')
        )['total'] or 0
        meals *= 2.5
        
        donation_counts.append(count)
        meal_counts.append(float(meals))
    
    data = {
        'labels': labels,
        'datasets': [
            {
                'label': 'Donations',
                'data': donation_counts,
                'borderColor': 'rgb(75, 192, 192)',
                'backgroundColor': 'rgba(75, 192, 192, 0.2)',
            },
            {
                'label': 'Meals Saved',
                'data': meal_counts,
                'borderColor': 'rgb(255, 99, 132)',
                'backgroundColor': 'rgba(255, 99, 132, 0.2)',
            }
        ]
    }
    
    serializer = ChartDataSerializer(data)
    return Response(serializer.data)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def top_donors(request):
    """Get top donors by donation count and quantity"""
    limit = parse_int(request.query_params.get('limit', 10), 10)
    start_time = resolve_time_window(request.query_params.get('range'))
    donation_filter = Q(donations__isnull=False)
    if start_time is not None:
        donation_filter &= Q(donations__created_at__gte=start_time)
    
    top_donors = User.objects.filter(
        role='DONOR'
    ).annotate(
        total_donations=Count('donations', filter=donation_filter),
        total_quantity=Sum('donations__quantity', filter=donation_filter)
    ).filter(
        total_donations__gt=0
    ).order_by('-total_quantity')[:limit]
    
    data = []
    for donor in top_donors:
        data.append({
            'user_id': donor.id,
            'name': donor.full_name,
            'email': donor.email,
            'total_donations': donor.total_donations,
            'total_quantity': donor.total_quantity or 0
        })
    
    serializer = TopDonorSerializer(data, many=True)
    return Response(serializer.data)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def top_ngos(request):
    """Get top NGOs by pickup count"""
    limit = parse_int(request.query_params.get('limit', 10), 10)
    start_time = resolve_time_window(request.query_params.get('range'))
    pickup_filter = Q(ngo_pickups__isnull=False)
    if start_time is not None:
        pickup_filter &= Q(ngo_pickups__created_at__gte=start_time)
    
    top_ngos = User.objects.filter(
        role='NGO'
    ).annotate(
        total_pickups=Count('ngo_pickups', filter=pickup_filter),
        total_meals_received=Sum('ngo_pickups__donation__quantity', filter=pickup_filter)
    ).filter(
        total_pickups__gt=0
    ).order_by('-total_pickups')[:limit]
    
    data = []
    for ngo in top_ngos:
        data.append({
            'user_id': ngo.id,
            'name': ngo.full_name,
            'email': ngo.email,
            'organization_name': ngo.organization_name or '',
            'total_pickups': ngo.total_pickups,
            'total_meals_received': (ngo.total_meals_received or 0) * 2.5
        })
    
    serializer = TopNGOSerializer(data, many=True)
    return Response(serializer.data)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def food_waste_impact(request):
    """Calculate environmental impact metrics"""
    total_food_waste = Donation.objects.aggregate(
        total=Sum('quantity')
    )['total'] or 0
    
    total_co2_saved = total_food_waste * 2.5  # 1kg food = 2.5kg CO2
    
    # Environmental equivalents
    equivalent_trees_planted = int(total_co2_saved / 21)  # 1 tree absorbs 21kg CO2/year
    equivalent_car_miles = int(total_co2_saved * 2.5)  # 1kg CO2 ≈ 2.5 car miles
    people_fed = int(total_food_waste * 2.5)  # 1kg = 2.5 meals
    
    data = {
        'total_food_waste_prevented': total_food_waste,
        'total_co2_emissions_saved': total_co2_saved,
        'equivalent_trees_planted': equivalent_trees_planted,
        'equivalent_car_miles': equivalent_car_miles,
        'people_fed': people_fed
    }
    
    serializer = FoodWasteImpactSerializer(data)
    return Response(serializer.data)

class DailyAnalyticsListView(APIView):
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        period = request.query_params.get('period', 'month')
        
        if period == 'week':
            start_date = timezone.now().date() - timedelta(days=7)
            analytics = DailyAnalytics.objects.filter(date__gte=start_date)
        elif period == 'year':
            start_date = timezone.now().date() - timedelta(days=365)
            analytics = DailyAnalytics.objects.filter(date__gte=start_date)
        else:  # month
            start_date = timezone.now().date() - timedelta(days=30)
            analytics = DailyAnalytics.objects.filter(date__gte=start_date)
        
        serializer = DailyAnalyticsSerializer(analytics, many=True)
        return Response(serializer.data)

class UserActivityListView(APIView):
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        user_id = request.query_params.get('user_id')
        activity_type = request.query_params.get('activity_type')
        notification_only = (request.query_params.get('notification_only') or '').lower() in ['1', 'true', 'yes']
        limit = parse_int(request.query_params.get('limit', 50), 50)
        
        activities = UserActivity.objects.all()
        
        if user_id:
            activities = activities.filter(user_id=user_id)
        
        if activity_type:
            activities = activities.filter(activity_type=activity_type)

        if notification_only:
            activities = activities.filter(activity_type__startswith='notification_')
        
        # If not admin, only show own activities
        if not request.user.is_admin_role:
            activities = activities.filter(user=request.user)
        
        activities = activities.select_related('user').order_by('-timestamp')[:limit]
        serializer = UserActivitySerializer(activities, many=True)
        return Response(serializer.data)


class FeedbackCreateView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = FeedbackSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        feedback = serializer.save(user=request.user if request.user.is_authenticated else None)

        return Response(
            {
                'message': 'Thank you for your feedback!',
                'feedback': FeedbackSerializer(feedback).data
            },
            status=status.HTTP_201_CREATED
        )


class FeedbackListView(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request):
        limit = parse_int(request.query_params.get('limit', 100), 100, maximum=200)
        feedback_entries = Feedback.objects.select_related('user').order_by('-created_at')[:limit]
        serializer = FeedbackSerializer(feedback_entries, many=True)
        return Response(serializer.data)

@api_view(['POST'])
@permission_classes([IsAdminUser])
def calculate_analytics(request):
    """Manually trigger analytics calculation"""
    date_str = request.data.get('date')
    if date_str:
        try:
            target_date = date.fromisoformat(date_str)
        except ValueError:
            return error_response('Invalid date format. Use YYYY-MM-DD')
    else:
        target_date = None
    
    try:
        analytics = AnalyticsManager.calculate_daily_analytics(target_date)
        serializer = DailyAnalyticsSerializer(analytics)
        return Response(serializer.data)
    except Exception as exc:
        return error_response(str(exc), status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def food_safety_prediction(request):
    food_name = request.data.get('food_name', 'Unknown Food')
    cooked_time_raw = request.data.get('cooked_time')
    expiry_time_raw = request.data.get('expiry_time')
    storage_condition = request.data.get('storage_condition', 'AMBIENT')
    image_reference = request.data.get('image') or request.data.get('image_url') or ''

    if not expiry_time_raw:
        return error_response('expiry_time is required (ISO datetime).')

    expiry_time = parse_datetime(expiry_time_raw)
    if expiry_time is None:
        return error_response('Invalid expiry_time format. Use ISO datetime.')

    cooked_time = parse_datetime(cooked_time_raw) if cooked_time_raw else timezone.now()
    if cooked_time is None:
        return error_response('Invalid cooked_time format. Use ISO datetime.')

    result = predict_food_safety_with_image(cooked_time, expiry_time, storage_condition, image_reference)
    result['food_name'] = food_name
    return Response(result)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def nearest_ngo_match(request):
    geo_input, error = parse_geo_payload(request.data, default_limit=5)
    if error is not None:
        return error

    latitude = geo_input['latitude']
    longitude = geo_input['longitude']
    limit = geo_input['limit']

    ngos = nearest_ngos(latitude, longitude, limit)
    return Response({
        'origin': {'latitude': latitude, 'longitude': longitude},
        'count': len(ngos),
        'nearest_ngos': ngos,
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def donation_priority_queue(request):
    limit = parse_int(request.query_params.get('limit', 20), 20)

    ordered = prioritize_available_donations(limit)
    return Response({
        'algorithm': 'PRIORITY_QUEUE',
        'count': len(ordered),
        'prioritized_donations': ordered,
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def ngo_recommendations(request):
    geo_input, error = parse_geo_payload(request.data, default_limit=5)
    if error is not None:
        return error

    latitude = geo_input['latitude']
    longitude = geo_input['longitude']
    limit = geo_input['limit']

    recommendations = recommend_ngos(latitude, longitude, limit)
    return Response({
        'origin': {'latitude': latitude, 'longitude': longitude},
        'count': len(recommendations),
        'recommended_ngos': recommendations,
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def trigger_donation_notifications(request):
    donation_id = request.data.get('donation_id')
    if not donation_id:
        return error_response('donation_id is required.')

    try:
        donation = Donation.objects.get(id=donation_id)
    except Donation.DoesNotExist:
        return error_response('Donation not found.', status.HTTP_404_NOT_FOUND)

    if donation.donor != request.user and not request.user.is_staff:
        return error_response('Permission denied.', status.HTTP_403_FORBIDDEN)

    if donation.pickup_latitude is None or donation.pickup_longitude is None:
        return error_response('Donation location coordinates are required for proximity notifications.')

    matched_ngos = nearest_ngos(float(donation.pickup_latitude), float(donation.pickup_longitude), 10)

    volunteer_users = User.objects.filter(
        role='VOLUNTEER',
        latitude__isnull=False,
        longitude__isnull=False,
    )
    nearby_volunteers = []
    for volunteer in volunteer_users:
        distance = haversine_distance_km(
            float(donation.pickup_latitude),
            float(donation.pickup_longitude),
            float(volunteer.latitude),
            float(volunteer.longitude),
        )
        if distance <= 10:
            nearby_volunteers.append({
                'volunteer_id': volunteer.id,
                'name': volunteer.full_name,
                'email': volunteer.email,
                'distance_km': round(distance, 2),
            })

    nearby_volunteers.sort(key=lambda item: item['distance_km'])

    UserActivity.objects.create(
        user=request.user,
        activity_type='notifications_triggered',
        description=f'Notifications triggered for donation #{donation.id} ({donation.food_name})',
        metadata={
            'donation_id': donation.id,
            'matched_ngos': len(matched_ngos),
            'matched_volunteers': len(nearby_volunteers),
        }
    )

    return Response({
        'event': 'donation_created',
        'donation_id': donation.id,
        'food_name': donation.food_name,
        'notified_ngos_count': len(matched_ngos),
        'notified_volunteers_count': len(nearby_volunteers),
        'notified_ngos': matched_ngos,
        'notified_volunteers': nearby_volunteers,
    })
