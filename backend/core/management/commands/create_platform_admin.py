"""Create or promote a platform root admin (complete cross-tenant authority).

In production, run this interactively through ECS Exec. The email is prompted
when omitted; passwords and confirmations are hidden and never printed. Avoid
the optional --password argument in production because command arguments may
be visible in process/session metadata.
"""
import getpass
import sys

from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.core.management.base import BaseCommand, CommandError

from core.models import User


class Command(BaseCommand):
    help = "Create or promote a platform root admin with complete authority."

    def add_arguments(self, parser):
        parser.add_argument("email", nargs="?", default="")
        parser.add_argument("--password", default="", help="Local/testing only; do not pass production secrets here.")
        parser.add_argument("--promote", action="store_true",
                            help="Grant the flag to an existing user instead of creating one.")

    def handle(self, *args, **opts):
        email = (opts["email"] or "").strip().lower()
        if not email:
            if not sys.stdin.isatty():
                raise CommandError("Email is required when stdin is not interactive.")
            email = input("Platform admin email: ").strip().lower()
        if not email or "@" not in email:
            raise CommandError("A valid email address is required.")

        user = User.objects.filter(email__iexact=email).first()
        if opts["promote"]:
            if not user:
                raise CommandError(f"No existing user with email {email}.")
            self._promote(user)
            self.stdout.write(self.style.SUCCESS(f"Promoted {email} to platform admin."))
            return

        if user and user.is_platform_admin:
            self.stdout.write(self.style.SUCCESS(
                f"Platform admin {email} already exists; credentials were not changed."
            ))
            return
        if user:
            if not sys.stdin.isatty():
                raise CommandError(
                    f"A user with email {email} already exists. Run interactively to confirm promotion."
                )
            answer = input(f"User {email} exists. Promote this account? [y/N] ").strip().lower()
            if answer not in {"y", "yes"}:
                raise CommandError("Existing account was not promoted.")
            self._promote(user)
            self.stdout.write(self.style.SUCCESS(f"Promoted {email} to platform admin."))
            return

        password = opts["password"]
        if not password:
            if not sys.stdin.isatty():
                raise CommandError("A password is required when stdin is not interactive.")
            password = getpass.getpass("Password (hidden): ").strip()
            confirmation = getpass.getpass("Confirm password (hidden): ").strip()
            if not password or password != confirmation:
                raise CommandError("Passwords were blank or did not match.")
        try:
            validate_password(password)
        except ValidationError as exc:
            raise CommandError("Password rejected: " + " ".join(exc.messages)) from exc

        User.objects.create_user(
            email=email,
            password=password,
            full_name="Platform Admin",
            title="Root",
            role="admin",
            is_staff=True,
            is_superuser=True,
            is_platform_admin=True,
            email_verified=True,
        )
        self.stdout.write(self.style.SUCCESS(
            f"Platform admin {email} created. First login must enroll an authenticator before access is granted."
        ))

    @staticmethod
    def _promote(user):
        user.is_platform_admin = True
        user.is_staff = True
        user.is_superuser = True
        user.email_verified = True
        user.save(update_fields=["is_platform_admin", "is_staff", "is_superuser", "email_verified"])
