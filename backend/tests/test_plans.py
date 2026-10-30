"""Server-side plan/quota enforcement (seats, documents, asks, feature gates)."""
import pytest
from django.core.files.uploadedfile import SimpleUploadedFile

from core.models import AskLog, Company, Document, Plan, User

pytestmark = pytest.mark.django_db


def _plan(**overrides):
    defaults = dict(name="Test Tier", price_usd=0, max_members=5, max_documents=50,
                    storage_mb=512, monthly_ask_limit=100, is_default=False)
    defaults.update(overrides)
    return Plan.objects.create(**defaults)


def test_seat_limit_blocks_new_members(auth_client, make_company, make_user):
    plan = _plan(max_members=2)
    company = make_company(plan=plan)
    admin = make_user(company, email="a@acme.test", role="admin")
    make_user(company, email="b@acme.test")  # 2 seats used -> at the cap

    resp = auth_client(admin).post(
        "/api/admin/users",
        {"email": "c@acme.test", "password": "Valid!Pass99", "role": "employee"},
        format="json",
    )
    assert resp.status_code == 400
    assert "Seat limit" in resp.json()["detail"]
    assert User.objects.filter(company=company).count() == 2


def test_document_limit_blocks_upload(auth_client, make_company, make_user):
    plan = _plan(max_documents=1)
    company = make_company(plan=plan)
    admin = make_user(company, email="a@acme.test", role="admin")
    Document.objects.create(company=company, filename="one.txt", stored_path="one.txt",
                            uploaded_by=admin)

    upload = SimpleUploadedFile("two.txt", b"hello", content_type="text/plain")
    resp = auth_client(admin).post("/api/documents/upload",
                                   {"file": upload, "access_scope": "company"},
                                   format="multipart")
    assert resp.status_code == 402
    assert company.documents.count() == 1


def test_monthly_ask_limit_blocks_ask(auth_client, make_company, make_user):
    plan = _plan(monthly_ask_limit=1)
    company = make_company(plan=plan)
    admin = make_user(company, email="a@acme.test", role="admin")
    AskLog.objects.create(company=company, user=admin, question="q", answered=True)

    resp = auth_client(admin).post("/api/ask", {"question": "another"}, format="json")
    assert resp.status_code == 402
    assert "limit reached" in resp.json()["detail"].lower()


def test_departments_are_plan_gated(auth_client, make_company, make_user):
    company = make_company(plan=_plan(allow_departments=False))
    admin = make_user(company, email="a@acme.test", role="admin")
    resp = auth_client(admin).post("/api/admin/departments", {"name": "HR"}, format="json")
    assert resp.status_code == 402

    company.plan = _plan(name="SME Test", allow_departments=True)
    company.save(update_fields=["plan"])
    resp = auth_client(admin).post("/api/admin/departments", {"name": "HR"}, format="json")
    assert resp.status_code == 201


def test_new_company_gets_the_default_plan(register_company, free_plan):
    register_company(name="Auto Plan Co", email="a@autoplan.test")
    company = Company.objects.get(name="Auto Plan Co")
    assert company.plan_id == free_plan.id
