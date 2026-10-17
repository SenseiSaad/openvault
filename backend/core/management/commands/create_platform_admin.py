"""Create or promote a platform root admin (complete cross-tenant authority).

Usage:
    python manage.py create_platform_admin <email> [--password <pw>] [--promote]

The flag is stored in the database (`is_platform_admin`), never inferred from
an email address. With --promote an EXISTING user is granted the flag; without
it a new detached (no company) root account is created. Password can be passed
via --password or will be prompted for (hidden) or randomly generated.
"""
import getpass
import secrets
import string

from django.core.management.base import BaseCommand, CommandError

from core.models import User


class Command(BaseCommand):
    help = "Create (or promote) a platform root admin with complete authority."

    def add_arguments(self, parser):
        parser.add_argument("email")
        parser.add_argument("--password", default="")
        parser.add_argument("--promote", action="store_true",
                            help="Grant the flag to an existing user instead of creating one.")

    def handle(self, *args, **opts):
        email = opts["email"].strip().lower()
        if not email or "@" not in email:
            raise CommandError("A valid email address is required.")

        if opts["promote"]:
            user = User.objects.filter(email__iexact=email).first()
            if not user:
                raise CommandError(f"No existing user with email {email}.")
            user.is_platform_admin = True
            user.is_staff = True
            user.save(update_fields=["is_platform_admin", "is_staff"])
            self.stdout.write(self.style.SUCCESS(
                f"Promoted {email} to platform admin (keeps company: {user.company_id})."))
            return

        if User.objects.filter(email__iexact=email).exists():
            raise CommandError(
                f"A user with email {email} already exists. Use --promote to grant it the flag.")

        password = opts["password"]
        if not password:
            password = getpass.getpass("Password (blank = generate random): ").strip()
        if not password:
            alphabet = string.ascii_letters + string.digits
            password = "".join(secrets.choice(alphabet) for _ in range(16))
            self.stdout.write(self.style.WARNING(f"Generated password: {password}"))

        user = User.objects.create_user(
            email=email, password=password,
            full_name="Platform Admin", title="Root", role="admin",
            is_staff=True, is_superuser=True, is_platform_admin=True,
            email_verified=True,
        )
        self.stdout.write(self.style.SUCCESS(
            f"Platform admin {email} created. It has no company (all-tenant view); "
            "use the company switcher in the workspace to act inside a tenant."))
