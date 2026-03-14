from datetime import timedelta

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient

from donations.models import Donation, FoodCategory

User = get_user_model()


class DonationVisibilityTests(TestCase):
	def setUp(self):
		self.client = APIClient()
		self.category = FoodCategory.objects.create(name='Cooked Food')
		self.donor = User.objects.create_user(
			email='donor@test.com',
			username='donor',
			password='password123',
			first_name='Donor',
			last_name='User',
			role='DONOR',
		)
		self.other_user = User.objects.create_user(
			email='ngo@test.com',
			username='ngo',
			password='password123',
			first_name='Ngo',
			last_name='User',
			role='NGO',
		)
		self.admin_user = User.objects.create_user(
			email='admin@test.com',
			username='admin',
			password='password123',
			first_name='Admin',
			last_name='User',
			role='DONOR',
			is_staff=True,
		)

		self.available_donation = Donation.objects.create(
			donor=self.donor,
			food_name='Available Meal',
			category=self.category,
			quantity='5.00',
			unit='kg',
			expiry_time=timezone.now() + timedelta(hours=8),
			storage_condition='REFRIGERATED',
			pickup_address='1 Relief Street',
			status='AVAILABLE',
		)
		self.accepted_donation = Donation.objects.create(
			donor=self.donor,
			food_name='Accepted Meal',
			category=self.category,
			quantity='3.00',
			unit='kg',
			expiry_time=timezone.now() + timedelta(hours=10),
			storage_condition='REFRIGERATED',
			pickup_address='2 Relief Street',
			status='ACCEPTED',
		)

	def test_non_admin_list_only_returns_available_donations(self):
		self.client.force_authenticate(user=self.other_user)

		response = self.client.get(reverse('donation-list'))

		self.assertEqual(response.status_code, 200)
		results = response.data.get('results', response.data)
		returned_ids = {item['id'] for item in results}
		self.assertIn(self.available_donation.id, returned_ids)
		self.assertNotIn(self.accepted_donation.id, returned_ids)

	def test_non_owner_cannot_view_non_available_donation_detail(self):
		self.client.force_authenticate(user=self.other_user)

		response = self.client.get(reverse('donation-detail', args=[self.accepted_donation.id]))

		self.assertEqual(response.status_code, 404)

	def test_owner_can_view_their_non_available_donation_detail(self):
		self.client.force_authenticate(user=self.donor)

		response = self.client.get(reverse('donation-detail', args=[self.accepted_donation.id]))

		self.assertEqual(response.status_code, 200)
		self.assertEqual(response.data['id'], self.accepted_donation.id)

	def test_admin_can_view_non_available_donations_in_list(self):
		self.client.force_authenticate(user=self.admin_user)

		response = self.client.get(reverse('donation-list'), {'status': 'ACCEPTED'})

		self.assertEqual(response.status_code, 200)
		results = response.data.get('results', response.data)
		self.assertEqual(len(results), 1)
		self.assertEqual(results[0]['id'], self.accepted_donation.id)
