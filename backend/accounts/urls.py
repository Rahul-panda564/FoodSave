from django.urls import path
from .views import (
    RegisterView, LoginView, ProfileView, ChangePasswordView,
    LogoutView, user_stats, SendPhoneOTPView, VerifyPhoneOTPView,
    PhoneRegistrationView, PhoneLoginView, GoogleAuthView, UploadProfileImageView,
    LeaderboardView, AwardTopLeaderboardView, PrizeListView, RedeemPrizeView
)

urlpatterns = [
    path('register/', RegisterView.as_view(), name='register'),
    path('login/', LoginView.as_view(), name='login'),
    path('profile/', ProfileView.as_view(), name='profile'),
    path('upload-profile-image/', UploadProfileImageView.as_view(), name='upload-profile-image'),
    path('change-password/', ChangePasswordView.as_view(), name='change-password'),
    path('logout/', LogoutView.as_view(), name='logout'),
    path('stats/', user_stats, name='user-stats'),
    path('phone/send-otp/', SendPhoneOTPView.as_view(), name='send-phone-otp'),
    path('phone/verify-otp/', VerifyPhoneOTPView.as_view(), name='verify-phone-otp'),
    path('phone/register/', PhoneRegistrationView.as_view(), name='phone-register'),
    path('phone/login/', PhoneLoginView.as_view(), name='phone-login'),
    path('google/auth/', GoogleAuthView.as_view(), name='google-auth'),
    path('leaderboard/', LeaderboardView.as_view(), name='leaderboard'),
    path('leaderboard/award-top/', AwardTopLeaderboardView.as_view(), name='award-top-leaderboard'),
    path('prizes/', PrizeListView.as_view(), name='prize-list'),
    path('prizes/redeem/', RedeemPrizeView.as_view(), name='redeem-prize'),
]
