"""Fail unless the named platform admin has enrolled TOTP two-step login."""
from django.core.management.base import BaseCommand, CommandError

from core.models import User


class Command(BaseCommand):
    help = "Verify that a platform administrator has enrolled TOTP MFA."

    def add_arguments(self, parser):
        parser.add_argument("email")

    def handle(self, *args, **options):
        email = options["email"].strip().lower()
        user = User.objects.filter(email__iexact=email, is_active=True).first()
        if not user or not user.is_platform_admin:
            raise CommandError("No active platform admin exists for that account.")
        if not user.mfa_enabled or not user.mfa_secret:
            raise CommandError("The platform admin has not completed authenticator enrollment.")
        self.stdout.write(self.style.SUCCESS("Platform-admin authenticator enrollment is enabled."))
