"""Create one disposable staging company with two persisted sample documents.

Run interactively through scripts/post_deploy.sh demo. Passwords are entered
hidden and never printed. This command is refused in production.
"""
import getpass
import sys
import uuid

from django.conf import settings
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.core.management.base import BaseCommand, CommandError
from django.core.validators import validate_email
from django.db import transaction
from django.utils.text import slugify

from core import rag, storage
from core.models import Company, Document, DocumentAccess, Plan, User


SAMPLE_DOCUMENTS = (
    (
        "OpenVault Demo Handbook.md",
        "People Operations",
        "The demo workspace gives users a safe place to try uploads, search, and cited answers. "
        "The violet comet is the sample phrase used to verify source citations. "
        "Company administrators can invite staff, assign departments, and review the audit trail.",
    ),
    (
        "OpenVault Demo Data Policy.md",
        "Security",
        "Demo documents are synthetic and contain no customer records. "
        "Access to company documents is limited by tenant, department, and per-person grants. "
        "A company administrator may revoke a grant at any time.",
    ),
)


class Command(BaseCommand):
    help = "Create a single disposable company with sample documents (staging only)."

    def add_arguments(self, parser):
        parser.add_argument("--company-name", default="OpenVault Demo")
        parser.add_argument("--slug", default="openvault-demo")
        parser.add_argument("--email", default="")

    def handle(self, *args, **options):
        if settings.IS_PRODUCTION:
            raise CommandError("seed_demo_company is disabled in production.")

        name = str(options["company_name"]).strip()
        slug = slugify(options["slug"]) or "openvault-demo"
        email = str(options["email"] or "").strip().lower()
        if not email:
            if not sys.stdin.isatty():
                raise CommandError("Pass --email or run interactively.")
            email = input("Demo company admin email: ").strip().lower()
        try:
            validate_email(email)
        except ValidationError as exc:
            raise CommandError("Invalid demo admin email.") from exc

        company = Company.objects.filter(slug=slug).first()
        existing_user = User.objects.filter(email__iexact=email).first()
        password = ""
        if existing_user is None:
            if not sys.stdin.isatty():
                raise CommandError("Run interactively to enter the demo password without echo.")
            password = getpass.getpass("Demo admin password (hidden): ").strip()
            confirmation = getpass.getpass("Confirm demo admin password (hidden): ").strip()
            if not password or password != confirmation:
                raise CommandError("Demo passwords were blank or did not match.")
            try:
                validate_password(password)
            except ValidationError as exc:
                raise CommandError("Demo password rejected: " + " ".join(exc.messages)) from exc

        with transaction.atomic():
            if company is None:
                company = Company.objects.create(name=name, slug=slug, plan=Plan.default())
            if existing_user and existing_user.company_id not in (None, company.id):
                raise CommandError("That email belongs to a different company; choose another email.")
            if existing_user is None:
                existing_user = User.objects.create_user(
                    email=email,
                    password=password,
                    full_name="Demo Company Admin",
                    role="admin",
                    company=company,
                    email_verified=True,
                )
            else:
                existing_user.company = company
                existing_user.role = "admin"
                existing_user.is_active = True
                existing_user.email_verified = True
                existing_user.save(update_fields=["company", "role", "is_active", "email_verified"])

            for filename, category, text in SAMPLE_DOCUMENTS:
                document, created = Document.objects.get_or_create(
                    company=company,
                    filename=filename,
                    defaults={
                        "stored_path": f"{company.slug}/{uuid.uuid4().hex}_{filename}",
                        "content_type": "text/markdown",
                        "size": len(text.encode("utf-8")),
                        "category": category,
                        "description": "Synthetic sample data for the staging demo.",
                        "access_scope": "company",
                        "uploaded_by": existing_user,
                        "indexing_status": "ready",
                    },
                )
                if created:
                    raw = text.encode("utf-8")
                    stored = storage.save_bytes(document.stored_path, raw, "text/markdown", settings.DATA_DIR)
                    document.stored_path = stored
                    document.save(update_fields=["stored_path"])
                    rag.index_document(document, raw)
                DocumentAccess.objects.get_or_create(document=document, user=existing_user)

        self.stdout.write(self.style.SUCCESS(
            f"Demo company {company.slug} is ready with {len(SAMPLE_DOCUMENTS)} sample documents; admin email: {email}."
        ))
