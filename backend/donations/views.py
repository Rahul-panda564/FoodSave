from rest_framework import status, permissions
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.pagination import PageNumberPagination
from rest_framework.parsers import MultiPartParser, FormParser
from django.db.models import Q, F
from django.utils import timezone
from django.core.files.storage import default_storage
from django.conf import settings
from datetime import timedelta
from math import radians, cos, sin, asin, sqrt
from .models import FoodCategory, Donation, PickupRequest, DeliveryRoute
from .serializers import (
    FoodCategorySerializer, DonationSerializer, DonationCreateSerializer,
    PickupRequestSerializer, PickupRequestCreateSerializer,
    DeliveryRouteSerializer, NearbyDonationSerializer,
    VolunteerPickupSerializer
)
from analytics.models import UserActivity


def can_view_all_donation_statuses(user):
    return bool(
        getattr(user, 'is_staff', False)
        or getattr(user, 'is_superuser', False)
        or getattr(user, 'is_admin_role', False)
    )


def error_response(message, code):
    return Response({'error': message}, status=code)


def donation_not_found_response():
    return error_response('Donation not found', status.HTTP_404_NOT_FOUND)


def pickup_not_found_response():
    return error_response('Pickup request not found', status.HTTP_404_NOT_FOUND)


def permission_denied_response():
    return error_response('Permission denied', status.HTTP_403_FORBIDDEN)


def expire_donations_and_notify():
    now = timezone.now()
    expired_donations = Donation.objects.filter(
        status='AVAILABLE',
        expiry_time__lte=now,
    ).select_related('donor')

    for donation in expired_donations:
        donation.status = 'EXPIRED'
        if donation.expiry_notified_at is None:
            donation.expiry_notified_at = now
            UserActivity.objects.create(
                user=donation.donor,
                activity_type='donation_expired',
                description=f'Your donation "{donation.food_name}" has expired and was removed from available listings.',
                metadata={
                    'donation_id': donation.id,
                    'expiry_time': donation.expiry_time.isoformat() if donation.expiry_time else None,
                }
            )
        donation.save(update_fields=['status', 'expiry_notified_at'])


class DonationImageUploadView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        image = request.FILES.get('image')
        if not image:
            return error_response('image file is required.', status.HTTP_400_BAD_REQUEST)

        if not image.content_type.startswith('image/'):
            return error_response('Only image uploads are allowed.', status.HTTP_400_BAD_REQUEST)

        image_path = default_storage.save(f'donation_images/{image.name}', image)
        media_url = getattr(settings, 'MEDIA_URL', '/media/')
        image_url = f'{media_url}{image_path}'.replace('\\\\', '/')
        absolute_url = request.build_absolute_uri(image_url)

        return Response({
            'image': absolute_url,
            'image_url': absolute_url,
        })

class FoodCategoryListView(APIView):
    permission_classes = [permissions.AllowAny]
    
    def get(self, request):
        categories = FoodCategory.objects.all()
        serializer = FoodCategorySerializer(categories, many=True)
        return Response(serializer.data)

class DonationListView(APIView):
    permission_classes = [IsAuthenticated]
    pagination_class = PageNumberPagination
    
    def get(self, request):
        expire_donations_and_notify()
        donations = Donation.objects.all().select_related('donor', 'category')
        can_view_all = can_view_all_donation_statuses(request.user)

        if not can_view_all:
            donations = donations.filter(status='AVAILABLE')
        
        # Filter by status if provided
        status_filter = request.query_params.get('status')
        if status_filter and can_view_all:
            donations = donations.filter(status=status_filter)
        
        # Filter by category if provided
        category_id = request.query_params.get('category')
        if category_id:
            donations = donations.filter(category_id=category_id)
        
        # Pagination
        paginator = self.pagination_class()
        page = paginator.paginate_queryset(donations, request)
        serializer = DonationSerializer(page, many=True)
        return paginator.get_paginated_response(serializer.data)
    
    def post(self, request):
        serializer = DonationCreateSerializer(data=request.data, context={'request': request})
        if serializer.is_valid():
            donation = serializer.save()
            return Response(DonationSerializer(donation).data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class DonationDetailView(APIView):
    permission_classes = [IsAuthenticated]
    
    def get_object(self, pk):
        try:
            return Donation.objects.get(pk=pk)
        except Donation.DoesNotExist:
            return None
    
    def get(self, request, pk):
        expire_donations_and_notify()
        donation = self.get_object(pk)
        if not donation:
            return donation_not_found_response()

        if (
            donation.status != 'AVAILABLE'
            and donation.donor != request.user
            and not can_view_all_donation_statuses(request.user)
        ):
            return donation_not_found_response()

        serializer = DonationSerializer(donation)
        return Response(serializer.data)
    
    def put(self, request, pk):
        donation = self.get_object(pk)
        if not donation:
            return donation_not_found_response()
        
        # Check if user owns the donation
        if donation.donor != request.user:
            return permission_denied_response()
        
        serializer = DonationCreateSerializer(donation, data=request.data, partial=True, context={'request': request})
        if serializer.is_valid():
            donation = serializer.save()
            return Response(DonationSerializer(donation).data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    def delete(self, request, pk):
        donation = self.get_object(pk)
        if not donation:
            return donation_not_found_response()
        
        # Check if user owns the donation
        if donation.donor != request.user:
            return permission_denied_response()
        
        # Only allow deletion if donation is still available
        if donation.status != 'AVAILABLE':
            return error_response('Cannot delete donation that is not available', status.HTTP_400_BAD_REQUEST)
        
        donation.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

class MyDonationsView(APIView):
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        expire_donations_and_notify()
        donations = Donation.objects.filter(donor=request.user).select_related('category')
        serializer = DonationSerializer(donations, many=True)
        return Response(serializer.data)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def nearby_donations(request):
    """Get nearby donations based on user location"""
    user_lat = request.query_params.get('latitude')
    user_lng = request.query_params.get('longitude')
    radius_km = float(request.query_params.get('radius', 10))  # Default 10km radius
    
    if not user_lat or not user_lng:
        return error_response('Latitude and longitude are required', status.HTTP_400_BAD_REQUEST)
    
    user_lat = float(user_lat)
    user_lng = float(user_lng)
    
    # Get available donations
    donations = Donation.objects.filter(
        status='AVAILABLE',
        expiry_time__gt=timezone.now()
    ).select_related('donor', 'category')
    
    # Calculate distance for each donation
    nearby_donations = []
    for donation in donations:
        if donation.pickup_latitude and donation.pickup_longitude:
            distance = calculate_distance(
                user_lat, user_lng,
                float(donation.pickup_latitude),
                float(donation.pickup_longitude)
            )
            if distance <= radius_km:
                donation.distance_km = distance
                nearby_donations.append(donation)
    
    # Sort by distance
    nearby_donations.sort(key=lambda x: x.distance_km)
    
    serializer = NearbyDonationSerializer(nearby_donations, many=True)
    return Response(serializer.data)

class PickupRequestListView(APIView):
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        user = request.user
        
        if user.is_ngo:
            pickup_requests = PickupRequest.objects.filter(
                ngo=user
            ).select_related('donation', 'volunteer')
        elif user.is_volunteer:
            declined_pending_ids = list(
                UserActivity.objects.filter(
                    user=user,
                    activity_type='pickup_declined'
                ).values_list('metadata__pickup_request_id', flat=True)
            )
            pickup_requests = PickupRequest.objects.filter(
                Q(volunteer=user) | Q(status='PENDING')
            ).exclude(
                status='PENDING',
                id__in=declined_pending_ids,
            ).select_related('donation', 'ngo')
        elif user.is_donor:
            pickup_requests = PickupRequest.objects.filter(
                donation__donor=user
            ).select_related('donation', 'ngo', 'volunteer')
        else:
            pickup_requests = PickupRequest.objects.all().select_related('donation', 'ngo', 'volunteer')
        
        serializer = PickupRequestSerializer(pickup_requests, many=True)
        return Response(serializer.data)
    
    def post(self, request):
        # Only NGOs can create pickup requests
        if not request.user.is_ngo:
            return error_response('Only NGOs can create pickup requests', status.HTTP_403_FORBIDDEN)
        
        serializer = PickupRequestCreateSerializer(data=request.data, context={'request': request})
        if serializer.is_valid():
            pickup_request = serializer.save()
            return Response(PickupRequestSerializer(pickup_request).data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class PickupRequestDetailView(APIView):
    permission_classes = [IsAuthenticated]
    
    def get_object(self, pk):
        try:
            return PickupRequest.objects.get(pk=pk)
        except PickupRequest.DoesNotExist:
            return None
    
    def get(self, request, pk):
        pickup_request = self.get_object(pk)
        if not pickup_request:
            return pickup_not_found_response()
        serializer = PickupRequestSerializer(pickup_request)
        return Response(serializer.data)
    
    def put(self, request, pk):
        pickup_request = self.get_object(pk)
        if not pickup_request:
            return pickup_not_found_response()
        
        # Check permissions
        user = request.user
        if user.is_ngo and pickup_request.ngo != user:
            return permission_denied_response()

        new_status = request.data.get('status')
        if user.is_volunteer:
            is_self_assigned = pickup_request.volunteer == user
            is_claiming_pending = (
                new_status == 'ASSIGNED' and
                pickup_request.status == 'PENDING' and
                pickup_request.volunteer is None
            )
            if not is_self_assigned and not is_claiming_pending:
                return permission_denied_response()
        
        # Handle status updates
        if new_status:
            if new_status == 'ASSIGNED' and user.is_volunteer:
                pickup_request.volunteer = user
                pickup_request.assigned_time = timezone.now()
                UserActivity.objects.create(
                    user=pickup_request.ngo,
                    activity_type='notification_pickup_accepted',
                    description=(
                        f'Volunteer {user.full_name or user.email} accepted pickup '
                        f'for {pickup_request.donation.food_name}.'
                    ),
                    metadata={
                        'pickup_request_id': pickup_request.id,
                        'volunteer_id': user.id,
                        'volunteer_name': user.full_name,
                        'donation_id': pickup_request.donation_id,
                    }
                )
            elif new_status == 'PICKED_UP' and user.is_volunteer:
                pickup_request.pickup_time = timezone.now()
                pickup_request.donation.status = 'PICKED_UP'
                pickup_request.donation.save()
            elif new_status == 'DELIVERED' and user.is_volunteer:
                pickup_request.delivery_time = timezone.now()
                pickup_request.donation.status = 'DELIVERED'
                pickup_request.donation.save()
            
            pickup_request.status = new_status
        
        # Update notes
        if 'notes' in request.data:
            pickup_request.notes = request.data['notes']
        
        pickup_request.save()
        
        # Log activity
        activity_type = f'pickup_{new_status.lower()}' if new_status else 'pickup_notes_updated'
        description = (
            f'Pickup request {new_status.lower()}: {pickup_request.donation.food_name}'
            if new_status else
            f'Pickup notes updated: {pickup_request.donation.food_name}'
        )
        UserActivity.objects.create(
            user=user,
            activity_type=activity_type,
            description=description,
            metadata={
                'pickup_request_id': pickup_request.id,
                'status': new_status,
            }
        )
        
        return Response(PickupRequestSerializer(pickup_request).data)


class PickupVolunteerDecisionView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        if not request.user.is_volunteer:
            return error_response('Only volunteers can take this action', status.HTTP_403_FORBIDDEN)

        try:
            pickup_request = PickupRequest.objects.select_related('donation', 'ngo').get(pk=pk)
        except PickupRequest.DoesNotExist:
            return pickup_not_found_response()

        decision = (request.data.get('decision') or '').upper()
        if decision not in ['ACCEPT', 'DECLINE']:
            return error_response('decision must be ACCEPT or DECLINE', status.HTTP_400_BAD_REQUEST)

        if pickup_request.status != 'PENDING' or pickup_request.volunteer is not None:
            return error_response('This pickup is no longer available for decision', status.HTTP_400_BAD_REQUEST)

        volunteer = request.user

        if decision == 'ACCEPT':
            pickup_request.status = 'ASSIGNED'
            pickup_request.volunteer = volunteer
            pickup_request.assigned_time = timezone.now()
            pickup_request.save(update_fields=['status', 'volunteer', 'assigned_time', 'updated_at'])

            UserActivity.objects.create(
                user=volunteer,
                activity_type='pickup_assigned',
                description=f'You accepted pickup for {pickup_request.donation.food_name}.',
                metadata={
                    'pickup_request_id': pickup_request.id,
                    'donation_id': pickup_request.donation_id,
                }
            )
            UserActivity.objects.create(
                user=pickup_request.ngo,
                activity_type='notification_pickup_accepted',
                description=(
                    f'Volunteer {volunteer.full_name or volunteer.email} accepted pickup '
                    f'for {pickup_request.donation.food_name}.'
                ),
                metadata={
                    'pickup_request_id': pickup_request.id,
                    'volunteer_id': volunteer.id,
                    'donation_id': pickup_request.donation_id,
                }
            )
        else:
            UserActivity.objects.create(
                user=volunteer,
                activity_type='pickup_declined',
                description=f'You declined pickup for {pickup_request.donation.food_name}.',
                metadata={
                    'pickup_request_id': pickup_request.id,
                    'donation_id': pickup_request.donation_id,
                }
            )
            UserActivity.objects.create(
                user=pickup_request.ngo,
                activity_type='notification_pickup_declined',
                description=(
                    f'Volunteer {volunteer.full_name or volunteer.email} declined pickup '
                    f'for {pickup_request.donation.food_name}.'
                ),
                metadata={
                    'pickup_request_id': pickup_request.id,
                    'volunteer_id': volunteer.id,
                    'donation_id': pickup_request.donation_id,
                }
            )

        return Response(PickupRequestSerializer(pickup_request).data)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def volunteer_pickups(request):
    """Get available pickups for volunteers"""
    user_lat = request.query_params.get('latitude')
    user_lng = request.query_params.get('longitude')
    radius_km = float(request.query_params.get('radius', 15))  # Default 15km radius
    
    # Get pending pickup requests
    pickup_requests = PickupRequest.objects.filter(
        status='PENDING'
    ).select_related('donation', 'ngo')
    
    if user_lat and user_lng:
        user_lat = float(user_lat)
        user_lng = float(user_lng)
        
        # Calculate distance for each pickup request
        available_pickups = []
        for pickup_request in pickup_requests:
            if pickup_request.donation.pickup_latitude and pickup_request.donation.pickup_longitude:
                distance = calculate_distance(
                    user_lat, user_lng,
                    float(pickup_request.donation.pickup_latitude),
                    float(pickup_request.donation.pickup_longitude)
                )
                if distance <= radius_km:
                    pickup_request.distance_km = distance
                    available_pickups.append(pickup_request)
        
        # Sort by distance
        available_pickups.sort(key=lambda x: x.distance_km)
    else:
        available_pickups = pickup_requests
    
    serializer = VolunteerPickupSerializer(available_pickups, many=True)
    return Response(serializer.data)

def calculate_distance(lat1, lon1, lat2, lon2):
    """Calculate distance between two points using Haversine formula"""
    # Convert decimal degrees to radians
    lat1, lon1, lat2, lon2 = map(radians, [lat1, lon1, lat2, lon2])
    
    # Haversine formula
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    a = sin(dlat/2)**2 + cos(lat1) * cos(lat2) * sin(dlon/2)**2
    c = 2 * asin(sqrt(a))
    
    # Radius of earth in kilometers
    r = 6371
    return c * r
