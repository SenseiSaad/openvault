"""Seed the subscription plans (USD pricing). Idempotent.

Prices are cost-based, not profit-based: each tier covers the fully-loaded
infrastructure and Bedrock usage for one tenant at that usage level (compute
share, managed Postgres, object storage, LLM tokens, backups) plus a thin
margin for payment processing. The Free tier is the default attached to every
new company so self-serve signup works without payment.

Local payment methods (bank transfer, JazzCash, Easypaisa) and a PKR
equivalent are handled at checkout; this table stores USD only.
"""
from django.core.management.base import BaseCommand

from core.models import Plan

PLANS = [
    dict(
        name="Free", price_usd=0, billing_period="month",
        max_members=3, max_documents=20, storage_mb=512, monthly_ask_limit=50,
        allow_versions=False, allow_departments=False, allow_custom_llm=False,
        is_default=True,
    ),
    dict(
        name="Starter", price_usd=15, billing_period="month",
        max_members=15, max_documents=200, storage_mb=5120, monthly_ask_limit=1500,
        allow_versions=True, allow_departments=False, allow_custom_llm=False,
    ),
    dict(
        name="Business", price_usd=49, billing_period="month",
        max_members=50, max_documents=1000, storage_mb=25600, monthly_ask_limit=6000,
        allow_versions=True, allow_departments=True, allow_custom_llm=True,
    ),
    dict(
        name="Enterprise", price_usd=129, billing_period="month",
        max_members=None, max_documents=None, storage_mb=None, monthly_ask_limit=None,
        allow_versions=True, allow_departments=True, allow_custom_llm=True,
    ),
]


class Command(BaseCommand):
    help = "Seed the USD subscription plans (idempotent)."

    def handle(self, *args, **opts):
        # An earlier release shipped this tier as "SME"; rename it in place so
        # companies already on it keep their plan row (the FK stays valid).
        sme = Plan.objects.filter(name="SME").first()
        if sme and not Plan.objects.filter(name="Business").exists():
            sme.name = "Business"
            sme.save(update_fields=["name"])

        for spec in PLANS:
            plan, created = Plan.objects.update_or_create(
                name=spec["name"], defaults=spec
            )
            self.stdout.write(
                f"{'created' if created else 'updated'}: {plan.name} "
                f"(${plan.price_usd}/{plan.billing_period})")
        if not Plan.objects.filter(is_default=True).exists():
            Plan.objects.filter(name="Free").update(is_default=True)
        self.stdout.write(self.style.SUCCESS("Plans seeded."))
