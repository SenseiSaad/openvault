"""Report embedding coverage per company and warn on gaps.

Silent embedding loss is the worst RAG failure mode: retrieval keeps "working"
but quietly degrades to keyword search. This command makes the state visible —
run it from cron / Celery beat and alert on a non-zero exit:

    python manage.py check_embeddings                 # warn at >20% missing
    python manage.py check_embeddings --threshold 10  # stricter
"""
from django.core.management.base import BaseCommand, CommandError
from django.db.models import Count, Q

from core.models import Company, Document


class Command(BaseCommand):
    help = "Report per-company embedding coverage; exit 1 above the missing threshold."

    def add_arguments(self, parser):
        parser.add_argument("--threshold", type=int, default=20,
                            help="Fail when more than this %% of chunks lack vectors.")

    def handle(self, *args, **opts):
        threshold = max(0, int(opts["threshold"]))
        bad = []
        rows = (
            Document.objects
            .annotate(total=Count("chunks"),
                      missing=Count("chunks", filter=Q(chunks__embedding=None)))
            .select_related("company")
            .filter(total__gt=0)
        )
        for doc in rows:
            pct = int(round(100 * doc.missing / doc.total))
            models = (
                doc.chunks.exclude(embedding=None).exists(),
                doc.embed_model or "(unknown model)",
            )
            line = (f"{doc.company.name if doc.company_id else '(no company)'} :: "
                    f"{doc.filename}: {doc.total - doc.missing}/{doc.total} vectors "
                    f"[{models[1]}]")
            if pct > threshold:
                bad.append(line)
                self.stdout.write(self.style.WARNING("LOW " + line))
            else:
                self.stdout.write(line)

        companies = Company.objects.annotate(doc_count=Count("documents", distinct=True))
        empty = [c.name for c in companies if c.doc_count == 0]
        if empty:
            self.stdout.write(self.style.NOTICE(
                "Companies with no documents: " + ", ".join(empty)))

        if bad:
            raise CommandError(
                f"{len(bad)} document(s) exceed the {threshold}% missing-vector threshold. "
                "Run manage.py reindex_embeddings once the embedding provider is healthy."
            )
        self.stdout.write(self.style.SUCCESS("Embedding coverage OK."))
