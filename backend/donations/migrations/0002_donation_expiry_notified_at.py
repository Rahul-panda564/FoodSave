from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('donations', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='donation',
            name='expiry_notified_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
    ]
