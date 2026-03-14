import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'foodsave.settings')
django.setup()

from accounts.models import User

# Delete all users
User.objects.all().delete()
print("✅ All users deleted successfully")

# Create new admin user
User.objects.create_superuser('admin', 'admin@example.com', 'admin123')
print("✅ New admin created: admin / admin123")
