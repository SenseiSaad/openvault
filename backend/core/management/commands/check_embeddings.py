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
        from core import providers
        from django.conf import settings

        threshold = max(0, int(opts["threshold"]))
        bad = []
        drift_docs = []
        db_dim = getattr(settings, "EMBED_DIM", 1024)
        active_prov = providers.get_embed_provider()
        active_model = getattr(active_prov, "embed_model_name", "") or "(unknown)"
        self.stdout.write(f"Active embed provider: {active_prov.label} [{active_model}] (DB EMBED_DIM={db_dim})")

        dim_warn = providers.check_embed_dimension_warning(active_prov.label, active_model)
        if dim_warn:
            self.stdout.write(self.style.WARNING(f"DIMENSION WARNING: {dim_warn}"))

        rows = (
            Document.objects
            .annotate(total=Count("chunks"),
                      missing=Count("chunks", filter=Q(chunks__embedding=None)))
            .select_related("company")
            .filter(total__gt=0)
        )
        for doc in rows:
            pct = int(round(100 * doc.missing / doc.total))
            doc_model = doc.embed_model or "(unknown model)"
            doc_prov = providers.get_embed_provider(company=doc.company)
            cur_model = getattr(doc_prov, "embed_model_name", "") or ""
            drift = bool(doc.embed_model and cur_model and doc.embed_model != cur_model)

            line = (f"{doc.company.name if doc.company_id else '(no company)'} :: "
                    f"{doc.filename}: {doc.total - doc.missing}/{doc.total} vectors "
                    f"[{doc_model}]")
            if drift:
                drift_docs.append(f"{doc.filename} (has: {doc_model}, active: {cur_model})")
                line += f" -> DRIFT (active: {cur_model})"

            if pct > threshold:
                bad.append(line)
                self.stdout.write(self.style.WARNING("LOW " + line))
            elif drift:
                self.stdout.write(self.style.WARNING("WARN " + line))
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
        if drift_docs:
            self.stdout.write(self.style.WARNING(
                f"{len(drift_docs)} document(s) have model drift. "
                "Run manage.py reindex_embeddings --all to align vector geometries."
            ))
        else:
            self.stdout.write(self.style.SUCCESS("Embedding coverage and model alignment OK."))
