"""Seed the local demo knowledge corpus (demo_docs/*.md) into one company.

    python manage.py seed_policy_docs --password 'Demo!Pass123'
    python manage.py seed_policy_docs --company-slug my-co --email me@x.test --password '...'
    python manage.py seed_policy_docs --skip-embeddings   # BM25-only, very fast

Creates (or reuses) a demo company and admin user, then indexes every file:
policy/knowledge documents as normal searchable documents, and email / form /
application / letter files as WHOLE templates (is_template=True) for docgen.
This is a LOCAL DEMO command — the password you pass is used once to create the
demo account and is never stored in code or logs.
"""
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand

from core import rag, storage
from core.models import Chunk, Company, Document, Plan, User

DEMO_DIR = Path(__file__).resolve().parent.parent.parent.parent.parent / "demo_docs"

TEMPLATE_KINDS = {
    "email_": ("email", True),
    "form_": ("form", True),
    "application_": ("form", True),
    "letter_": ("form", True),
}


class Command(BaseCommand):
    help = "Seed demo_docs/ into a demo company (searchable policies + templates)."

    def add_arguments(self, parser):
        parser.add_argument("--company-slug", default="openvault-global")
        parser.add_argument("--company-name", default="OpenVault Global")
        parser.add_argument("--industry", default="Enterprise SaaS / Technology")
        parser.add_argument("--email", default="demo@openvault.test")
        parser.add_argument("--password", default="",
                            help="Password for the demo admin (required only when creating it).")
        parser.add_argument("--skip-embeddings", action="store_true",
                            help="Store chunks without vectors (BM25 search still works).")
        parser.add_argument("--dir", default=str(DEMO_DIR),
                            help="Directory containing the .md files.")

    def handle(self, *args, **opts):
        folder = Path(opts["dir"])
        files = sorted(folder.glob("*.md"))
        if not files:
            self.stdout.write(self.style.ERROR(f"No .md files in {folder}"))
            return

        company, created = Company.objects.get_or_create(
            slug=opts["company_slug"],
            defaults={"name": opts["company_name"], "industry": opts["industry"],
                      "plan": Plan.default()},
        )
        if not company.industry:
            company.industry = opts["industry"]
            company.save(update_fields=["industry"])

        user, user_created = User.objects.get_or_create(
            email=opts["email"],
            defaults={"role": "admin", "company": company,
                      "full_name": "Demo Administrator", "title": "Group Admin",
                      "email_verified": True},
        )
        if user_created:
            if not opts["password"]:
                # Roll back the company/user so a half-created demo never lingers.
                user.delete()
                if created:
                    company.delete()
                self.stdout.write(self.style.ERROR(
                    "--password is required when creating the demo admin."))
                return
            user.set_password(opts["password"])
            user.company = company
            user.save()
            self.stdout.write(self.style.WARNING(
                f"Demo login created: {opts['email']} (password supplied by you)."))

        plan = company.plan or Plan.default()
        n_docs = 0
        n_templates = 0
        n_chunks = 0
        for path in files:
            raw = path.read_bytes()
            text = raw.decode("utf-8", errors="ignore")
            key = f"{company.slug}/{path.name}"
            stored = storage.save_bytes(key, raw, content_type="text/markdown",
                                        base_dir=settings.DATA_DIR)
            kind, is_template = "", False
            for prefix, (k, flag) in TEMPLATE_KINDS.items():
                if path.name.startswith(prefix):
                    kind, is_template = k, flag
                    break
            doc, _ = Document.objects.get_or_create(
                company=company, filename=path.name,
                defaults={"stored_path": stored, "uploaded_by": user,
                          "size": len(raw), "content_type": "text/markdown",
                          "access_scope": "company", "indexing_status": "ready"},
            )
            doc.stored_path = stored
            doc.preview_text = text[:500_000]
            doc.is_template = is_template
            doc.template_type = kind if is_template else ""
            doc.indexing_status = "ready"
            doc.save(update_fields=["stored_path", "preview_text", "is_template",
                                    "template_type", "indexing_status"])

            if opts["skip_embeddings"]:
                pieces = rag.chunk_text(text)
                doc.chunks.all().delete()
                doc.chunks.bulk_create([
                    Chunk(document=doc, company=company, ord=i,
                                     text=p, embedding=None)
                    for i, p in enumerate(pieces)
                ])
                doc.num_chunks = len(pieces)
                doc.save(update_fields=["num_chunks"])
                n_chunks += len(pieces)
            else:
                n_chunks += rag.index_document(doc, raw)

            if is_template:
                n_templates += 1
            else:
                n_docs += 1

        self.stdout.write(self.style.SUCCESS(
            f"Seeded {n_docs} knowledge documents + {n_templates} templates "
            f"({n_chunks} chunks) into '{company.name}' "
            f"(company slug: {company.slug})."))
        self.stdout.write(
            "Search these with /api/ask, and request a form/email with /api/docgen.")
