"""Seed a deterministic tenant for load testing (k6).

    SQLITE_PATH=/tmp/ov-load.sqlite3 python manage.py migrate
    SQLITE_PATH=/tmp/ov-load.sqlite3 python manage.py seed_loadtest
    SQLITE_PATH=/tmp/ov-load.sqlite3 LLM_PROVIDER=fake gunicorn config.wsgi:application -b :8001 --workers 2 --threads 4
    k6 run loadtests/ask.js

Creates one company ('loadtest-co'), one admin (load@openvault.test /
'loadtest-pass') and ~1,000 chunks across 50 documents so retrieval has real
work to do. Safe to re-run (idempotent).
"""
from django.core.management.base import BaseCommand
from django.db import transaction

from core.models import Chunk, Company, Document, Plan, User

WORDS = ("policy leave remote office attendance reimbursement approval manager holiday "
         "security access card system laptop travel hotel flight expense receipt payroll "
         "department notice period probation contract vendor invoice budget quarterly "
         "training onboarding benefits insurance grade level promotion transfer").split()


class Command(BaseCommand):
    help = "Seed a deterministic load-test tenant."

    def handle(self, *args, **opts):
        with transaction.atomic():
            # Load tests blast far past any real plan quota, so the tenant gets
            # a dedicated unlimited-ask plan (the ask limiter must not be the
            # thing under test here - the 50-ask Free gate would otherwise 402
            # the whole run after a minute).
            plan, _ = Plan.objects.get_or_create(
                name="LoadTest", defaults={"price_usd": 0, "monthly_ask_limit": 1_000_000})
            company, _ = Company.objects.get_or_create(
                slug="loadtest-co", defaults={"name": "LoadTest Co", "plan": plan})
            company.plan = plan
            company.save(update_fields=["plan"])
            user, created = User.objects.get_or_create(
                email="load@openvault.test",
                defaults={"role": "admin", "company": company, "email_verified": True},
            )
            user.set_password("loadtest-pass")
            user.company = company
            user.email_verified = True
            user.save()
            if not created and company.documents.exists():
                self.stdout.write("Load-test tenant already seeded; refreshed credentials.")
                return

            for d in range(50):
                doc = Document.objects.create(
                    company=company, filename=f"loadtest-doc-{d:02d}.txt",
                    stored_path=f"loadtest/{d}.txt", uploaded_by=user,
                    category="Other")
                paragraphs = []
                for p in range(20):
                    body = " ".join(WORDS[(d * 7 + p * 3 + i) % len(WORDS)]
                                    for i in range(120))
                    paragraphs.append(f"Section {d}.{p}: {body}")
                pieces = [
                    "\n\n".join(paragraphs[i:i + 2]) for i in range(0, 20, 2)
                ]
                Chunk.objects.bulk_create([
                    Chunk(document=doc, company=company, ord=i, text=piece, embedding=None)
                    for i, piece in enumerate(pieces)
                ])
                doc.num_chunks = len(pieces)
                doc.save(update_fields=["num_chunks"])
        self.stdout.write(self.style.SUCCESS(
            f"Seeded company 'loadtest-co' (user load@openvault.test / loadtest-pass) "
            f"with {Company.objects.get(slug='loadtest-co').documents.count()} documents."))
