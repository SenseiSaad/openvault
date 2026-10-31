"""Re-queue documents stuck in 'pending' indexing (e.g. after a deploy killed
a worker mid-embed). Celery beat runs the task version every 15 minutes; this
command gives operators the same lever manually:

    python manage.py requeue_stuck_documents            # 30-minute staleness
    python manage.py requeue_stuck_documents --max-age 5
"""
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = "Re-dispatch documents stuck in pending indexing."

    def add_arguments(self, parser):
        parser.add_argument("--max-age", type=int, default=30,
                            help="Staleness threshold in minutes (default 30).")

    def handle(self, *args, **opts):
        from core.tasks import requeue_stuck_documents
        count = requeue_stuck_documents(max_age_minutes=int(opts["max_age"]))
        self.stdout.write(self.style.SUCCESS(
            f"Requeued {count} stuck document(s) (pending for over {opts['max_age']} minutes)."
        ))
