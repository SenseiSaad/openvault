"""Seed rich demo data: a Django superuser, several companies, users, and
public documents across categories (indexed offline so search/previews work).

Idempotent — safe to re-run (uses get_or_create). For a clean rebuild, delete
backend/db.sqlite3 and run again.
"""
import os
import uuid
from datetime import timedelta

from django.conf import settings
from django.core.management.base import BaseCommand
from django.utils import timezone

from core import rag
from core.models import Company, User, Document


# company slug -> (display name, [documents])
# each document: (filename, category, downloads, days_ago, description, is_public, is_okf, body)
DEMO = {
    "acme": ("Acme Inc", [
        ("employee-handbook.md", "HR", 342, 40,
         "Company-wide policies: leave, conduct, remote work and benefits.", True, False,
         "Acme Employee Handbook\n\nAll full-time staff accrue 22 days of paid leave per year. "
         "Remote work is allowed up to three days a week with manager approval. "
         "Report workplace concerns to people@acme.com. Standard working hours are 9am-5pm."),
        ("expense-policy.md", "Finance", 198, 28,
         "How to submit, approve and get reimbursed for business expenses.", True, False,
         "Acme Expense Policy\n\nExpenses under $200 are auto-approved. Anything above requires "
         "a manager sign-off. Submit receipts within 30 days via the finance portal. "
         "Travel is booked through the approved agency only."),
        ("api-style-guide.md", "Technology", 511, 12,
         "REST conventions, versioning and error-handling for Acme services.", True, False,
         "Acme API Style Guide\n\nUse plural nouns for collections. Version APIs with a /v1 prefix. "
         "Return RFC 7807 problem+json on errors. Prefer cursor pagination over offset. "
         "All endpoints must require authentication unless explicitly public."),
        ("brand-guidelines.md", "Marketing", 87, 60,
         "Logo usage, colour palette and tone of voice for the Acme brand.", True, False,
         "Acme Brand Guidelines\n\nThe primary brand colour is indigo (#3b5bdb). Never stretch "
         "the logo. Voice is friendly, plain and confident. Leave clear space around the mark."),
        ("okf-support-exceptions.md", "Operations", 0, 5,
         "Curated support exceptions always injected into AI answers.", False, True,
         "OKF: Support Exceptions\n\nEnterprise customers get 24/7 phone support. Refunds beyond "
         "the 30-day window are allowed for annual plans only. Never promise features that are "
         "not on the public roadmap."),
    ]),
    "globex": ("Globex Corporation", [
        ("data-privacy-notice.md", "Legal", 276, 20,
         "How Globex collects, stores and processes personal data.", True, False,
         "Globex Data Privacy Notice\n\nWe collect only the data needed to deliver our services. "
         "Personal data is encrypted at rest and in transit. You may request deletion at any time "
         "by emailing privacy@globex.com. We never sell customer data."),
        ("security-whitepaper.md", "Technology", 634, 8,
         "Overview of Globex's security architecture and controls.", True, False,
         "Globex Security Whitepaper\n\nAll infrastructure runs in isolated tenant boundaries. "
         "Secrets are managed centrally and rotated automatically. Access follows least privilege "
         "and every action is audit-logged. Penetration tests are run quarterly."),
        ("q3-market-report.md", "Research", 143, 33,
         "Third-quarter market analysis and growth outlook.", True, False,
         "Globex Q3 Market Report\n\nDemand grew 14% quarter over quarter, led by the APAC region. "
         "Enterprise adoption of AI tooling accelerated. We expect continued growth into Q4 with "
         "margin pressure from infrastructure costs."),
    ]),
    "initech": ("Initech", [
        ("onboarding-checklist.md", "HR", 220, 15,
         "Everything a new hire needs in their first week at Initech.", True, False,
         "Initech Onboarding Checklist\n\nDay 1: collect laptop and sign the code of conduct. "
         "Week 1: complete security training and meet your mentor. Set up MFA on all accounts. "
         "Ask questions in the #newbies channel."),
        ("incident-response.md", "Operations", 402, 3,
         "Steps to follow when a production incident is declared.", True, False,
         "Initech Incident Response\n\nDeclare an incident in #incidents and assign a commander. "
         "Mitigate first, investigate second. Post a public status update within 30 minutes. "
         "Write a blameless post-mortem within 48 hours."),
        ("open-source-policy.md", "Legal", 66, 50,
         "Rules for using and contributing to open-source software.", True, False,
         "Initech Open Source Policy\n\nPermissive licences (MIT, Apache-2.0, BSD) are pre-approved. "
         "Copyleft licences need legal review. Contributions to external projects require sign-off. "
         "Always run a licence scan before shipping."),
    ]),
}


class Command(BaseCommand):
    help = "Seed demo companies, users and public documents"

    def _doc(self, company, uploader, spec):
        (name, category, downloads, days_ago, desc, is_public, is_okf, body) = spec
        raw = body.encode("utf-8")
        # write a real file so the demo download button works
        folder = os.path.join(settings.DATA_DIR, company.slug)
        os.makedirs(folder, exist_ok=True)
        stored = os.path.join(folder, f"{uuid.uuid4().hex}_{name}")
        doc, created = Document.objects.get_or_create(
            company=company, filename=name,
            defaults=dict(
                stored_path=stored, content_type="text/markdown", size=len(raw),
                category=category, description=desc, downloads=downloads,
                is_public=is_public, is_okf=is_okf, uploaded_by=uploader,
            ),
        )
        if created:
            with open(stored, "wb") as out:
                out.write(raw)
            rag.index_document(doc, raw)
            # backdate created_at (auto_now_add ignores assignment, so update directly)
            Document.objects.filter(pk=doc.pk).update(
                created_at=timezone.now() - timedelta(days=days_ago)
            )
        return created

    def handle(self, *args, **options):
        # Django superuser for /admin
        if not User.objects.filter(email="root@securekb.local").exists():
            User.objects.create_superuser(
                email="root@securekb.local", password="admin1234", full_name="SecureKB Root",
            )
            self.stdout.write(self.style.SUCCESS(">> superuser root@securekb.local / admin1234"))

        new_docs = 0
        for slug, (name, docs) in DEMO.items():
            company, _ = Company.objects.get_or_create(slug=slug, defaults={"name": name})
            admin_user, created = User.objects.get_or_create(
                email=f"admin@{slug}.com",
                defaults=dict(full_name=f"{name} Admin", role="admin", company=company),
            )
            if created:
                admin_user.set_password("demo1234")
                admin_user.save()
            for spec in docs:
                new_docs += 1 if self._doc(company, admin_user, spec) else 0

        # keep the original Acme staff (employee) login
        acme = Company.objects.get(slug="acme")
        staff, created = User.objects.get_or_create(
            email="staff@acme.com",
            defaults=dict(full_name="Acme Staff", role="employee", company=acme),
        )
        if created:
            staff.set_password("demo1234")
            staff.save()

        self.stdout.write(self.style.SUCCESS(
            f">> Seeded {Company.objects.count()} companies, "
            f"{Document.objects.filter(is_public=True).count()} public docs "
            f"({new_docs} new). Enterprise login: admin@acme.com / demo1234"
        ))
        self.stdout.write("   (delete db.sqlite3 and re-run for a clean rebuild)")
