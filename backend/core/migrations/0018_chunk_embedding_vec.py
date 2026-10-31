"""Add the pgvector KNN column for chunk embeddings.

Only touches PostgreSQL: on any other backend (SQLite dev) this is a no-op and
retrieval keeps using the capped in-Python scan. On Postgres it enables the
pgvector extension and adds a fixed-width `vector` column beside the existing
`embedding` bytea column, which stays the portable source of truth.

EMBED_DIM (settings) decides the column width; changing the embedding model
after data exists means a full re-embed — see the retrieval runbook.
"""
from django.conf import settings
from django.db import migrations


def add_pgvector_column(apps, schema_editor):
    if schema_editor.connection.vendor != "postgresql":
        return
    dim = int(getattr(settings, "EMBED_DIM", 1024))
    with schema_editor.connection.cursor() as cursor:
        cursor.execute("CREATE EXTENSION IF NOT EXISTS vector")
        cursor.execute(
            f"ALTER TABLE core_chunk ADD COLUMN IF NOT EXISTS embedding_vec vector({dim})"
        )


def remove_pgvector_column(apps, schema_editor):
    if schema_editor.connection.vendor != "postgresql":
        return
    with schema_editor.connection.cursor() as cursor:
        cursor.execute("ALTER TABLE core_chunk DROP COLUMN IF EXISTS embedding_vec")


class Migration(migrations.Migration):
    dependencies = [
        ("core", "0017_asklog_core_asklog_company_04f1aa_idx_and_more"),
    ]

    operations = [
        migrations.RunPython(add_pgvector_column, remove_pgvector_column),
    ]
