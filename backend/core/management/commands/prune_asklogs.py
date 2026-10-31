"""Delete AskLog rows older than the retention window (default 90 days).

AskLog stores the full question text (truncated to 2000 chars) — raw user
input that should not sit in the database forever. Analytics only ever reads
the trailing window, so pruning keeps the privacy footprint bounded without
losing operational signal. Run daily from cron/Celery beat:

    python manage.py prune_asklogs            # 90-day retention
    python manage.py prune_asklogs --days 30  # tighter window
"""
from datetime import timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone

from core.models import AskLog

DEFAULT_RETENTION_DAYS = 90


class Command(BaseCommand):
    help = "Delete AskLog rows older than the retention window."

    def add_arguments(self, parser):
        parser.add_argument("--days", type=int, default=DEFAULT_RETENTION_DAYS,
                            help="Retention window in days (default 90).")

    def handle(self, *args, **opts):
        days = max(1, int(opts["days"]))
        cutoff = timezone.now() - timedelta(days=days)
        deleted, _ = AskLog.objects.filter(created_at__lt=cutoff).delete()
        self.stdout.write(self.style.SUCCESS(
            f"Pruned {deleted} AskLog row(s) older than {days} days (before {cutoff.isoformat()})."
        ))
