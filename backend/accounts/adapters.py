import importlib
from django.contrib.auth import get_user_model

try:
    DefaultSocialAccountAdapter = importlib.import_module(
        'allauth.socialaccount.adapters'
    ).DefaultSocialAccountAdapter
except ModuleNotFoundError:
    class DefaultSocialAccountAdapter:
        def pre_social_login(self, request, sociallogin):
            return None

        def populate_user(self, request, sociallogin):
            return sociallogin.user

User = get_user_model()

class CustomSocialAccountAdapter(DefaultSocialAccountAdapter):
    """
    Custom adapter for social authentication (Google, etc.)
    """
    def _generate_unique_username(self, email: str) -> str:
        base = (email.split('@')[0] if email else 'user').strip() or 'user'
        candidate = base
        index = 1
        while User.objects.filter(username=candidate).exists():
            candidate = f"{base}{index}"
            index += 1
        return candidate

    def pre_social_login(self, request, sociallogin):
        """
        Handle pre-login logic before a user logs in via social provider
        """
        # If user exists, connect the account
        if sociallogin.is_existing:
            return
        
        # If user doesn't exist, create one
        if sociallogin.account.provider == 'google':
            email = (sociallogin.account.extra_data.get('email', '') or '').strip()
            if not email:
                return

            name = (sociallogin.account.extra_data.get('name', '') or '').split()
            first_name = name[0] if name else ''
            last_name = name[1] if len(name) > 1 else ''

            if User.objects.filter(email=email).exists():
                return

            try:
                user = User.objects.create_user(
                    email=email,
                    username=self._generate_unique_username(email),
                    first_name=first_name,
                    last_name=last_name,
                    login_method='GOOGLE'
                )
                sociallogin.connect(request, user)
            except Exception:
                pass
    
    def populate_user(self, request, sociallogin):
        """
        Populate user instance with data from social provider
        """
        user = super().populate_user(request, sociallogin)
        
        if sociallogin.account.provider == 'google':
            user.login_method = 'GOOGLE'
            
        return user
