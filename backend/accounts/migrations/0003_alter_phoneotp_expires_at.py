from django.db import migrations, models
import accounts.models


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0002_user_login_method_user_phone_verified_and_more'),
    ]

    operations = [
        migrations.AlterField(
            model_name='phoneotp',
            name='expires_at',
            field=models.DateTimeField(default=accounts.models.default_phone_otp_expiry),
        ),
    ]
