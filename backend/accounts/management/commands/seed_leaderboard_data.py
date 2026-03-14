from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from django.db import connection
from django.db import transaction

from accounts.models import Prize


User = get_user_model()


class Command(BaseCommand):
    help = 'Seed leaderboard-related demo data (user points and redeemable prizes).'

    def add_arguments(self, parser):
        parser.add_argument(
            '--reset-points',
            action='store_true',
            help='Reset points_balance and total_points_earned for all donor/ngo/volunteer users before seeding.',
        )

    @transaction.atomic
    def handle(self, *args, **options):
        user_table = User._meta.db_table
        table_columns = {col.name for col in connection.introspection.get_table_description(connection.cursor(), user_table)}
        required_columns = {'points_balance', 'total_points_earned'}

        if not required_columns.issubset(table_columns):
            self.stdout.write(self.style.ERROR('Leaderboard columns are missing in the database.'))
            self.stdout.write(self.style.WARNING('Run migrations first: python manage.py migrate'))
            return

        role_qs = User.objects.filter(role__in=['DONOR', 'NGO', 'VOLUNTEER'])

        if options['reset_points']:
            updated = role_qs.update(points_balance=0, total_points_earned=0)
            self.stdout.write(self.style.WARNING(f'Reset points for {updated} users.'))

        ranking_seed = [
            ('donor@example.com', 220, 360),
            ('ngo@example.com', 180, 300),
            ('volunteer@example.com', 140, 210),
        ]

        for email, balance, total in ranking_seed:
            user = role_qs.filter(email=email).first()
            if not user:
                self.stdout.write(self.style.WARNING(f'Skipping missing user: {email}'))
                continue

            user.points_balance = max(user.points_balance, balance)
            user.total_points_earned = max(user.total_points_earned, total)
            user.save(update_fields=['points_balance', 'total_points_earned'])
            self.stdout.write(f'Seeded points for {user.email}: balance={user.points_balance}, total={user.total_points_earned}')

        prize_seed = [
            {
                'name': 'FoodSave T-Shirt',
                'description': 'Official community t-shirt.',
                'points_required': 120,
                'stock': 25,
                'is_active': True,
            },
            {
                'name': 'Eco Water Bottle',
                'description': 'Reusable stainless steel bottle.',
                'points_required': 180,
                'stock': 20,
                'is_active': True,
            },
            {
                'name': 'Volunteer Badge Pack',
                'description': 'Limited edition recognition badges.',
                'points_required': 90,
                'stock': 40,
                'is_active': True,
            },
            {
                'name': 'FoodSave Hoodie',
                'description': 'Premium hoodie for top contributors.',
                'points_required': 300,
                'stock': 10,
                'is_active': True,
            },
        ]

        for prize_data in prize_seed:
            prize, created = Prize.objects.update_or_create(
                name=prize_data['name'],
                defaults=prize_data,
            )
            verb = 'Created' if created else 'Updated'
            self.stdout.write(f'{verb} prize: {prize.name} ({prize.points_required} pts, stock={prize.stock})')

        self.stdout.write(self.style.SUCCESS('Leaderboard seed data is ready.'))
