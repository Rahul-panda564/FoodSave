from django.contrib import admin
from .models import DailyAnalytics, UserActivity, LocationAnalytics, FoodCategoryAnalytics, PerformanceMetrics

@admin.register(DailyAnalytics)
class DailyAnalyticsAdmin(admin.ModelAdmin):
    list_display = ['date', 'total_donations', 'total_meals_saved', 'active_donors', 'active_ngos', 'food_waste_prevented_kg']
    list_filter = ['date']
    search_fields = ['date']
    ordering = ['-date']
    readonly_fields = ['created_at', 'updated_at']

@admin.register(UserActivity)
class UserActivityAdmin(admin.ModelAdmin):
    list_display = ['user', 'activity_type', 'description', 'timestamp']
    list_filter = ['activity_type', 'timestamp']
    search_fields = ['user__email', 'user__first_name', 'user__last_name', 'description']
    ordering = ['-timestamp']

@admin.register(LocationAnalytics)
class LocationAnalyticsAdmin(admin.ModelAdmin):
    list_display = ['date', 'city', 'region', 'total_donations', 'total_meals_saved', 'high_demand_areas']
    list_filter = ['date', 'region', 'high_demand_areas']
    search_fields = ['city', 'region']
    ordering = ['-date', 'city']
    readonly_fields = ['created_at']

@admin.register(FoodCategoryAnalytics)
class FoodCategoryAnalyticsAdmin(admin.ModelAdmin):
    list_display = ['date', 'category', 'total_quantity', 'total_donations', 'average_safety_score']
    list_filter = ['date', 'category']
    search_fields = ['category__name']
    ordering = ['-date', 'category']
    readonly_fields = ['created_at']

@admin.register(PerformanceMetrics)
class PerformanceMetricsAdmin(admin.ModelAdmin):
    list_display = ['date', 'average_pickup_time_minutes', 'average_delivery_time_minutes', 'pickup_success_rate', 'delivery_success_rate']
    list_filter = ['date']
    ordering = ['-date']
    readonly_fields = ['created_at']
