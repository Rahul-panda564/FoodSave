from rest_framework import serializers
from .models import FoodCategory, Donation, PickupRequest, DeliveryRoute
from django.contrib.auth import get_user_model
from django.utils import timezone
from analytics.algorithms import predict_food_safety_with_image

User = get_user_model()


def get_distance_km_value(obj):
    return getattr(obj, 'distance_km', None)

class FoodCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = FoodCategory
        fields = ['id', 'name', 'description', 'created_at']

class DonationSerializer(serializers.ModelSerializer):
    donor_name = serializers.CharField(source='donor.full_name', read_only=True)
    category_name = serializers.CharField(source='category.name', read_only=True)
    hours_until_expiry = serializers.ReadOnlyField()
    is_available = serializers.ReadOnlyField()
    ai_prediction = serializers.SerializerMethodField()
    
    class Meta:
        model = Donation
        fields = [
            'id', 'donor', 'donor_name', 'food_name', 'category', 'category_name',
            'quantity', 'unit', 'description', 'cooked_time', 'expiry_time',
            'storage_condition', 'image', 'status', 'is_safe_for_consumption',
            'ai_safety_score', 'pickup_address', 'pickup_latitude', 'pickup_longitude',
            'hours_until_expiry', 'is_available', 'ai_prediction', 'created_at', 'updated_at'
        ]
        read_only_fields = ['donor', 'ai_safety_score', 'status', 'created_at', 'updated_at']

    def get_ai_prediction(self, obj):
        if obj.ai_safety_score is None:
            return None
        score = float(obj.ai_safety_score)
        if score >= 70:
            return 'GOOD'
        if score >= 45:
            return 'CAUTION'
        return 'NOT_GOOD'

class DonationCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Donation
        fields = [
            'food_name', 'category', 'quantity', 'unit', 'description',
            'cooked_time', 'expiry_time', 'storage_condition', 'image',
            'pickup_address', 'pickup_latitude', 'pickup_longitude'
        ]
    
    def create(self, validated_data):
        validated_data['donor'] = self.context['request'].user
        cooked_time = validated_data.get('cooked_time') or timezone.now()
        expiry_time = validated_data.get('expiry_time')
        storage_condition = validated_data.get('storage_condition', 'AMBIENT')
        image_reference = validated_data.get('image') or ''

        ai_result = predict_food_safety_with_image(
            cooked_time=cooked_time,
            expiry_time=expiry_time,
            storage_condition=storage_condition,
            image_reference=image_reference,
        )
        validated_data['ai_safety_score'] = ai_result.get('safety_score', 0)
        validated_data['is_safe_for_consumption'] = ai_result.get('prediction') != 'NOT_GOOD'

        donation = super().create(validated_data)
        
        # Log activity
        from analytics.models import UserActivity
        UserActivity.objects.create(
            user=donation.donor,
            activity_type='donation_created',
            description=f'New donation created: {donation.food_name}',
            metadata={
                'donation_id': donation.id,
                'quantity': str(donation.quantity),
                'category': donation.category.name if donation.category else None
            }
        )

        ngo_users = User.objects.filter(role='NGO', is_active=True)
        ngo_notifications = [
            UserActivity(
                user=ngo,
                activity_type='notification_donation_posted',
                description=(
                    f'New donation available: {donation.food_name} '
                    f'({donation.quantity} {donation.unit})'
                ),
                metadata={
                    'donation_id': donation.id,
                    'donor_id': donation.donor_id,
                    'donor_name': donation.donor.full_name,
                    'category': donation.category.name if donation.category else None,
                    'status': donation.status,
                }
            )
            for ngo in ngo_users
        ]
        if ngo_notifications:
            UserActivity.objects.bulk_create(ngo_notifications)
        
        return donation

    def update(self, instance, validated_data):
        updated = super().update(instance, validated_data)
        cooked_time = updated.cooked_time or timezone.now()
        expiry_time = updated.expiry_time
        storage_condition = updated.storage_condition
        image_reference = updated.image or ''

        ai_result = predict_food_safety_with_image(
            cooked_time=cooked_time,
            expiry_time=expiry_time,
            storage_condition=storage_condition,
            image_reference=image_reference,
        )
        updated.ai_safety_score = ai_result.get('safety_score', 0)
        updated.is_safe_for_consumption = ai_result.get('prediction') != 'NOT_GOOD'
        updated.save(update_fields=['ai_safety_score', 'is_safe_for_consumption'])
        return updated

class PickupRequestSerializer(serializers.ModelSerializer):
    ngo_name = serializers.CharField(source='ngo.full_name', read_only=True)
    volunteer_name = serializers.CharField(source='volunteer.full_name', read_only=True)
    donation_details = DonationSerializer(source='donation', read_only=True)
    
    class Meta:
        model = PickupRequest
        fields = [
            'id', 'donation', 'donation_details', 'ngo', 'ngo_name',
            'volunteer', 'volunteer_name', 'status', 'assigned_time',
            'pickup_time', 'delivery_time', 'notes', 'created_at', 'updated_at'
        ]
        read_only_fields = ['ngo', 'assigned_time', 'pickup_time', 'delivery_time', 'created_at', 'updated_at']

class PickupRequestCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = PickupRequest
        fields = ['donation', 'notes']
    
    def create(self, validated_data):
        validated_data['ngo'] = self.context['request'].user
        pickup_request = super().create(validated_data)
        
        # Update donation status
        pickup_request.donation.status = 'ACCEPTED'
        pickup_request.donation.save()
        
        # Log activity
        from analytics.models import UserActivity
        UserActivity.objects.create(
            user=pickup_request.ngo,
            activity_type='pickup_requested',
            description=f'Pickup requested for: {pickup_request.donation.food_name}',
            metadata={
                'pickup_request_id': pickup_request.id,
                'donation_id': pickup_request.donation.id
            }
        )

        volunteer_users = User.objects.filter(role='VOLUNTEER', is_active=True)
        volunteer_notifications = [
            UserActivity(
                user=volunteer,
                activity_type='notification_pickup_requested',
                description=(
                    f'NGO pickup request available for {pickup_request.donation.food_name}. '
                    'Review and accept if possible.'
                ),
                metadata={
                    'pickup_request_id': pickup_request.id,
                    'donation_id': pickup_request.donation.id,
                    'ngo_id': pickup_request.ngo_id,
                    'ngo_name': pickup_request.ngo.full_name,
                    'donation_food_name': pickup_request.donation.food_name,
                }
            )
            for volunteer in volunteer_users
        ]
        if volunteer_notifications:
            UserActivity.objects.bulk_create(volunteer_notifications)
        
        return pickup_request

class DeliveryRouteSerializer(serializers.ModelSerializer):
    pickup_request_details = PickupRequestSerializer(source='pickup_request', read_only=True)
    
    class Meta:
        model = DeliveryRoute
        fields = [
            'id', 'pickup_request', 'pickup_request_details',
            'pickup_latitude', 'pickup_longitude',
            'delivery_latitude', 'delivery_longitude',
            'estimated_distance', 'estimated_duration',
            'actual_distance', 'actual_duration', 'created_at'
        ]
        read_only_fields = ['created_at']

class NearbyDonationSerializer(serializers.ModelSerializer):
    donor_name = serializers.CharField(source='donor.full_name', read_only=True)
    category_name = serializers.CharField(source='category.name', read_only=True)
    distance_km = serializers.SerializerMethodField()
    
    class Meta:
        model = Donation
        fields = [
            'id', 'donor_name', 'food_name', 'category_name',
            'quantity', 'unit', 'description', 'expiry_time',
            'storage_condition', 'image', 'pickup_address',
            'pickup_latitude', 'pickup_longitude', 'distance_km',
            'hours_until_expiry', 'created_at'
        ]
    
    def get_distance_km(self, obj):
        return get_distance_km_value(obj)

class VolunteerPickupSerializer(serializers.ModelSerializer):
    donation_details = DonationSerializer(source='donation', read_only=True)
    ngo_name = serializers.CharField(source='ngo.full_name', read_only=True)
    distance_km = serializers.SerializerMethodField()
    
    class Meta:
        model = PickupRequest
        fields = [
            'id', 'donation_details', 'ngo_name', 'status', 'notes',
            'distance_km', 'created_at'
        ]
    
    def get_distance_km(self, obj):
        return get_distance_km_value(obj)
