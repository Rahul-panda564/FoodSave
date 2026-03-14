from rest_framework import status, permissions
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from django.db import transaction
from django.db.models import Count, Q, F, IntegerField, ExpressionWrapper
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import get_user_model
from django.conf import settings
from django.utils import timezone
from datetime import datetime
from .serializers import (
    UserRegistrationSerializer, UserLoginSerializer, 
    UserProfileSerializer, UserUpdateSerializer, 
    PasswordChangeSerializer, PhoneOTPSerializer,
    VerifyPhoneOTPSerializer, PhoneRegistrationSerializer,
    PhoneLoginSerializer,
    GoogleAuthSerializer, PrizeSerializer, PrizeRedemptionSerializer
)
from .models import PhoneOTP, Prize, PrizeRedemption, LeaderboardAward
from analytics.models import UserActivity
from twilio.rest import Client

User = get_user_model()

LEADERBOARD_POINTS_RULES = {
    1: 100,
    2: 60,
    3: 30,
}


def is_admin_user(user):
    return bool(
        getattr(user, 'is_staff', False)
        or getattr(user, 'is_superuser', False)
        or getattr(user, 'is_admin_role', False)
    )


def get_leaderboard_queryset():
    base_qs = User.objects.filter(
        is_active=True,
        role__in=['DONOR', 'NGO', 'VOLUNTEER'],
    ).annotate(
        delivered_donations=Count('donations', filter=Q(donations__status='DELIVERED'), distinct=True),
        ngo_completed_pickups=Count('ngo_pickups', filter=Q(ngo_pickups__status='DELIVERED'), distinct=True),
        volunteer_completed_pickups=Count('volunteer_pickups', filter=Q(volunteer_pickups__status='DELIVERED'), distinct=True),
    ).annotate(
        contribution_score=ExpressionWrapper(
            F('delivered_donations') + F('ngo_completed_pickups') + F('volunteer_completed_pickups'),
            output_field=IntegerField(),
        )
    )

    return base_qs.order_by('-contribution_score', '-points_balance', '-date_joined', 'id')


def build_auth_success_response(user, request, http_status=status.HTTP_200_OK):
    refresh = RefreshToken.for_user(user)
    return Response({
        'user': UserProfileSerializer(user, context={'request': request}).data,
        'refresh': str(refresh),
        'access': str(refresh.access_token),
    }, status=http_status)


def error_response(message, http_status=status.HTTP_400_BAD_REQUEST):
    return Response({'error': message}, status=http_status)

class RegisterView(APIView):
    permission_classes = [permissions.AllowAny]
    
    def post(self, request):
        serializer = UserRegistrationSerializer(data=request.data)
        if serializer.is_valid():
            user = serializer.save()
            
            # Log activity
            UserActivity.objects.create(
                user=user,
                activity_type='user_registered',
                description=f'New user registered: {user.email} ({user.role})',
                metadata={'role': user.role}
            )
            
            return build_auth_success_response(user, request, http_status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class LoginView(APIView):
    permission_classes = [permissions.AllowAny]
    
    def post(self, request):
        serializer = UserLoginSerializer(data=request.data)
        if serializer.is_valid():
            user = serializer.validated_data['user']
            
            # Log activity
            UserActivity.objects.create(
                user=user,
                activity_type='user_login',
                description=f'User logged in: {user.email}',
                metadata={'role': user.role}
            )
            
            return build_auth_success_response(user, request)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class ProfileView(APIView):
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        serializer = UserProfileSerializer(request.user, context={'request': request})
        return Response(serializer.data)
    
    def put(self, request):
        serializer = UserUpdateSerializer(request.user, data=request.data, partial=True)
        if serializer.is_valid():
            user = serializer.save()
            
            # Log activity
            UserActivity.objects.create(
                user=user,
                activity_type='profile_updated',
                description=f'User profile updated: {user.email}',
                metadata={'updated_fields': list(request.data.keys())}
            )
            
            return Response(UserProfileSerializer(user, context={'request': request}).data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class UploadProfileImageView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        profile_image = request.FILES.get('profile_image')
        if not profile_image:
            return error_response('profile_image is required')

        request.user.profile_image = profile_image
        request.user.save(update_fields=['profile_image'])

        UserActivity.objects.create(
            user=request.user,
            activity_type='profile_updated',
            description=f'User profile image updated: {request.user.email}',
            metadata={'updated_fields': ['profile_image']}
        )

        image_url = request.build_absolute_uri(request.user.profile_image.url) if request.user.profile_image else None
        return Response({'profile_image': image_url}, status=status.HTTP_200_OK)

    def delete(self, request):
        if not request.user.profile_image:
            return Response({'message': 'No profile image to remove.'}, status=status.HTTP_200_OK)

        request.user.profile_image.delete(save=False)
        request.user.profile_image = None
        request.user.save(update_fields=['profile_image'])

        UserActivity.objects.create(
            user=request.user,
            activity_type='profile_updated',
            description=f'User profile image removed: {request.user.email}',
            metadata={'updated_fields': ['profile_image']}
        )

        return Response({'message': 'Profile image removed successfully.', 'profile_image': None}, status=status.HTTP_200_OK)

class ChangePasswordView(APIView):
    permission_classes = [IsAuthenticated]
    
    def post(self, request):
        serializer = PasswordChangeSerializer(data=request.data, context={'request': request})
        if serializer.is_valid():
            serializer.save()
            
            # Log activity
            UserActivity.objects.create(
                user=request.user,
                activity_type='password_changed',
                description=f'Password changed for user: {request.user.email}',
            )
            
            return Response({'message': 'Password changed successfully'})
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class LogoutView(APIView):
    permission_classes = [IsAuthenticated]
    
    def post(self, request):
        try:
            refresh_token = request.data.get('refresh')
            if refresh_token:
                token = RefreshToken(refresh_token)
                token.blacklist()
            
            # Log activity
            UserActivity.objects.create(
                user=request.user,
                activity_type='user_logout',
                description=f'User logged out: {request.user.email}',
            )
            
            return Response({'message': 'Successfully logged out'})
        except Exception as exc:
            return error_response(str(exc))

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def user_stats(request):
    """Get user-specific statistics"""
    user = request.user
    stats = {}
    
    if user.is_donor:
        from donations.models import Donation
        stats['total_donations'] = Donation.objects.filter(donor=user).count()
        stats['active_donations'] = Donation.objects.filter(donor=user, status='AVAILABLE').count()
        stats['completed_donations'] = Donation.objects.filter(donor=user, status='DELIVERED').count()
    
    elif user.is_ngo:
        from donations.models import PickupRequest
        stats['total_pickups'] = PickupRequest.objects.filter(ngo=user).count()
        stats['completed_pickups'] = PickupRequest.objects.filter(ngo=user, status='DELIVERED').count()
        stats['pending_pickups'] = PickupRequest.objects.filter(ngo=user, status='PENDING').count()
    
    elif user.is_volunteer:
        from donations.models import PickupRequest
        stats['total_deliveries'] = PickupRequest.objects.filter(volunteer=user).count()
        stats['completed_deliveries'] = PickupRequest.objects.filter(volunteer=user, status='DELIVERED').count()
        stats['active_deliveries'] = PickupRequest.objects.filter(volunteer=user, status='ASSIGNED').count()
    
    return Response(stats)


class SendPhoneOTPView(APIView):
    permission_classes = [permissions.AllowAny]
    
    def post(self, request):
        serializer = PhoneOTPSerializer(data=request.data)
        if serializer.is_valid():
            phone_number = serializer.validated_data['phone_number']
            purpose = str(request.data.get('purpose', 'REGISTER')).upper()
            
            user_exists = User.objects.filter(phone_number=phone_number).exists()
            if purpose == 'REGISTER' and user_exists:
                return error_response('This phone number is already registered.')
            if purpose == 'LOGIN' and not user_exists:
                return error_response('No account found with this phone number.')
            
            # Get or create PhoneOTP record
            phone_otp, _ = PhoneOTP.objects.get_or_create(phone_number=phone_number)
            otp = phone_otp.generate_otp()

            twilio_configured = all([
                settings.TWILIO_ACCOUNT_SID,
                settings.TWILIO_AUTH_TOKEN,
                settings.TWILIO_PHONE_NUMBER,
            ])
            
            # Send OTP via Twilio (if configured)
            if twilio_configured:
                try:
                    client = Client(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN)
                    client.messages.create(
                        body=f"Your FoodSave OTP is: {otp}. This OTP is valid for 10 minutes.",
                        from_=settings.TWILIO_PHONE_NUMBER,
                        to=phone_number
                    )
                    response_payload = {
                        'message': 'OTP sent successfully',
                        'phone_number': phone_number,
                        'delivery_mode': 'sms',
                    }
                    if settings.DEBUG:
                        response_payload['otp_for_testing'] = otp
                    return Response(response_payload)
                except Exception as exc:
                    if settings.DEBUG:
                        return Response({
                            'message': 'OTP created in debug mode (SMS provider unavailable)',
                            'phone_number': phone_number,
                            'otp_for_testing': otp,
                            'delivery_mode': 'debug',
                            'warning': f'SMS provider failed: {str(exc)}'
                        })
                    return error_response(f'Failed to send OTP: {str(exc)}', status.HTTP_500_INTERNAL_SERVER_ERROR)
            else:
                # For development/testing without Twilio
                return Response({
                    'message': 'OTP created successfully (development mode: SMS provider not configured)',
                    'phone_number': phone_number,
                    'otp_for_testing': otp,
                    'delivery_mode': 'debug'
                })
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class VerifyPhoneOTPView(APIView):
    permission_classes = [permissions.AllowAny]
    
    def post(self, request):
        serializer = VerifyPhoneOTPSerializer(data=request.data)
        if serializer.is_valid():
            phone_number = serializer.validated_data['phone_number']
            otp = serializer.validated_data['otp']
            
            try:
                phone_otp = PhoneOTP.objects.get(phone_number=phone_number)
                is_valid, message = phone_otp.verify_otp(otp)
                
                if is_valid:
                    return Response({
                        'message': 'OTP verified',
                        'phone_number': phone_number,
                        'verified': True
                    })
                else:
                    return error_response(message)
            except PhoneOTP.DoesNotExist:
                return error_response('OTP record not found')
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class PhoneRegistrationView(APIView):
    permission_classes = [permissions.AllowAny]
    
    def post(self, request):
        serializer = PhoneRegistrationSerializer(data=request.data)
        if serializer.is_valid():
            user = serializer.save()
            
            # Log activity
            UserActivity.objects.create(
                user=user,
                activity_type='user_registered',
                description=f'New user registered via phone: {user.phone_number} ({user.role})',
                metadata={'role': user.role, 'method': 'phone'}
            )
            
            # Clean up OTP record
            try:
                PhoneOTP.objects.get(phone_number=user.phone_number).delete()
            except PhoneOTP.DoesNotExist:
                pass
            
            return build_auth_success_response(user, request, http_status=status.HTTP_201_CREATED)
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class PhoneLoginView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = PhoneLoginSerializer(data=request.data)
        if serializer.is_valid():
            phone_number = serializer.validated_data['phone_number']
            otp = serializer.validated_data['otp']

            try:
                user = User.objects.get(phone_number=phone_number)
            except User.DoesNotExist:
                return error_response('No account found with this phone number.')

            try:
                phone_otp = PhoneOTP.objects.get(phone_number=phone_number)
            except PhoneOTP.DoesNotExist:
                return error_response('OTP not requested for this phone number.')

            is_valid, message = phone_otp.verify_otp(otp)
            if not is_valid:
                return error_response(message)

            user.phone_verified = True
            user.login_method = 'PHONE'
            user.save(update_fields=['phone_verified', 'login_method'])

            UserActivity.objects.create(
                user=user,
                activity_type='user_login',
                description=f'User logged in via phone: {user.phone_number}',
                metadata={'role': user.role, 'method': 'phone'}
            )

            phone_otp.delete()

            return build_auth_success_response(user, request, http_status=status.HTTP_200_OK)

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class GoogleAuthView(APIView):
    permission_classes = [permissions.AllowAny]

    def _generate_unique_username(self, base: str) -> str:
        sanitized = ''.join(ch for ch in (base or 'user') if ch.isalnum() or ch in ['_', '.'])
        candidate = sanitized or 'user'
        index = 1
        while User.objects.filter(username=candidate).exists():
            candidate = f"{sanitized or 'user'}{index}"
            index += 1
        return candidate
    
    def post(self, request):
        serializer = GoogleAuthSerializer(data=request.data)
        if serializer.is_valid():
            token = serializer.validated_data.get('token')
            email = serializer.validated_data.get('email')
            first_name = serializer.validated_data.get('first_name', '')
            last_name = serializer.validated_data.get('last_name', '')
            mode = serializer.validated_data.get('mode', 'LOGIN')
            role = serializer.validated_data.get('role', 'DONOR')
            phone_number = serializer.validated_data.get('phone_number', '')
            organization_name = serializer.validated_data.get('organization_name', '')
            
            try:
                if token:
                    from google.auth.transport import requests
                    from google.oauth2 import id_token

                    google_client_id = (
                        getattr(settings, 'GOOGLE_OAUTH2_KEY', None)
                        or getattr(settings, 'GOOGLE_CLIENT_ID', None)
                        or None
                    )
                    try:
                        id_info = id_token.verify_oauth2_token(
                            token,
                            requests.Request(),
                            google_client_id
                        )
                        email = id_info.get('email', email)
                        first_name = id_info.get('given_name', first_name)
                        last_name = id_info.get('family_name', last_name)
                    except Exception:
                        if not email:
                            return error_response('Google token verification failed and email fallback is missing.')

                if not email:
                    return error_response('Email is required for Google authentication')
                
                # Check if user exists
                try:
                    user = User.objects.get(email=email)
                except User.DoesNotExist:
                    if mode == 'LOGIN':
                        return error_response('No account found with this Google email. Please sign up first.')
                    base_username = email.split('@')[0] if email else f"google_{role.lower()}"
                    username = self._generate_unique_username(base_username)
                    # Create new user from Google account
                    user = User.objects.create_user(
                        email=email,
                        username=username,
                        first_name=first_name or '',
                        last_name=last_name or '',
                        role=role,
                        phone_number=phone_number,
                        organization_name=organization_name,
                        login_method='GOOGLE',
                        is_verified=True
                    )
                    
                    # Log activity
                    UserActivity.objects.create(
                        user=user,
                        activity_type='user_registered',
                        description=f'New user registered via Google: {user.email} ({user.role})',
                        metadata={'role': user.role, 'method': 'google', 'mode': mode.lower()}
                    )
                else:
                    if mode == 'REGISTER':
                        return error_response('An account with this Google email already exists. Please sign in instead.')
                
                # Log login activity
                UserActivity.objects.create(
                    user=user,
                    activity_type='user_login',
                    description=f'User logged in via Google: {user.email}',
                    metadata={'role': user.role, 'method': 'google', 'mode': mode.lower()}
                )
                
                return build_auth_success_response(user, request, http_status=status.HTTP_200_OK)
            
            except Exception as exc:
                return error_response(f'Google authentication failed: {str(exc)}', status.HTTP_500_INTERNAL_SERVER_ERROR)
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class LeaderboardView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        leaderboard_users = list(get_leaderboard_queryset()[:50])

        leaderboard = []
        my_rank = None
        my_entry = None
        for index, user in enumerate(leaderboard_users, start=1):
            item = {
                'rank': index,
                'user_id': user.id,
                'name': user.full_name or user.email,
                'role': user.role,
                'contribution_score': user.contribution_score,
                'points_balance': user.points_balance,
                'total_points_earned': user.total_points_earned,
            }
            leaderboard.append(item)
            if user.id == request.user.id:
                my_rank = index
                my_entry = item

        prizes = Prize.objects.filter(is_active=True).order_by('points_required', 'name')
        recent_redemptions = PrizeRedemption.objects.filter(user=request.user).select_related('prize')[:10]

        return Response({
            'leaderboard': leaderboard,
            'my_rank': my_rank,
            'my_entry': my_entry,
            'points_balance': request.user.points_balance,
            'total_points_earned': request.user.total_points_earned,
            'point_rules': LEADERBOARD_POINTS_RULES,
            'prizes': PrizeSerializer(prizes, many=True).data,
            'recent_redemptions': PrizeRedemptionSerializer(recent_redemptions, many=True).data,
        })


class AwardTopLeaderboardView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        if not is_admin_user(request.user):
            return error_response('Only admins can award leaderboard points.', status.HTTP_403_FORBIDDEN)

        award_date_raw = request.data.get('award_date')
        if award_date_raw:
            try:
                award_date = datetime.strptime(award_date_raw, '%Y-%m-%d').date()
            except ValueError:
                return error_response('award_date must be in YYYY-MM-DD format.')
        else:
            award_date = timezone.localdate()

        if LeaderboardAward.objects.filter(award_date=award_date).exists():
            return error_response(f'Leaderboard points already awarded for {award_date}.')

        top_candidates = [
            user for user in get_leaderboard_queryset()[:3]
            if user.contribution_score > 0
        ]

        if not top_candidates:
            return Response({'message': 'No eligible users with contribution score > 0 for rewards.'}, status=status.HTTP_200_OK)

        awarded = []
        with transaction.atomic():
            for rank, user in enumerate(top_candidates, start=1):
                points = LEADERBOARD_POINTS_RULES.get(rank, 0)
                locked_user = User.objects.select_for_update().get(pk=user.id)
                locked_user.points_balance += points
                locked_user.total_points_earned += points
                locked_user.save(update_fields=['points_balance', 'total_points_earned'])

                LeaderboardAward.objects.create(
                    user=locked_user,
                    rank=rank,
                    points_awarded=points,
                    contribution_score=user.contribution_score,
                    award_date=award_date,
                )

                UserActivity.objects.create(
                    user=locked_user,
                    activity_type='leaderboard_reward',
                    description=f'You earned {points} points for leaderboard rank #{rank}.',
                    metadata={
                        'award_date': str(award_date),
                        'rank': rank,
                        'points': points,
                    }
                )

                awarded.append({
                    'rank': rank,
                    'user_id': locked_user.id,
                    'name': locked_user.full_name or locked_user.email,
                    'points_awarded': points,
                    'contribution_score': user.contribution_score,
                })

        return Response({
            'message': f'Leaderboard points awarded for {award_date}.',
            'awarded': awarded,
        }, status=status.HTTP_201_CREATED)


class PrizeListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        prizes = Prize.objects.filter(is_active=True).order_by('points_required', 'name')
        return Response(PrizeSerializer(prizes, many=True).data)


class RedeemPrizeView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        prize_id = request.data.get('prize_id')
        if not prize_id:
            return error_response('prize_id is required.')

        try:
            prize_id = int(prize_id)
        except (TypeError, ValueError):
            return error_response('prize_id must be a number.')

        try:
            prize = Prize.objects.get(id=prize_id, is_active=True)
        except Prize.DoesNotExist:
            return error_response('Prize not found or inactive.', status.HTTP_404_NOT_FOUND)

        with transaction.atomic():
            locked_user = User.objects.select_for_update().get(pk=request.user.id)
            locked_prize = Prize.objects.select_for_update().get(pk=prize.id)

            if locked_prize.stock <= 0:
                return error_response('Prize is out of stock.')

            if locked_user.points_balance < locked_prize.points_required:
                return error_response('Not enough points to redeem this prize.')

            locked_user.points_balance -= locked_prize.points_required
            locked_user.save(update_fields=['points_balance'])

            locked_prize.stock -= 1
            locked_prize.save(update_fields=['stock'])

            redemption = PrizeRedemption.objects.create(
                user=locked_user,
                prize=locked_prize,
                points_spent=locked_prize.points_required,
                status='COMPLETED'
            )

        UserActivity.objects.create(
            user=request.user,
            activity_type='prize_redeemed',
            description=f'You redeemed {prize.name} for {prize.points_required} points.',
            metadata={
                'prize_id': prize.id,
                'points_spent': prize.points_required,
            }
        )

        return Response({
            'message': 'Prize redeemed successfully.',
            'points_balance': locked_user.points_balance,
            'redemption': PrizeRedemptionSerializer(redemption).data,
        }, status=status.HTTP_201_CREATED)
