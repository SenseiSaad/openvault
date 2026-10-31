"""End-to-end verification of the pgvector retrieval path against a real
PostgreSQL + pgvector database.

Run with the env pointing at a pgvector-enabled Postgres:
    DATABASE_URL=postgres://openvault:test@localhost:5433/openvault EMBED_DIM=8 \
        python scripts/verify_pgvector.py

It migrates a scratch database, indexes documents for TWO tenants with a
deterministic stub embedder (8-dim vectors), and asserts:
  1. the pgvector KNN column is populated and used for retrieval,
  2. each tenant only ever retrieves its own chunks,
  3. the fallback path still works when pgvector is unavailable.
Exit code 0 = verified.
"""
import os
import sys

import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
django.setup()

from django.core.management import call_command  # noqa: E402
from django.db import connection  # noqa: E402

call_command("migrate", "--noinput", verbosity=0)

import numpy as np  # noqa: E402

from core.models import Chunk, Company, Document, Plan, User  # noqa: E402
from core import rag  # noqa: E402

DIM = 8


class StubEmbedder:
    """Deterministic embedder: a text token maps to a fixed basis vector."""

    def embed(self, texts):
        out = []
        for t in texts:
            v = np.zeros(DIM, dtype=np.float32)
            for i, w in enumerate(set(t.lower().split())):
                v[hash(w) % DIM] += 1.0
            out.append(v / (np.linalg.norm(v) + 1e-8))
        return out


def main() -> int:
    Plan.default()
    failures = []

    # -- seed two tenants ----------------------------------------------------
    acme = Company.objects.create(name="Acme", slug="acme-verify")
    globex = Company.objects.create(name="Globex", slug="globex-verify")
    a_admin = User.objects.create_user(email="va@acme.test", password="x", company=acme, role="admin")
    g_admin = User.objects.create_user(email="vg@globex.test", password="x", company=globex, role="admin")

    def seed(company, uploader, filename, text):
        doc = Document.objects.create(company=company, filename=filename, stored_path="x",
                                      uploaded_by=uploader)
        pieces = rag.chunk_text(text)
        vecs = StubEmbedder().embed(pieces)
        rows = [Chunk(document=doc, company=company, ord=i, text=p,
                      embedding=rag._to_bytes(v)) for i, (p, v) in enumerate(zip(pieces, vecs))]
        Chunk.objects.bulk_create(rows)
        rag.persist_chunk_vectors([(r.pk, vecs[i]) for i, r in enumerate(rows) if r.pk is not None])
        return doc

    seed(acme, a_admin, "acme-hr.txt", "ACME leave policy allows twenty days paid leave "
                                        "per calendar year with manager approval")
    seed(globex, g_admin, "globex-salary.txt", "GLOBEX salary bands are confidential "
                                               "and reviewed every january by finance")
    seed(acme, a_admin, "acme-remote.txt", "ACME remote work requires two office days "
                                           "per week for all engineering staff")

    # -- 1. pgvector populated and active ------------------------------------
    if not rag._pgvector_ready():
        failures.append("pgvector path did not activate (extension/column missing)")
    else:
        with connection.cursor() as cursor:
            cursor.execute("SELECT count(*) FROM core_chunk WHERE embedding_vec IS NOT NULL")
            populated = cursor.fetchone()[0]
            cursor.execute("SELECT count(*) FROM core_chunk")
            total = cursor.fetchone()[0]
        if populated != total:
            failures.append(f"embedding_vec populated for {populated}/{total} chunks")
        print(f"pgvector active: {populated}/{total} chunks have embedding_vec")

    # -- 2. tenant isolation through the pgvector shortlist -------------------
    for user, forbidden in ((a_admin, "GLOBEX"), (g_admin, "ACME")):
        real_embed = rag.embed
        rag.embed = StubEmbedder().embed
        try:
            chunks = rag.retrieve(user, "what is the leave policy", k=4)
        finally:
            rag.embed = real_embed
        joined = " ".join(c.text for c in chunks)
        if forbidden in joined:
            failures.append(f"{user.email} retrieved other tenant's content")
        else:
            print(f"ok: {user.email} retrieval clean ({len(chunks)} chunks, no cross-tenant text)")

    # -- 3. fallback still works when pgvector is unavailable -----------------
    rag._PGVECTOR_STATE.update(checked=True, ok=False)
    real_embed = rag.embed
    rag.embed = StubEmbedder().embed
    try:
        chunks = rag.retrieve(a_admin, "remote work office days", k=4)
    finally:
        rag.embed = real_embed
    rag._PGVECTOR_STATE.update(checked=False)
    if not chunks or "ACME" not in " ".join(c.text for c in chunks):
        failures.append("fallback retrieval returned nothing useful")
    else:
        print(f"ok: fallback path retrieved {len(chunks)} chunks")

    if failures:
        print("FAILURES:")
        for f in failures:
            print(" -", f)
        return 1
    print("VERIFY-PGVECTOR: PASS")
    return 0


if __name__ == "__main__":
    sys.exit(main())
