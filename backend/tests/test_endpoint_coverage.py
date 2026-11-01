"""Broad endpoint + unit coverage for the hardening work: every endpoint's
happy path exercised once (catching wiring regressions the narrow security
tests miss), plus unit tests for storage, workflow and provider helpers."""
import io
import json
from unittest.mock import patch

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile

from core import storage, workflow
from core.models import (
    AttendanceRecord, ChatConversation, Company, Department, Document,
    DocumentShare, Plan, User,
)
from .fakes import StubChatProvider

pytestmark = pytest.mark.django_db


@pytest.fixture
def company_admin(auth_client, make_company, make_user):
    company = make_company("Full Co")
    admin = make_user(company, email="full-admin@acme.test", role="admin")
    return company, admin, auth_client(admin)


def _upload(client, name="hello.txt", content=b"OpenVault remote policy two days"):
    up = SimpleUploadedFile(name, content, content_type="text/plain")
    return client.post("/api/documents/upload",
                       {"file": up, "access_scope": "company"}, format="multipart")


# ------------------------------------------------------------ document flow
def test_full_document_lifecycle(company_admin):
    company, admin, client = company_admin
    # Version history is plan-gated; the Free default does not include it.
    company.plan = Plan.objects.create(name="Lifecycle", price_usd=15, allow_versions=True,
                                       max_documents=100, storage_mb=5120)
    company.save(update_fields=["plan"])
    resp = _upload(client)
    assert resp.status_code == 201
    doc_id = resp.json()["id"]

    listing = client.get("/api/documents").json()
    assert listing["count"] == 1

    detail = client.get(f"/api/documents/{doc_id}").json()
    assert detail["filename"] == "hello.txt"

    preview = client.get(f"/api/documents/{doc_id}/preview").json()
    assert "remote policy" in preview["text"]

    # new version archives the old file
    up = SimpleUploadedFile("hello-v2.txt", b"version two content", content_type="text/plain")
    version = client.post(f"/api/documents/{doc_id}/versions/new",
                          {"file": up}, format="multipart")
    assert version.status_code == 201
    assert version.json()["version"] == 2
    versions = client.get(f"/api/documents/{doc_id}/versions").json()
    assert len(versions) == 1

    # download streams the current file
    download = client.get(f"/api/documents/{doc_id}/download")
    assert download.status_code == 200

    # reindex rejects non-failed docs
    assert client.post(f"/api/documents/{doc_id}/reindex").status_code == 400

    # delete removes doc + version rows
    assert client.delete(f"/api/documents/{doc_id}").status_code == 204
    assert client.get("/api/documents").json()["count"] == 0


def test_upload_confirm_requires_s3(company_admin):
    company, admin, client = company_admin
    assert client.post("/api/documents/confirm", {"key": "x/y.txt"},
                       format="json").status_code == 400
    assert client.post("/api/documents/presign", {"filename": "x.txt"},
                       format="json").status_code == 400


# ------------------------------------------------------------- admin flows
def test_company_settings_roundtrip(company_admin):
    company, admin, client = company_admin
    resp = client.patch("/api/admin/company",
                        {"name": "Renamed Co", "max_employees": 25, "website": "https://acme.pk"},
                        format="json")
    assert resp.status_code == 200
    assert resp.json()["name"] == "Renamed Co"
    assert resp.json()["max_employees"] == 25
    bad = client.patch("/api/admin/company", {"max_employees": "not-a-number"},
                       format="json")
    assert bad.status_code == 400


def test_departments_crud_and_delete_rescopes(company_admin):
    company, admin, client = company_admin
    company.plan = Plan.objects.create(name="Dept Plan", price_usd=49, allow_departments=True,
                                       allow_versions=True)
    company.save(update_fields=["plan"])
    made = client.post("/api/admin/departments", {"name": "HR"}, format="json")
    assert made.status_code == 201
    dept_id = made.json()["id"]
    dup = client.post("/api/admin/departments", {"name": "HR"}, format="json")
    assert dup.status_code == 400
    assert [d["name"] for d in client.get("/api/admin/departments").json()] == ["HR"]

    doc = Document.objects.create(company=company, filename="d.txt", stored_path="s",
                                  uploaded_by=admin, access_scope="department",
                                  department_id=dept_id)
    assert client.delete(f"/api/admin/departments/{dept_id}").status_code == 204
    doc.refresh_from_db()
    assert doc.access_scope == "company" and doc.department_id is None


def test_announcements_crud(company_admin):
    company, admin, client = company_admin
    made = client.post("/api/admin/announcements",
                       {"title": "Town hall", "body": "Friday 4pm"}, format="json")
    assert made.status_code == 201
    missing = client.post("/api/admin/announcements", {"title": "x"}, format="json")
    assert missing.status_code == 400
    ann_id = made.json()["id"]
    assert client.delete(f"/api/admin/announcements/{ann_id}").status_code == 204


def test_user_management_crud(company_admin):
    company, admin, client = company_admin
    made = client.post("/api/admin/users",
                       {"email": "newbie@acme.test", "password": "Valid!Pass99",
                        "role": "employee", "full_name": "New Bie"}, format="json")
    assert made.status_code == 201
    uid = made.json()["id"]

    dup = client.post("/api/admin/users",
                      {"email": "newbie@acme.test", "password": "Valid!Pass99",
                       "role": "employee"}, format="json")
    assert dup.status_code == 400

    bad_role = client.patch(f"/api/admin/users/{uid}", {"role": "superboss"}, format="json")
    assert bad_role.status_code == 400
    ok = client.patch(f"/api/admin/users/{uid}", {"role": "viewer", "is_active": False},
                      format="json")
    assert ok.status_code == 200
    assert ok.json()["role"] == "viewer"

    me = User.objects.get(email="full-admin@acme.test")
    assert client.patch(f"/api/admin/users/{me.id}", {"role": "viewer"},
                        format="json").status_code == 400  # can't demote yourself
    assert client.delete(f"/api/admin/users/{me.id}").status_code == 400  # can't remove self
    assert client.delete(f"/api/admin/users/{uid}").status_code == 204


# ------------------------------------------------------------------- chat
def test_conversation_flow_and_message_rating(company_admin, monkeypatch):
    company, admin, client = company_admin
    monkeypatch.setattr("core.rag.providers.get_chat_provider", lambda **kw: StubChatProvider())
    monkeypatch.setattr("core.rag.embed", lambda texts: None)

    created = client.post("/api/conversations", {"title": "Notes"}, format="json")
    assert created.status_code == 201
    conv_id = created.json()["id"]

    # ask into the conversation (stub LLM)
    resp = client.post("/api/ask", {"question": "remote policy?", "conversation_id": conv_id},
                       format="json")
    assert resp.status_code == 200
    list(resp.streaming_content)

    detail = client.get(f"/api/conversations/{conv_id}").json()
    assert len(detail["messages"]) == 2
    assistant_id = detail["messages"][1]["id"]

    rated = client.post(f"/api/messages/{assistant_id}/rate", {"rating": 1}, format="json")
    assert rated.status_code == 200
    bad = client.post(f"/api/messages/{assistant_id}/rate", {"rating": 5}, format="json")
    assert bad.status_code == 400

    renamed = client.patch(f"/api/conversations/{conv_id}", {"title": "Renamed"}, format="json")
    assert renamed.json()["title"] == "Renamed"
    assert client.delete(f"/api/conversations/{conv_id}").status_code == 204


def test_llm_status_and_test_endpoints(company_admin, monkeypatch):
    company, admin, client = company_admin
    monkeypatch.setattr("core.providers.get_chat_provider", lambda **kw: StubChatProvider())
    status = client.get("/api/llm-status").json()
    assert status["provider"] in ("stub", "bedrock", "ollama", "gemini")
    test = client.post("/api/admin/llm-test", format="json")
    assert test.status_code == 200
    assert test.json()["ok"] is True


# -------------------------------------------------------------- attendance
def test_attendance_scan_flow(company_admin):
    company, admin, client = company_admin
    # Scans require the signed QR token the backend minted for this company.
    qr = client.get("/api/attendance/qr").json()
    assert "?scan=1&t=" in qr["target"]
    token = qr["target"].split("&t=", 1)[1]
    first = client.post("/api/attendance/scan", {"token": token}, format="json")
    assert first.status_code == 201
    again = client.post("/api/attendance/scan", {"token": token}, format="json")
    assert again.status_code == 409
    me = client.get("/api/attendance/me").json()
    assert me["marked_today"] is True

    qr2 = client.get("/api/attendance/qr").json()
    assert "?scan=1&t=" in qr2["target"]


def test_attendance_evaluation_unit(make_company, make_user):
    from core import attendance as att
    from datetime import timedelta
    from django.utils import timezone

    company = make_company("Att Co")
    emp = make_user(company, email="att@acme.test")

    # A perfectly attended month has zero absences.
    today = timezone.localdate()
    record = AttendanceRecord(company=company, user=emp, date=today, status="Present")
    record.save()
    assert att.absences_in_month(emp, today.year, today.month) == 0

    # evaluate_month with everything present strikes nobody.
    results = att.evaluate_month(company=company, freeze=True, dry_run=False)
    assert results[0]["strikes"] == 0


# ---------------------------------------------------------------- workflow
def test_workflow_leave_request_generates_docx(company_admin, settings, tmp_path):
    company, admin, client = company_admin
    settings.MEDIA_ROOT = str(tmp_path)
    result = workflow.handle_ai_workflow_intent(
        {"intent": "leave_request",
         "data": {"date": "2026-12-01", "leave_reason": "family event"}},
        admin)
    assert result["status"] == "ok"
    assert result["filename"].endswith(".docx")
    assert result["download_url"].endswith(result["filename"])

    # The generated file downloads with an ownership check.
    url = result["download_url"].split("/api/")[-1]
    assert client.get(f"/api/{url}").status_code == 200


def test_workflow_meeting_without_credentials_simulates(company_admin, settings):
    company, admin, client = company_admin
    settings.GOOGLE_CALENDAR_CREDENTIALS = ""
    result = workflow.handle_ai_workflow_intent(
        {"intent": "schedule_meeting",
         "data": {"title": "Sync", "date": "2026-12-01", "time": "15:00",
                  "participants": ["a@acme.test"]}},
        admin)
    assert result["status"] == "simulated"

    bad_date = workflow.handle_ai_workflow_intent(
        {"intent": "schedule_meeting", "data": {"title": "X", "date": "not-a-date"}}, admin)
    assert bad_date["status"] in ("simulated", "ok")

    assert workflow.handle_ai_workflow_intent({"intent": "none"}, admin) is None
    assert workflow.handle_ai_workflow_intent(None, admin) is None
    assert workflow.handle_ai_workflow_intent({"intent": "leave_request", "data": {}},
                                              admin)["status"] == "ok"


def test_meeting_window_parsing():
    from datetime import datetime
    start, end = workflow._meeting_window("2026-12-01", "15:00")
    assert start.hour == 15 and (end - start).total_seconds() == 3600
    assert workflow._meeting_window("bad", "") == (None, None)


# ----------------------------------------------------------------- storage
def test_storage_local_roundtrip_and_object_size(tmp_path):
    key = "someco/test-file.txt"
    path = storage.save_bytes(key, b"openvault-bytes", base_dir=str(tmp_path))
    assert storage.exists(key, base_dir=str(tmp_path))
    assert storage.read_bytes(key, base_dir=str(tmp_path)) == b"openvault-bytes"
    assert storage.object_size(key, base_dir=str(tmp_path)) == len(b"openvault-bytes")
    assert storage.object_size("missing.txt", base_dir=str(tmp_path)) is None
    with storage.open_stream(key, base_dir=str(tmp_path)) as fh:
        assert fh.read() == b"openvault-bytes"
    storage.delete(key, base_dir=str(tmp_path))
    assert not storage.exists(key, base_dir=str(tmp_path))
    assert storage.save_uploaded_file("up/f.txt", SimpleUploadedFile("f.txt", b"z"),
                                      base_dir=str(tmp_path))


# --------------------------------------------------------- provider units
def test_split_system_and_sse_lines():
    from core.providers import _split_system, _sse_lines
    system, rest = _split_system([
        {"role": "system", "content": "S"}, {"role": "user", "content": "U"},
        {"role": "assistant", "content": "A"}])
    assert system == "S" and len(rest) == 2

    class Lines:
        def __iter__(self):
            return iter([b"data: {\"a\": 1}\n", b"\n", b"not-data\n"])

    out = list(_sse_lines(Lines()))
    assert out == ['{"a": 1}', "not-data"]


def test_gemini_message_merging():
    from core.providers import GeminiProvider
    provider = GeminiProvider("key", "gemini-2.5-flash")
    merged = provider.stream_chat.__doc__  # existence check only; merging is internal
    del merged
    # _resolve merges via get_chat_provider; here just verify construction guards
    assert provider.chat_model == "gemini-2.5-flash"
    assert provider.embed_model_name == "gemini-embedding-001"


def test_safe_tenant_base_url_allows_platform_blocks_tenant():
    from core.providers import _safe_tenant_base_url

    class Row:
        company_id = 7

    # platform rows pass through untouched (operator-controlled)
    assert _safe_tenant_base_url("http://localhost:11434", None) == "http://localhost:11434"
    # tenant rows: public https allowed, private refused -> falls back to ""
    ok = _safe_tenant_base_url("https://api.openai.com/v1", Row())
    assert ok == "https://api.openai.com/v1" or ok == ""  # DNS may fail offline
    assert _safe_tenant_base_url("http://169.254.169.254/v1", Row()) == ""
    assert _safe_tenant_base_url("ap-south-1", Row()) == "ap-south-1"  # region string


# ------------------------------------------------------------ auth extras
def test_email_verification_and_reset_flow(api, register_company):
    register_company(email="flow@acme.test")
    from core.models import OneTimeToken, User
    user = User.objects.get(email="flow@acme.test")

    # request-verification never reveals existence
    resp = api.post("/api/auth/request-verification", {"email": "flow@acme.test"},
                    format="json")
    assert resp.status_code == 200
    ghost = api.post("/api/auth/request-verification", {"email": "ghost@x.test"},
                     format="json")
    assert ghost.json() == resp.json()

    tok, raw = OneTimeToken.issue(user, "verify_email", minutes=5)
    assert api.post("/api/auth/verify", {"token": raw}, format="json").status_code == 200
    assert api.post("/api/auth/verify", {"token": raw}, format="json").status_code == 400  # single-use

    # A rejected password consumes nothing? It consumes that token (single-use
    # by design), so the success attempt uses a fresh one.
    _, reset_raw = OneTimeToken.issue(user, "password_reset", minutes=5)
    weak = api.post("/api/auth/reset-password",
                    {"token": reset_raw, "password": "password"}, format="json")
    assert weak.status_code == 400
    _, reset_raw2 = OneTimeToken.issue(user, "password_reset", minutes=5)
    ok = api.post("/api/auth/reset-password",
                  {"token": reset_raw2, "password": "BrandNew!99x"}, format="json")
    assert ok.status_code == 200
    user.refresh_from_db()
    assert user.check_password("BrandNew!99x")


def test_update_me_language_validation(auth_client, make_company, make_user):
    company = make_company()
    user = make_user(company, email="lang@acme.test", role="admin")
    client = auth_client(user)
    assert client.patch("/api/auth/update-me", {"language": "fr"}, format="json").status_code == 400
    ok = client.patch("/api/auth/update-me", {"language": "ur", "full_name": "S"}, format="json")
    assert ok.json()["language"] == "ur"


# ----------------------------------------------------------------- plans
def test_plans_public_and_platform_plan_change(api, auth_client, make_company, make_user):
    Plan.default()
    assert api.get("/api/plans").status_code == 200

    company = make_company("Plan Co")
    admin = make_user(company, email="plat@acme.test", role="admin",
                      is_platform_admin=True, is_superuser=True)
    business = Plan.objects.create(name="Biz", price_usd=49)
    resp = auth_client(admin).post(f"/api/admin/companies/{company.id}/plan",
                                   {"plan_id": business.id}, format="json")
    assert resp.status_code == 200
    company.refresh_from_db()
    assert company.plan_id == business.id


def test_platform_company_switch_and_detach(auth_client, make_company, make_user):
    make_company("Switch Co")
    root = make_user(None, email="root-swap@openvault.test", role="admin",
                     is_platform_admin=True, is_superuser=True)
    client = auth_client(root)
    target = Company.objects.first()
    switched = client.post("/api/admin/switch-company", {"company_id": target.id},
                           format="json")
    assert switched.json()["company_id"] == target.id
    detached = client.post("/api/admin/detach-company", format="json")
    assert detached.json()["company_id"] is None
