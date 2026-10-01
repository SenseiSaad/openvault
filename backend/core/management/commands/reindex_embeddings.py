"""Backfill embeddings for any chunks that don't have one yet.

Why this exists
---------------
A Chunk stores its vector in the `embedding` BinaryField (see core/models.py).
That column is our "vector store" — there is no separate vector database; we
keep the float32 vector right next to the text in SQLite and compare with a
cosine similarity in numpy at query time (see core.rag.retrieve).

Chunks created while the embedding model was offline are saved with
`embedding = NULL`, and retrieval quietly falls back to keyword search for them.
Once Ollama has the embed model pulled (`ollama pull nomic-embed-text`), run:

    python manage.py reindex_embeddings

to fill in the missing vectors from each chunk's stored text. It is safe to run
repeatedly: chunks that already have a vector are skipped, and nothing is
deleted. Use --all to recompute every chunk (e.g. after changing the model).
"""
from django.core.management.base import BaseCommand

from core.models import Chunk
from core import rag


class Command(BaseCommand):
    help = "Compute and store embeddings for chunks that are missing one."

    def add_arguments(self, parser):
        parser.add_argument(
            "--all", action="store_true",
            help="Recompute embeddings for EVERY chunk, not just the missing ones.",
        )
        parser.add_argument(
            "--batch", type=int, default=16,
            help="How many chunks to embed per request (default 16).",
        )

    def handle(self, *args, **opts):
        qs = Chunk.objects.all() if opts["all"] else Chunk.objects.filter(embedding=None)
        todo = list(qs.only("id", "text"))
        if not todo:
            self.stdout.write(self.style.SUCCESS("Nothing to do — every chunk already has a vector."))
            return

        self.stdout.write(f"Embedding {len(todo)} chunk(s)…")
        batch = max(1, opts["batch"])
        done = failed = 0
        for i in range(0, len(todo), batch):
            group = todo[i:i + batch]
            vecs = rag.embed([c.text for c in group])  # None => embed provider offline
            if vecs is None:
                failed += len(group)
                continue
            for chunk, vec in zip(group, vecs):
                chunk.embedding = rag._to_bytes(vec)
                chunk.save(update_fields=["embedding"])
                done += 1

        if failed:
            self.stdout.write(self.style.WARNING(
                f"Embedded {done}, but {failed} failed — is Ollama running and is "
                "the embed model pulled? (`ollama pull nomic-embed-text`)"
            ))
        else:
            self.stdout.write(self.style.SUCCESS(f"Done — embedded {done} chunk(s)."))
