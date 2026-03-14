from django.contrib.auth.models import AbstractUser
from django.db import models
from django.utils import timezone
import random
import string


def default_phone_otp_expiry():
    return timezone.now() + timezone.timedelta(minutes=10)

class User(AbstractUser):
    ROLE_CHOICES = [
        ('DONOR', 'Donor'),
        ('NGO', 'NGO'),
        ('VOLUNTEER', 'Volunteer'),
    ]
    
    email = models.EmailField(unique=True)
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='DONOR')
    phone_number = models.CharField(max_length=20, blank=True, null=True)
    address = models.TextField(blank=True, null=True)
    latitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    longitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    organization_name = models.CharField(max_length=200, blank=True, null=True)
    profile_image = models.ImageField(upload_to='profile_images/', blank=True, null=True)
    is_verified = models.BooleanField(default=False)
    phone_verified = models.BooleanField(default=False)
    login_method = models.CharField(
        max_length=20,
        choices=[('EMAIL', 'Email'), ('GOOGLE', 'Google'), ('PHONE', 'Phone')],
        default='EMAIL'
    )
    points_balance = models.PositiveIntegerField(default=0)
    total_points_earned = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['username', 'first_name', 'last_name']
    
    def __str__(self):
        return f"{self.email} ({self.role})"
    
    @property
    def full_name(self):
        return f"{self.first_name} {self.last_name}".strip()
    
    @property
    def is_donor(self):
        return self.role == 'DONOR'
    
    @property
    def is_ngo(self):
        return self.role == 'NGO'
    
    @property
    def is_volunteer(self):
        return self.role == 'VOLUNTEER'
    
    @property
    def is_admin_role(self):
        return self.role == 'ADMIN'


class PhoneOTP(models.Model):
    phone_number = models.CharField(max_length=20)
    otp = models.CharField(max_length=6)
    is_verified = models.BooleanField(default=False)
    attempts = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField(default=default_phone_otp_expiry)
    
    class Meta:
        unique_together = ('phone_number',)
    
    def __str__(self):
        return f"OTP for {self.phone_number}"
    
    def generate_otp(self):
        """Generate a random 6-digit OTP"""
        self.otp = ''.join(random.choices(string.digits, k=6))
        self.expires_at = timezone.now() + timezone.timedelta(minutes=10)
        self.attempts = 0
        self.save()
        return self.otp
    
    def verify_otp(self, otp):
        """Verify if the provided OTP matches and hasn't expired"""
        if timezone.now() > self.expires_at:
            return False, "OTP has expired"
        
        if self.attempts >= 3:
            return False, "Maximum attempts exceeded"
        
        self.attempts += 1
        self.save()
        
        if self.otp == otp:
            self.is_verified = True
            self.save()
            return True, "OTP verified successfully"
        
        return False, "Invalid OTP"


class Prize(models.Model):
    name = models.CharField(max_length=150)
    description = models.TextField(blank=True)
    points_required = models.PositiveIntegerField()
    stock = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['points_required', 'name']

    def __str__(self):
        return f"{self.name} ({self.points_required} pts)"


class PrizeRedemption(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='prize_redemptions')
    prize = models.ForeignKey(Prize, on_delete=models.CASCADE, related_name='redemptions')
    points_spent = models.PositiveIntegerField()
    status = models.CharField(max_length=20, default='COMPLETED')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.user.email} redeemed {self.prize.name}"


class LeaderboardAward(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='leaderboard_awards')
    rank = models.PositiveSmallIntegerField()
    points_awarded = models.PositiveIntegerField()
    contribution_score = models.PositiveIntegerField(default=0)
    award_date = models.DateField(default=timezone.localdate)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-award_date', 'rank']
        unique_together = ('award_date', 'rank')

    def __str__(self):
        return f"{self.award_date} rank {self.rank}: {self.user.email}"
