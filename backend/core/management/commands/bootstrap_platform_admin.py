"""Create the first platform admin from deployment secret environment variables.

Set BOOTSTRAP_PLATFORM_ADMIN_EMAIL and BOOTSTRAP_PLATFORM_ADMIN_PASSWORD in
the hosting provider's secret environment settings. Remove both after the
first successful startup. Credentials are never written to logs or source.
"""
import os

from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.core.management.base import BaseCommand, CommandError
from django.core.validators import validate_email
from django.db import transaction

from core.models import User


EMAIL_ENV = "BOOTSTRAP_PLATFORM_ADMIN_EMAIL"
PASSWORD_ENV = "BOOTSTRAP_PLATFORM_ADMIN_PASSWORD"


class Command(BaseCommand):
    help = "Optionally bootstrap the single platform admin from secret environment variables."

    @transaction.atomic
    def handle(self, *args, **options):
        email = os.getenv(EMAIL_ENV, "").strip().lower()
        password = os.getenv(PASSWORD_ENV, "")

        if not email and not password:
            self.stdout.write("No platform-admin bootstrap secrets set; skipping.")
            return
        if not email or not password:
            raise CommandError(f"Set both {EMAIL_ENV} and {PASSWORD_ENV}, or remove both.")

        try:
            validate_email(email)
        except ValidationError as exc:
            raise CommandError("Invalid platform-admin email address.") from exc

        existing_admin = User.objects.select_for_update().filter(is_platform_admin=True).first()
        if existing_admin:
            if existing_admin.email.casefold() == email.casefold():
                self.stdout.write("Configured platform admin already exists; password unchanged.")
            else:
                self.stdout.write(self.style.WARNING(
                    "A different platform admin already exists; no second admin was created."
                ))
            return

        user = User.objects.select_for_update().filter(email__iexact=email).first()
        if user:
            try:
                validate_password(password, user=user)
            except ValidationError as exc:
                raise CommandError("Bootstrap password rejected: " + " ".join(exc.messages)) from exc

            user.set_password(password)
            user.is_platform_admin = True
            user.is_staff = True
            user.is_superuser = True
            user.email_verified = True
            user.save(update_fields=[
                "password", "is_platform_admin", "is_staff", "is_superuser", "email_verified",
            ])
            self.stdout.write(self.style.SUCCESS(
                f"Existing account {email} promoted to platform admin."
            ))
            return

        user = User(
            email=email,
            full_name="Platform Admin",
            title="Root",
            role="admin",
            is_staff=True,
            is_superuser=True,
            is_platform_admin=True,
            email_verified=True,
        )
        try:
            validate_password(password, user=user)
        except ValidationError as exc:
            raise CommandError("Bootstrap password rejected: " + " ".join(exc.messages)) from exc

        user.set_password(password)
        user.save()
        self.stdout.write(self.style.SUCCESS(f"Platform admin {email} created."))
