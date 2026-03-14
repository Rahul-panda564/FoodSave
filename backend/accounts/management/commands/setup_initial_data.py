from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from donations.models import FoodCategory
from decimal import Decimal
from datetime import datetime, timedelta

User = get_user_model()

class Command(BaseCommand):
    help = 'Create initial data for the FoodSave application'

    def handle(self, *args, **options):
        self.stdout.write('Creating initial data...')
        
        # Create food categories
        categories_data = [
            {'name': 'Vegetables', 'description': 'Fresh and cooked vegetables'},
            {'name': 'Fruits', 'description': 'Fresh fruits and fruit products'},
            {'name': 'Grains', 'description': 'Rice, wheat, bread, and other grains'},
            {'name': 'Dairy', 'description': 'Milk, cheese, yogurt, and other dairy products'},
            {'name': 'Meat', 'description': 'Fresh and cooked meat products'},
            {'name': 'Bakery', 'description': 'Bread, pastries, and baked goods'},
            {'name': 'Prepared Foods', 'description': 'Cooked meals and ready-to-eat items'},
            {'name': 'Beverages', 'description': 'Drinks and liquids'},
        ]
        
        for category_data in categories_data:
            category, created = FoodCategory.objects.get_or_create(
                name=category_data['name'],
                defaults={'description': category_data['description']}
            )
            if created:
                self.stdout.write(f'Created category: {category.name}')
        
        # Create sample users
        users_data = [
            {
                'email': 'donor@example.com',
                'username': 'donor1',
                'first_name': 'John',
                'last_name': 'Doe',
                'role': 'DONOR',
                'password': 'password123',
                'phone_number': '+1234567890',
                'address': '123 Main St, City, State',
                'latitude': Decimal('40.7128'),
                'longitude': Decimal('-74.0060'),
            },
            {
                'email': 'ngo@example.com',
                'username': 'ngo1',
                'first_name': 'Jane',
                'last_name': 'Smith',
                'role': 'NGO',
                'password': 'password123',
                'phone_number': '+1234567891',
                'address': '456 Charity Ave, City, State',
                'latitude': Decimal('40.7589'),
                'longitude': Decimal('-73.9851'),
                'organization_name': 'Helping Hands Foundation',
            },
            {
                'email': 'volunteer@example.com',
                'username': 'volunteer1',
                'first_name': 'Mike',
                'last_name': 'Johnson',
                'role': 'VOLUNTEER',
                'password': 'password123',
                'phone_number': '+1234567892',
                'address': '789 Volunteer Blvd, City, State',
                'latitude': Decimal('40.7489'),
                'longitude': Decimal('-73.9680'),
            },
            {
                'email': 'admin@example.com',
                'username': 'admin1',
                'first_name': 'Admin',
                'last_name': 'User',
                'role': 'ADMIN',
                'password': 'password123',
                'phone_number': '+1234567893',
                'address': '321 Admin St, City, State',
                'latitude': Decimal('40.7614'),
                'longitude': Decimal('-73.9776'),
            },
        ]
        
        for user_data in users_data:
            password = user_data.pop('password')
            user, created = User.objects.get_or_create(
                email=user_data['email'],
                defaults=user_data
            )
            if created:
                user.set_password(password)
                user.save()
                self.stdout.write(f'Created user: {user.email} ({user.role})')
            else:
                self.stdout.write(f'User already exists: {user.email}')
        
        # Verify NGOs
        ngo_user = User.objects.get(email='ngo@example.com')
        ngo_user.is_verified = True
        ngo_user.save()
        self.stdout.write(f'Verified NGO: {ngo_user.email}')
        
        self.stdout.write(self.style.SUCCESS('Initial data created successfully!'))
        self.stdout.write('\nSample login credentials:')
        self.stdout.write('Donor: donor@example.com / password123')
        self.stdout.write('NGO: ngo@example.com / password123')
        self.stdout.write('Volunteer: volunteer@example.com / password123')
        self.stdout.write('Admin: admin@example.com / password123')
