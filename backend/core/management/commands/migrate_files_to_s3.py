"""Management command to migrate local files (on Render disk / DATA_DIR) to S3."""
import os
from django.core.management.base import BaseCommand, CommandError
from core.models import Document, DocumentVersion
from core import storage


class Command(BaseCommand):
    help = "Copy local Document and DocumentVersion files to S3 and update stored_path keys."

    def handle(self, *args, **options):
        if not storage.is_s3_enabled():
            raise CommandError("AWS_STORAGE_BUCKET_NAME is not configured.")

        migrated_docs = 0
        for doc in Document.objects.all():
            if doc.stored_path and os.path.isabs(doc.stored_path) and os.path.isfile(doc.stored_path):
                slug = doc.company.slug if doc.company_id else "unassigned"
                key = f"{slug}/{os.path.basename(doc.stored_path)}"
                with open(doc.stored_path, "rb") as fh:
                    storage.save_bytes(key, fh.read(), content_type=doc.content_type or "")
                doc.stored_path = key
                doc.save(update_fields=["stored_path"])
                migrated_docs += 1

        migrated_versions = 0
        for ver in DocumentVersion.objects.select_related("document__company").all():
            if ver.stored_path and os.path.isabs(ver.stored_path) and os.path.isfile(ver.stored_path):
                slug = ver.document.company.slug if ver.document and ver.document.company_id else "unassigned"
                key = f"{slug}/{os.path.basename(ver.stored_path)}"
                with open(ver.stored_path, "rb") as fh:
                    storage.save_bytes(key, fh.read())
                ver.stored_path = key
                ver.save(update_fields=["stored_path"])
                migrated_versions += 1

        self.stdout.write(
            self.style.SUCCESS(
                f"Migrated {migrated_docs} document(s) and {migrated_versions} version(s) to S3."
            )
        )
