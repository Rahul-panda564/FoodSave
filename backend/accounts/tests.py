"""
Tests for the accounts app — registration, login, profile, Google auth, and phone auth.
"""
from django.test import TestCase
from django.urls import reverse
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework import status

from .models import PhoneOTP, Prize

User = get_user_model()


class UserRegistrationTests(TestCase):
    """Test user registration via email."""

    def setUp(self):
        self.client = APIClient()
        self.url = reverse('register')
        self.valid_data = {
            'email': 'newuser@example.com',
            'username': 'newuser',
            'first_name': 'New',
            'last_name': 'User',
            'password': 'SecurePass123!',
            'password_confirm': 'SecurePass123!',
            'role': 'DONOR',
        }

    def test_register_success(self):
        response = self.client.post(self.url, self.valid_data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIn('access', response.data)
        self.assertIn('refresh', response.data)
        self.assertEqual(response.data['user']['email'], 'newuser@example.com')

    def test_register_duplicate_email(self):
        User.objects.create_user(
            email='newuser@example.com',
            username='existing',
            password='SomePass123!',
            first_name='Existing',
            last_name='User',
        )
        response = self.client.post(self.url, self.valid_data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_register_password_mismatch(self):
        data = {**self.valid_data, 'password_confirm': 'WrongPass123!'}
        response = self.client.post(self.url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_register_missing_fields(self):
        response = self.client.post(self.url, {'email': 'x@y.com'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


class UserLoginTests(TestCase):
    """Test user login via email/password."""

    def setUp(self):
        self.client = APIClient()
        self.url = reverse('login')
        self.user = User.objects.create_user(
            email='login@example.com',
            username='loginuser',
            password='TestPass123!',
            first_name='Login',
            last_name='User',
            role='DONOR',
        )

    def test_login_success(self):
        response = self.client.post(self.url, {
            'email': 'login@example.com',
            'password': 'TestPass123!',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('access', response.data)
        self.assertIn('refresh', response.data)

    def test_login_wrong_password(self):
        response = self.client.post(self.url, {
            'email': 'login@example.com',
            'password': 'WrongPassword!',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_login_nonexistent_email(self):
        response = self.client.post(self.url, {
            'email': 'nobody@example.com',
            'password': 'TestPass123!',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


class ProfileTests(TestCase):
    """Test profile retrieval and update."""

    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            email='profile@example.com',
            username='profileuser',
            password='TestPass123!',
            first_name='Profile',
            last_name='User',
            role='NGO',
        )
        self.client.force_authenticate(user=self.user)
        self.url = reverse('profile')

    def test_get_profile(self):
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['email'], 'profile@example.com')
        self.assertEqual(response.data['role'], 'NGO')

    def test_update_profile(self):
        response = self.client.put(self.url, {
            'first_name': 'Updated',
            'organization_name': 'Save Food NGO',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['first_name'], 'Updated')
        self.assertEqual(response.data['organization_name'], 'Save Food NGO')

    def test_unauthenticated_profile_access(self):
        self.client.force_authenticate(user=None)
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)


class PasswordChangeTests(TestCase):
    """Test password change endpoint."""

    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            email='changepw@example.com',
            username='changepw',
            password='OldPass123!',
            first_name='Change',
            last_name='Password',
        )
        self.client.force_authenticate(user=self.user)
        self.url = reverse('change-password')

    def test_change_password_success(self):
        response = self.client.post(self.url, {
            'current_password': 'OldPass123!',
            'new_password': 'NewPass456!',
            'new_password_confirm': 'NewPass456!',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password('NewPass456!'))

    def test_change_password_wrong_current(self):
        response = self.client.post(self.url, {
            'current_password': 'WrongOldPass!',
            'new_password': 'NewPass456!',
            'new_password_confirm': 'NewPass456!',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


class GoogleAuthTests(TestCase):
    """Test Google authentication endpoint."""

    def setUp(self):
        self.client = APIClient()
        self.url = reverse('google-auth')

    def test_google_auth_register_with_email(self):
        """Test that a user can register via Google with just email (no token)."""
        response = self.client.post(self.url, {
            'email': 'googleuser@gmail.com',
            'first_name': 'Google',
            'last_name': 'User',
            'role': 'DONOR',
            'mode': 'REGISTER',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('access', response.data)
        self.assertTrue(User.objects.filter(email='googleuser@gmail.com').exists())

    def test_google_auth_login_existing_user(self):
        """Test that an existing user can login via Google."""
        User.objects.create_user(
            email='existing@gmail.com',
            username='existinggoogle',
            password='SomePass123!',
            first_name='Existing',
            last_name='Google',
            login_method='GOOGLE',
        )
        response = self.client.post(self.url, {
            'email': 'existing@gmail.com',
            'mode': 'LOGIN',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('access', response.data)

    def test_google_auth_login_nonexistent_user(self):
        """Test that login fails for non-existent Google user."""
        response = self.client.post(self.url, {
            'email': 'noone@gmail.com',
            'mode': 'LOGIN',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_google_auth_register_duplicate(self):
        """Test that registering with existing email is rejected."""
        User.objects.create_user(
            email='dup@gmail.com',
            username='dupgoogle',
            password='SomePass123!',
            first_name='Dup',
            last_name='Google',
        )
        response = self.client.post(self.url, {
            'email': 'dup@gmail.com',
            'mode': 'REGISTER',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_google_auth_missing_both_token_and_email(self):
        """Test that auth fails when neither token nor email is provided."""
        response = self.client.post(self.url, {
            'mode': 'LOGIN',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


class PhoneOTPModelTests(TestCase):
    """Test OTP generation and verification."""

    def test_generate_otp(self):
        phone_otp = PhoneOTP.objects.create(phone_number='+911234567890')
        otp = phone_otp.generate_otp()
        self.assertEqual(len(otp), 6)
        self.assertTrue(otp.isdigit())

    def test_verify_correct_otp(self):
        phone_otp = PhoneOTP.objects.create(phone_number='+911234567890')
        otp = phone_otp.generate_otp()
        is_valid, message = phone_otp.verify_otp(otp)
        self.assertTrue(is_valid)

    def test_verify_wrong_otp(self):
        phone_otp = PhoneOTP.objects.create(phone_number='+911234567890')
        phone_otp.generate_otp()
        is_valid, message = phone_otp.verify_otp('000000')
        self.assertFalse(is_valid)

    def test_max_attempts_exceeded(self):
        phone_otp = PhoneOTP.objects.create(phone_number='+911234567890')
        phone_otp.generate_otp()
        for _ in range(3):
            phone_otp.verify_otp('000000')
        is_valid, message = phone_otp.verify_otp('000000')
        self.assertFalse(is_valid)
        self.assertIn('Maximum attempts', message)


class UserStatsTests(TestCase):
    """Test user stats endpoint."""

    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            email='stats@example.com',
            username='statsuser',
            password='TestPass123!',
            first_name='Stats',
            last_name='User',
            role='DONOR',
        )
        self.client.force_authenticate(user=self.user)

    def test_get_stats(self):
        response = self.client.get(reverse('user-stats'))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('total_donations', response.data)


class LeaderboardTests(TestCase):
    """Test leaderboard endpoint."""

    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            email='leader@example.com',
            username='leader',
            password='TestPass123!',
            first_name='Leader',
            last_name='User',
            role='DONOR',
        )
        self.client.force_authenticate(user=self.user)

    def test_get_leaderboard(self):
        response = self.client.get(reverse('leaderboard'))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('leaderboard', response.data)
        self.assertIn('points_balance', response.data)


class PrizeTests(TestCase):
    """Test prize listing and redemption."""

    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            email='prizes@example.com',
            username='prizes',
            password='TestPass123!',
            first_name='Prize',
            last_name='User',
            role='DONOR',
            points_balance=500,
            total_points_earned=500,
        )
        self.client.force_authenticate(user=self.user)
        self.prize = Prize.objects.create(
            name='FoodSave T-Shirt',
            description='Limited edition t-shirt',
            points_required=100,
            stock=5,
            is_active=True,
        )

    def test_list_prizes(self):
        response = self.client.get(reverse('prize-list'))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)

    def test_redeem_prize_success(self):
        response = self.client.post(reverse('redeem-prize'), {
            'prize_id': self.prize.id,
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.user.refresh_from_db()
        self.assertEqual(self.user.points_balance, 400)

    def test_redeem_prize_insufficient_points(self):
        self.user.points_balance = 10
        self.user.save()
        response = self.client.post(reverse('redeem-prize'), {
            'prize_id': self.prize.id,
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
