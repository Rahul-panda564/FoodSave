from django.db import models
from django.conf import settings
from django.db.models import Sum, Count, Avg
from django.utils import timezone
from datetime import timedelta

class DailyAnalytics(models.Model):
    date = models.DateField(unique=True)
    total_donations = models.IntegerField(default=0)
    total_meals_saved = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    active_donors = models.IntegerField(default=0)
    active_ngos = models.IntegerField(default=0)
    active_volunteers = models.IntegerField(default=0)
    total_pickups_completed = models.IntegerField(default=0)
    food_waste_prevented_kg = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    co2_emissions_saved = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['-date']
    
    def __str__(self):
        return f"Analytics for {self.date}"

class UserActivity(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, 
        on_delete=models.CASCADE, 
        related_name='activities'
    )
    activity_type = models.CharField(max_length=50)  # donation_created, pickup_accepted, etc.
    description = models.TextField()
    metadata = models.JSONField(default=dict, blank=True)
    timestamp = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['-timestamp']
        indexes = [
            models.Index(fields=['user', 'timestamp']),
            models.Index(fields=['activity_type', 'timestamp']),
        ]
    
    def __str__(self):
        return f"{self.user.email} - {self.activity_type} at {self.timestamp}"

class Feedback(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='feedback_entries'
    )
    name = models.CharField(max_length=120)
    email = models.EmailField()
    rating = models.PositiveSmallIntegerField()
    message = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Feedback from {self.name} ({self.rating}/5)"

class LocationAnalytics(models.Model):
    date = models.DateField()
    city = models.CharField(max_length=100)
    region = models.CharField(max_length=100)
    total_donations = models.IntegerField(default=0)
    total_meals_saved = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    active_ngos = models.IntegerField(default=0)
    high_demand_areas = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        unique_together = ['date', 'city']
        ordering = ['-date', 'city']
    
    def __str__(self):
        return f"{self.city} - {self.date}"

class FoodCategoryAnalytics(models.Model):
    date = models.DateField()
    category = models.ForeignKey('donations.FoodCategory', on_delete=models.CASCADE)
    total_quantity = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    total_donations = models.IntegerField(default=0)
    average_safety_score = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    waste_prevented_kg = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        unique_together = ['date', 'category']
        ordering = ['-date', 'category']
    
    def __str__(self):
        return f"{self.category.name} - {self.date}"

class PerformanceMetrics(models.Model):
    date = models.DateField(unique=True)
    average_pickup_time_minutes = models.DecimalField(max_digits=8, decimal_places=2, default=0)
    average_delivery_time_minutes = models.DecimalField(max_digits=8, decimal_places=2, default=0)
    pickup_success_rate = models.DecimalField(max_digits=5, decimal_places=2, default=0)  # percentage
    delivery_success_rate = models.DecimalField(max_digits=5, decimal_places=2, default=0)  # percentage
    volunteer_participation_rate = models.DecimalField(max_digits=5, decimal_places=2, default=0)  # percentage
    ngo_satisfaction_score = models.DecimalField(max_digits=3, decimal_places=2, null=True, blank=True)  # 1-5 scale
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['-date']
    
    def __str__(self):
        return f"Performance Metrics for {self.date}"

class AnalyticsManager:
    @staticmethod
    def calculate_daily_analytics(date=None):
        if date is None:
            date = timezone.now().date()
        
        from donations.models import Donation, PickupRequest
        
        # Calculate donations for the day
        donations = Donation.objects.filter(created_at__date=date)
        total_donations = donations.count()
        
        # Calculate meals saved (assuming 1kg = 2.5 meals on average)
        total_meals_saved = donations.aggregate(
            total=Sum('quantity')
        )['total'] or 0
        total_meals_saved *= 2.5
        
        # Calculate active users
        active_donors = donations.values('donor').distinct().count()
        
        completed_pickups = PickupRequest.objects.filter(
            delivery_time__date=date,
            status='DELIVERED'
        )
        
        active_ngos = completed_pickups.values('ngo').distinct().count()
        active_volunteers = completed_pickups.values('volunteer').distinct().count()
        
        # Calculate food waste prevented (in kg)
        food_waste_prevented_kg = donations.aggregate(
            total=Sum('quantity')
        )['total'] or 0
        
        # Calculate CO2 emissions saved (assuming 1kg food waste = 2.5kg CO2)
        co2_emissions_saved = food_waste_prevented_kg * 2.5
        
        analytics, created = DailyAnalytics.objects.update_or_create(
            date=date,
            defaults={
                'total_donations': total_donations,
                'total_meals_saved': total_meals_saved,
                'active_donors': active_donors,
                'active_ngos': active_ngos,
                'active_volunteers': active_volunteers,
                'total_pickups_completed': completed_pickups.count(),
                'food_waste_prevented_kg': food_waste_prevented_kg,
                'co2_emissions_saved': co2_emissions_saved,
            }
        )
        
        return analytics
    
    @staticmethod
    def get_weekly_analytics():
        end_date = timezone.now().date()
        start_date = end_date - timedelta(days=7)
        
        return DailyAnalytics.objects.filter(
            date__gte=start_date,
            date__lte=end_date
        )
    
    @staticmethod
    def get_monthly_analytics():
        end_date = timezone.now().date()
        start_date = end_date - timedelta(days=30)
        
        return DailyAnalytics.objects.filter(
            date__gte=start_date,
            date__lte=end_date
        )
