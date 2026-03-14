from django.db import models
from django.contrib.auth.models import User

class UserProfile(models.Model):
    ROLE_CHOICES = [
        ('DONOR', 'Donor'),
        ('NGO', 'NGO'),
        ('ADMIN', 'Admin'),
    ]

    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name='profile'
    )

    firebase_uid = models.CharField(max_length=200, unique=True, null=True, blank=True)
    role = models.CharField(max_length=10, choices=ROLE_CHOICES)
    phone = models.CharField(max_length=15, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.role} - {self.user.username}"

class Food(models.Model):
    donor = models.ForeignKey(
        UserProfile,
        on_delete=models.CASCADE,
        related_name='foods'
    )
    food_name = models.CharField(max_length=100)
    quantity = models.IntegerField()
    location = models.CharField(max_length=200)
    expiry_time = models.DateTimeField()
    created_at = models.DateTimeField(auto_now_add=True)
    is_collected = models.BooleanField(default=False)

    def __str__(self):
        return self.food_name
    
class PickupRequest(models.Model):
    food = models.ForeignKey(Food, on_delete=models.CASCADE)
    ngo = models.ForeignKey(UserProfile, on_delete=models.CASCADE)
    pickup_time = models.DateTimeField()
    status = models.CharField(
        max_length=20,
        default='PENDING'
    )

    def __str__(self):
        return f"Pickup for {self.food.food_name}"
    
