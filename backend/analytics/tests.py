from datetime import timedelta

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient

from analytics.algorithms import predict_food_safety, prioritize_available_donations
from donations.models import Donation, FoodCategory

User = get_user_model()


class AnalyticsAlgorithmTests(TestCase):
	def setUp(self):
		self.category = FoodCategory.objects.create(name='Prepared Meals')
		self.donor = User.objects.create_user(
			email='donor@example.com',
			username='donor',
			password='password123',
			first_name='Main',
			last_name='Donor',
			role='DONOR',
		)

	def create_donation(self, food_name: str, expiry_hours: int):
		return Donation.objects.create(
			donor=self.donor,
			food_name=food_name,
			category=self.category,
			quantity='8.50',
			unit='kg',
			expiry_time=timezone.now() + timedelta(hours=expiry_hours),
			storage_condition='AMBIENT',
			pickup_address='123 Relief Street',
			status='AVAILABLE',
		)

	def test_predict_food_safety_returns_risk_metadata(self):
		result = predict_food_safety(
			cooked_time=timezone.now() - timedelta(hours=9),
			expiry_time=timezone.now() + timedelta(hours=1),
			storage_condition='AMBIENT',
		)

		self.assertEqual(result['prediction'], 'UNSAFE')
		self.assertEqual(result['risk_level'], 'HIGH')
		self.assertIn('risk_factors', result)
		self.assertTrue(result['risk_factors'])
		self.assertIn('recommended_action', result)
		self.assertIn('freshness_score', result)

	def test_priority_queue_returns_soonest_expiring_first(self):
		urgent = self.create_donation('Cooked Rice', 2)
		self.create_donation('Bread Loaves', 10)

		prioritized = prioritize_available_donations(limit=5)

		self.assertEqual(prioritized[0]['donation_id'], urgent.id)
		self.assertIn(prioritized[0]['priority_band'], ['CRITICAL', 'HIGH'])
		self.assertGreaterEqual(prioritized[0]['priority_score'], 0)


class AnalyticsViewTests(TestCase):
	def setUp(self):
		self.client = APIClient()
		self.category = FoodCategory.objects.create(name='Bakery')
		self.admin_user = User.objects.create_user(
			email='admin@example.com',
			username='admin',
			password='password123',
			first_name='Admin',
			last_name='User',
			role='DONOR',
			is_staff=True,
		)
		self.current_donor = User.objects.create_user(
			email='current@example.com',
			username='currentdonor',
			password='password123',
			first_name='Current',
			last_name='Donor',
			role='DONOR',
		)
		self.old_donor = User.objects.create_user(
			email='old@example.com',
			username='olddonor',
			password='password123',
			first_name='Old',
			last_name='Donor',
			role='DONOR',
		)

		current_donation = Donation.objects.create(
			donor=self.current_donor,
			food_name='Fresh Meals',
			category=self.category,
			quantity='10.00',
			unit='kg',
			expiry_time=timezone.now() + timedelta(hours=8),
			storage_condition='REFRIGERATED',
			pickup_address='1 Current Street',
			status='AVAILABLE',
		)
		old_donation = Donation.objects.create(
			donor=self.old_donor,
			food_name='Archived Meals',
			category=self.category,
			quantity='20.00',
			unit='kg',
			expiry_time=timezone.now() + timedelta(hours=12),
			storage_condition='REFRIGERATED',
			pickup_address='9 Archive Lane',
			status='AVAILABLE',
		)

		Donation.objects.filter(id=current_donation.id).update(created_at=timezone.now() - timedelta(days=5))
		Donation.objects.filter(id=old_donation.id).update(created_at=timezone.now() - timedelta(days=45))

		self.client.force_authenticate(user=self.admin_user)

	def test_top_donors_respects_selected_range(self):
		response = self.client.get(reverse('top-donors'), {'range': '30days', 'limit': 5})

		self.assertEqual(response.status_code, 200)
		self.assertEqual(len(response.data), 1)
		self.assertEqual(response.data[0]['email'], 'current@example.com')
