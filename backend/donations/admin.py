from django.contrib import admin
from .models import FoodCategory, Donation, PickupRequest, DeliveryRoute

@admin.register(FoodCategory)
class FoodCategoryAdmin(admin.ModelAdmin):
    list_display = ['name', 'created_at']
    search_fields = ['name']
    ordering = ['name']

@admin.register(Donation)
class DonationAdmin(admin.ModelAdmin):
    list_display = ['food_name', 'donor', 'category', 'quantity', 'unit', 'status', 'expiry_time', 'created_at']
    list_filter = ['status', 'storage_condition', 'category', 'created_at']
    search_fields = ['food_name', 'donor__email', 'donor__first_name', 'donor__last_name']
    ordering = ['-created_at']
    readonly_fields = ['created_at', 'updated_at', 'ai_safety_score']
    
    fieldsets = (
        ('Basic Information', {
            'fields': ('donor', 'food_name', 'category', 'quantity', 'unit', 'description')
        }),
        ('Time Information', {
            'fields': ('cooked_time', 'expiry_time')
        }),
        ('Storage and Safety', {
            'fields': ('storage_condition', 'image', 'is_safe_for_consumption', 'ai_safety_score')
        }),
        ('Location', {
            'fields': ('pickup_address', 'pickup_latitude', 'pickup_longitude')
        }),
        ('Status', {
            'fields': ('status',)
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at')
        }),
    )

@admin.register(PickupRequest)
class PickupRequestAdmin(admin.ModelAdmin):
    list_display = ['donation', 'ngo', 'volunteer', 'status', 'assigned_time', 'pickup_time', 'delivery_time', 'created_at']
    list_filter = ['status', 'created_at', 'assigned_time', 'pickup_time', 'delivery_time']
    search_fields = ['donation__food_name', 'ngo__email', 'ngo__organization_name', 'volunteer__email']
    ordering = ['-created_at']
    readonly_fields = ['created_at', 'updated_at']
    
    fieldsets = (
        ('Request Information', {
            'fields': ('donation', 'ngo', 'volunteer', 'status')
        }),
        ('Timeline', {
            'fields': ('assigned_time', 'pickup_time', 'delivery_time')
        }),
        ('Notes', {
            'fields': ('notes',)
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at')
        }),
    )

@admin.register(DeliveryRoute)
class DeliveryRouteAdmin(admin.ModelAdmin):
    list_display = ['pickup_request', 'estimated_distance', 'estimated_duration', 'actual_distance', 'actual_duration', 'created_at']
    list_filter = ['created_at']
    search_fields = ['pickup_request__donation__food_name', 'pickup_request__ngo__email']
    ordering = ['-created_at']
    readonly_fields = ['created_at']
