"""Celery indexing tasks: eager execution, status transitions, requeue logic."""
import pytest

from core.models import Document

pytestmark = pytest.mark.django_db


@pytest.fixture
def eager_celery(settings):
    settings.CELERY_BROKER_URL = "memory://"
    settings.CELERY_TASK_ALWAYS_EAGER = True


def _doc(company, uploader, filename="doc.txt", status="pending"):
    return Document.objects.create(
        company=company, filename=filename, stored_path="doc.txt",
        uploaded_by=uploader, indexing_status=status,
    )


def test_index_task_flips_status_to_ready(eager_celery, make_company, make_user, settings):
    company = make_company()
    uploader = make_user(company, role="admin")
    settings.DATA_DIR.mkdir(parents=True, exist_ok=True) if hasattr(settings.DATA_DIR, "mkdir") else None
    (settings.DATA_DIR if isinstance(settings.DATA_DIR, str) else str(settings.DATA_DIR))
    import os
    path = os.path.join(str(settings.DATA_DIR), "doc.txt")
    with open(path, "w") as fh:
        fh.write("OpenVault remote work policy: two office days per week.")
    doc = _doc(company, uploader)
    doc.stored_path = path
    doc.save(update_fields=["stored_path"])

    from core.tasks import index_document_task
    result = index_document_task.apply(args=[doc.id])
    doc.refresh_from_db()
    assert result.result == "ready"
    assert doc.indexing_status == "ready"
    assert doc.num_chunks >= 1


def test_index_task_marks_failure_for_missing_file(eager_celery, make_company, make_user):
    company = make_company()
    uploader = make_user(company, role="admin")
    doc = _doc(company, uploader)
    doc.stored_path = "/nonexistent/path/doc.txt"
    doc.save(update_fields=["stored_path"])

    from core.tasks import index_document_task
    index_document_task.apply(args=[doc.id])
    doc.refresh_from_db()
    assert doc.indexing_status == "failed"
    assert doc.index_error


def test_requeue_stuck_documents_only_touches_old_pending(eager_celery, make_company, make_user):
    from datetime import timedelta

    from django.utils import timezone

    from core.tasks import requeue_stuck_documents

    company = make_company()
    uploader = make_user(company, role="admin")
    stuck = _doc(company, uploader, filename="stuck.txt", status="pending")
    Document.objects.filter(pk=stuck.pk).update(updated_at=timezone.now() - timedelta(hours=1))
    fresh = _doc(company, uploader, filename="fresh.txt", status="pending")
    ready = _doc(company, uploader, filename="ready.txt", status="ready")

    count = requeue_stuck_documents.apply().get()
    assert count == 1
    stuck.refresh_from_db()
    fresh.refresh_from_db()
    ready.refresh_from_db()
    # The stale pending doc was re-indexed (no real file -> failed, but no longer pending)
    assert stuck.indexing_status == "failed"
    assert fresh.indexing_status == "pending"
    assert ready.indexing_status == "ready"
