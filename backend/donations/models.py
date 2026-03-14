from django.db import models
from django.conf import settings
from django.core.validators import MinValueValidator
from decimal import Decimal

class FoodCategory(models.Model):
    name = models.CharField(max_length=100, unique=True)
    description = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    def __str__(self):
        return self.name

class Donation(models.Model):
    STATUS_CHOICES = [
        ('AVAILABLE', 'Available'),
        ('ACCEPTED', 'Accepted'),
        ('PICKED_UP', 'Picked Up'),
        ('DELIVERED', 'Delivered'),
        ('EXPIRED', 'Expired'),
        ('CANCELLED', 'Cancelled'),
    ]
    
    STORAGE_CHOICES = [
        ('REFRIGERATED', 'Refrigerated'),
        ('FROZEN', 'Frozen'),
        ('AMBIENT', 'Ambient'),
        ('HOT', 'Hot'),
    ]
    
    donor = models.ForeignKey(
        settings.AUTH_USER_MODEL, 
        on_delete=models.CASCADE, 
        related_name='donations'
    )
    food_name = models.CharField(max_length=200)
    category = models.ForeignKey(FoodCategory, on_delete=models.SET_NULL, null=True)
    quantity = models.DecimalField(
        max_digits=10, 
        decimal_places=2,
        validators=[MinValueValidator(Decimal('0.01'))]
    )
    unit = models.CharField(max_length=50, default='kg')  # kg, liters, pieces, etc.
    description = models.TextField(blank=True)
    cooked_time = models.DateTimeField(null=True, blank=True)
    expiry_time = models.DateTimeField()
    storage_condition = models.CharField(max_length=20, choices=STORAGE_CHOICES)
    image = models.CharField(max_length=500, blank=True, null=True)  # URL to image
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='AVAILABLE')
    is_safe_for_consumption = models.BooleanField(default=True)
    ai_safety_score = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    expiry_notified_at = models.DateTimeField(null=True, blank=True)
    pickup_address = models.TextField()
    pickup_latitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    pickup_longitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['-created_at']
    
    def __str__(self):
        return f"{self.food_name} - {self.quantity} {self.unit}"
    
    @property
    def is_available(self):
        return self.status == 'AVAILABLE'
    
    @property
    def hours_until_expiry(self):
        from django.utils import timezone
        if self.expiry_time:
            delta = self.expiry_time - timezone.now()
            return delta.total_seconds() / 3600
        return 0

class PickupRequest(models.Model):
    STATUS_CHOICES = [
        ('PENDING', 'Pending'),
        ('ASSIGNED', 'Assigned'),
        ('PICKED_UP', 'Picked Up'),
        ('DELIVERED', 'Delivered'),
        ('CANCELLED', 'Cancelled'),
    ]
    
    donation = models.ForeignKey(Donation, on_delete=models.CASCADE, related_name='pickup_requests')
    ngo = models.ForeignKey(
        settings.AUTH_USER_MODEL, 
        on_delete=models.CASCADE, 
        related_name='ngo_pickups'
    )
    volunteer = models.ForeignKey(
        settings.AUTH_USER_MODEL, 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True,
        related_name='volunteer_pickups'
    )
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='PENDING')
    assigned_time = models.DateTimeField(null=True, blank=True)
    pickup_time = models.DateTimeField(null=True, blank=True)
    delivery_time = models.DateTimeField(null=True, blank=True)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['-created_at']
    
    def __str__(self):
        return f"Pickup for {self.donation.food_name} by {self.ngo.email}"

class DeliveryRoute(models.Model):
    pickup_request = models.OneToOneField(PickupRequest, on_delete=models.CASCADE)
    pickup_latitude = models.DecimalField(max_digits=9, decimal_places=6)
    pickup_longitude = models.DecimalField(max_digits=9, decimal_places=6)
    delivery_latitude = models.DecimalField(max_digits=9, decimal_places=6)
    delivery_longitude = models.DecimalField(max_digits=9, decimal_places=6)
    estimated_distance = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True)
    estimated_duration = models.IntegerField(null=True, blank=True)  # in minutes
    actual_distance = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True)
    actual_duration = models.IntegerField(null=True, blank=True)  # in minutes
    created_at = models.DateTimeField(auto_now_add=True)
    
    def __str__(self):
        return f"Route for {self.pickup_request}"
