from rest_framework import serializers
from .models import DailyAnalytics, UserActivity, LocationAnalytics, FoodCategoryAnalytics, PerformanceMetrics, Feedback

class DailyAnalyticsSerializer(serializers.ModelSerializer):
    class Meta:
        model = DailyAnalytics
        fields = [
            'date', 'total_donations', 'total_meals_saved', 'active_donors',
            'active_ngos', 'active_volunteers', 'total_pickups_completed',
            'food_waste_prevented_kg', 'co2_emissions_saved', 'created_at', 'updated_at'
        ]

class UserActivitySerializer(serializers.ModelSerializer):
    user_name = serializers.CharField(source='user.full_name', read_only=True)
    user_role = serializers.CharField(source='user.role', read_only=True)
    
    class Meta:
        model = UserActivity
        fields = [
            'id', 'user', 'user_name', 'user_role', 'activity_type',
            'description', 'metadata', 'timestamp'
        ]

class LocationAnalyticsSerializer(serializers.ModelSerializer):
    class Meta:
        model = LocationAnalytics
        fields = [
            'date', 'city', 'region', 'total_donations', 'total_meals_saved',
            'active_ngos', 'high_demand_areas', 'created_at'
        ]

class FoodCategoryAnalyticsSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source='category.name', read_only=True)
    
    class Meta:
        model = FoodCategoryAnalytics
        fields = [
            'date', 'category', 'category_name', 'total_quantity', 'total_donations',
            'average_safety_score', 'waste_prevented_kg', 'created_at'
        ]

class PerformanceMetricsSerializer(serializers.ModelSerializer):
    class Meta:
        model = PerformanceMetrics
        fields = [
            'date', 'average_pickup_time_minutes', 'average_delivery_time_minutes',
            'pickup_success_rate', 'delivery_success_rate', 'volunteer_participation_rate',
            'ngo_satisfaction_score', 'created_at'
        ]

class DashboardStatsSerializer(serializers.Serializer):
    """Serializer for dashboard statistics"""
    total_donations = serializers.IntegerField()
    active_donations = serializers.IntegerField()
    total_meals_saved = serializers.DecimalField(max_digits=10, decimal_places=2)
    active_users = serializers.IntegerField()
    total_ngos = serializers.IntegerField()
    total_volunteers = serializers.IntegerField()
    food_waste_prevented_kg = serializers.DecimalField(max_digits=10, decimal_places=2)
    co2_emissions_saved = serializers.DecimalField(max_digits=10, decimal_places=2)
    weekly_growth = serializers.DecimalField(max_digits=5, decimal_places=2, allow_null=True)
    monthly_growth = serializers.DecimalField(max_digits=5, decimal_places=2, allow_null=True)

    # Donor-specific
    my_donations = serializers.IntegerField(required=False)
    my_active_donations = serializers.IntegerField(required=False)
    my_completed_donations = serializers.IntegerField(required=False)
    my_total_meals_saved = serializers.DecimalField(max_digits=10, decimal_places=2, required=False)

    # NGO-specific
    my_pickups = serializers.IntegerField(required=False)
    my_completed_pickups = serializers.IntegerField(required=False)
    my_pending_pickups = serializers.IntegerField(required=False)
    my_total_meals_received = serializers.DecimalField(max_digits=10, decimal_places=2, required=False)

    # Volunteer-specific
    my_deliveries = serializers.IntegerField(required=False)
    my_completed_deliveries = serializers.IntegerField(required=False)
    my_active_deliveries = serializers.IntegerField(required=False)

class ChartDataSerializer(serializers.Serializer):
    """Serializer for chart data"""
    labels = serializers.ListField(child=serializers.CharField())
    datasets = serializers.ListField(child=serializers.DictField())

class TopDonorSerializer(serializers.Serializer):
    """Serializer for top donors"""
    user_id = serializers.IntegerField()
    name = serializers.CharField()
    email = serializers.EmailField()
    total_donations = serializers.IntegerField()
    total_quantity = serializers.DecimalField(max_digits=10, decimal_places=2)

class TopNGOSerializer(serializers.Serializer):
    """Serializer for top NGOs"""
    user_id = serializers.IntegerField()
    name = serializers.CharField()
    email = serializers.EmailField()
    organization_name = serializers.CharField()
    total_pickups = serializers.IntegerField()
    total_meals_received = serializers.DecimalField(max_digits=10, decimal_places=2)

class FoodWasteImpactSerializer(serializers.Serializer):
    """Serializer for food waste impact metrics"""
    total_food_waste_prevented = serializers.DecimalField(max_digits=12, decimal_places=2)
    total_co2_emissions_saved = serializers.DecimalField(max_digits=12, decimal_places=2)
    equivalent_trees_planted = serializers.IntegerField()
    equivalent_car_miles = serializers.IntegerField()
    people_fed = serializers.IntegerField()


class FeedbackSerializer(serializers.ModelSerializer):
    class Meta:
        model = Feedback
        fields = ['id', 'name', 'email', 'rating', 'message', 'created_at']
        read_only_fields = ['id', 'created_at']

    def validate_rating(self, value):
        if value < 1 or value > 5:
            raise serializers.ValidationError('Rating must be between 1 and 5.')
        return value
