from rest_framework import serializers
import re
from django.contrib.auth import authenticate
from django.contrib.auth.password_validation import validate_password
from .models import User, PhoneOTP, Prize, PrizeRedemption


PHONE_NUMBER_REGEX = re.compile(r'^\+?1?\d{9,15}$')


def validate_matching_passwords(attrs, password_key='password', confirm_key='password_confirm', error_message="Passwords don't match."):
    if attrs.get(password_key) != attrs.get(confirm_key):
        raise serializers.ValidationError(error_message)


def normalize_phone_number(value):
    normalized = value.replace(' ', '').replace('-', '')
    if not PHONE_NUMBER_REGEX.match(normalized):
        raise serializers.ValidationError('Invalid phone number format.')
    return normalized

class UserRegistrationSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, validators=[validate_password])
    password_confirm = serializers.CharField(write_only=True)
    
    class Meta:
        model = User
        fields = [
            'email', 'username', 'first_name', 'last_name', 
            'password', 'password_confirm', 'role', 'phone_number', 
            'address', 'organization_name'
        ]
    
    def validate(self, attrs):
        validate_matching_passwords(attrs)
        
        # Check if email already exists
        if User.objects.filter(email=attrs['email']).exists():
            raise serializers.ValidationError({'email': 'This email is already registered.'})
        
        return attrs
    
    def create(self, validated_data):
        validated_data.pop('password_confirm')
        user = User.objects.create_user(**validated_data)
        return user

class UserLoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField()
    
    def validate(self, attrs):
        email = attrs.get('email')
        password = attrs.get('password')
        
        if email and password:
            user = authenticate(username=email, password=password)
            if not user:
                raise serializers.ValidationError('Invalid credentials.')
            if not user.is_active:
                raise serializers.ValidationError('User account is disabled.')
            attrs['user'] = user
        else:
            raise serializers.ValidationError('Must include email and password.')
        
        return attrs

class UserProfileSerializer(serializers.ModelSerializer):
    role = serializers.SerializerMethodField()
    full_name = serializers.ReadOnlyField()
    profile_image = serializers.SerializerMethodField()
    
    class Meta:
        model = User
        fields = [
            'id', 'email', 'username', 'first_name', 'last_name', 
            'full_name', 'role', 'phone_number', 'address', 
            'latitude', 'longitude', 'organization_name', 'profile_image',
            'is_verified', 'points_balance', 'total_points_earned', 'created_at'
        ]
        read_only_fields = ['id', 'email', 'created_at', 'is_verified']

    def get_role(self, obj):
        if obj.is_staff or obj.is_superuser:
            return 'ADMIN'
        return obj.role

    def get_profile_image(self, obj):
        if not obj.profile_image:
            return None
        request = self.context.get('request')
        if request:
            return request.build_absolute_uri(obj.profile_image.url)
        return obj.profile_image.url

class UserUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = [
            'first_name', 'last_name', 'phone_number', 'address', 
            'latitude', 'longitude', 'organization_name'
        ]

class PasswordChangeSerializer(serializers.Serializer):
    current_password = serializers.CharField(required=True)
    new_password = serializers.CharField(required=True, validators=[validate_password])
    new_password_confirm = serializers.CharField(required=True)
    
    def validate_current_password(self, value):
        user = self.context['request'].user
        if not user.check_password(value):
            raise serializers.ValidationError('Current password is incorrect.')
        return value
    
    def validate(self, attrs):
        validate_matching_passwords(
            attrs,
            password_key='new_password',
            confirm_key='new_password_confirm',
            error_message="New passwords don't match.",
        )
        return attrs
    
    def save(self):
        user = self.context['request'].user
        user.set_password(self.validated_data['new_password'])
        user.save()
        return user


class PhoneOTPSerializer(serializers.Serializer):
    """Serializer for requesting OTP via phone"""
    phone_number = serializers.CharField(max_length=20)
    
    def validate_phone_number(self, value):
        return normalize_phone_number(value)


class VerifyPhoneOTPSerializer(serializers.Serializer):
    """Serializer for verifying OTP"""
    phone_number = serializers.CharField(max_length=20)
    otp = serializers.CharField(max_length=6, min_length=6)


class PhoneRegistrationSerializer(serializers.ModelSerializer):
    """Serializer for phone-based registration"""
    otp = serializers.CharField(write_only=True, max_length=6)
    password = serializers.CharField(write_only=True, validators=[validate_password])
    password_confirm = serializers.CharField(write_only=True)
    
    class Meta:
        model = User
        fields = [
            'phone_number', 'otp', 'first_name', 'last_name',
            'password', 'password_confirm', 'role', 'email',
            'address', 'organization_name'
        ]
    
    def validate(self, attrs):
        validate_matching_passwords(attrs)
        
        phone = attrs.get('phone_number')
        otp = attrs.get('otp')
        
        # Check if phone number is already registered
        if User.objects.filter(phone_number=phone).exists():
            raise serializers.ValidationError({'phone_number': 'This phone number is already registered.'})
        
        # Verify OTP
        try:
            phone_otp = PhoneOTP.objects.get(phone_number=phone)
            is_valid, message = phone_otp.verify_otp(otp)
            if not is_valid:
                raise serializers.ValidationError({'otp': message})
        except PhoneOTP.DoesNotExist:
            raise serializers.ValidationError({'otp': 'Invalid phone number or OTP not requested.'})
        
        return attrs
    
    def create(self, validated_data):
        validated_data.pop('password_confirm')
        validated_data.pop('otp')
        validated_data['login_method'] = 'PHONE'
        validated_data['phone_verified'] = True
        
        # Generate username from phone number if email not provided
        if not validated_data.get('email'):
            validated_data['email'] = f"phone_{validated_data['phone_number']}@foodsave.local"
        
        user = User.objects.create_user(**validated_data)
        return user


class GoogleAuthSerializer(serializers.Serializer):
    """Serializer for Google authentication"""
    token = serializers.CharField(required=False, allow_blank=True)
    email = serializers.EmailField(required=False)
    first_name = serializers.CharField(max_length=150, required=False, allow_blank=True)
    last_name = serializers.CharField(max_length=150, required=False, allow_blank=True)
    mode = serializers.ChoiceField(choices=['LOGIN', 'REGISTER'], default='LOGIN')
    role = serializers.ChoiceField(choices=['DONOR', 'NGO', 'VOLUNTEER'], default='DONOR')
    phone_number = serializers.CharField(max_length=20, required=False, allow_blank=True)
    organization_name = serializers.CharField(max_length=200, required=False, allow_blank=True)

    def validate(self, attrs):
        token = attrs.get('token')
        email = attrs.get('email')
        if not token and not email:
            raise serializers.ValidationError('Either token or email is required for Google authentication.')
        return attrs


class PhoneLoginSerializer(serializers.Serializer):
    phone_number = serializers.CharField(max_length=20)
    otp = serializers.CharField(max_length=6, min_length=6)


class PrizeSerializer(serializers.ModelSerializer):
    class Meta:
        model = Prize
        fields = ['id', 'name', 'description', 'points_required', 'stock', 'is_active']


class PrizeRedemptionSerializer(serializers.ModelSerializer):
    prize_name = serializers.CharField(source='prize.name', read_only=True)

    class Meta:
        model = PrizeRedemption
        fields = ['id', 'prize', 'prize_name', 'points_spent', 'status', 'created_at']
