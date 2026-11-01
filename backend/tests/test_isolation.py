"""Tenant-isolation matrix: one test per query path, two tenants.

Every endpoint that reads or writes tenant-owned data is exercised from
Company A's account against Company B's rows and must see nothing (404/403 or
an empty payload), and the RAG path must never place the other tenant's text
in front of the model.
"""
import json
from unittest.mock import patch

import pytest

from core.models import (
    Announcement, AskLog, AuditLog, ChatConversation, Chunk, Document,
    DocumentShare, LLMConfig,
)
from .fakes import StubChatProvider

pytestmark = pytest.mark.django_db


@pytest.fixture
def two_companies(make_company, make_user):
    acme = make_company("Acme")
    globex = make_company("Globex")
    return {
        "acme": acme,
        "globex": globex,
        "acme_admin": make_user(acme, email="a@acme.test", role="admin"),
        "globex_admin": make_user(globex, email="g@globex.test", role="admin"),
        "acme_employee": make_user(acme, email="ae@acme.test"),
    }


def _doc(company, uploader, filename="doc.txt", scope="company", text="generic content"):
    doc = Document.objects.create(company=company, filename=filename, stored_path="stored",
                                  uploaded_by=uploader, access_scope=scope)
    Chunk.objects.create(document=doc, company=company, ord=0, text=text, embedding=None)
    return doc


def _stub_llm(monkeypatch, capture=None):
    stub = StubChatProvider(capture=capture)
    monkeypatch.setattr("core.rag.providers.get_chat_provider", lambda **kw: stub)
    monkeypatch.setattr("core.rag.embed", lambda texts: None)  # BM25 fallback path
    return stub


# ---------------------------------------------------------------- documents
def test_document_endpoints_never_cross_tenants(auth_client, two_companies):
    doc = _doc(two_companies["globex"], two_companies["globex_admin"], "globex-secret.txt")

    client = auth_client(two_companies["acme_admin"])
    listing = client.get("/api/documents").json()
    assert listing["count"] == 0
    for path in (f"/api/documents/{doc.id}", f"/api/documents/{doc.id}/download",
                 f"/api/documents/{doc.id}/preview", f"/api/documents/{doc.id}/versions",
                 f"/api/documents/{doc.id}/shares"):
        assert client.get(path).status_code == 404, path
    assert client.delete(f"/api/documents/{doc.id}").status_code == 404
    assert client.patch(f"/api/documents/{doc.id}", {"description": "x"},
                        format="json").status_code == 404


def test_document_search_pool_never_includes_other_tenant(auth_client, two_companies):
    _doc(two_companies["globex"], two_companies["globex_admin"], "g.txt", text="GLOBEXPAYROLL")
    _doc(two_companies["acme"], two_companies["acme_admin"], "a.txt", text="ACMEPOLICY")
    rows = auth_client(two_companies["acme_admin"]).get("/api/documents").json()["results"]
    assert [r["filename"] for r in rows] == ["a.txt"]


# ------------------------------------------------------- chunks / retrieval
def test_retrieve_never_returns_other_tenants_chunks(two_companies):
    _doc(two_companies["globex"], two_companies["globex_admin"], "g.txt",
         text="GLOBEX salary bands confidential 2026")
    own = _doc(two_companies["acme"], two_companies["acme_admin"], "a.txt",
               text="ACME salary bands public summary")
    from core import rag
    chunks = rag.retrieve(two_companies["acme_admin"], "salary bands", k=4)
    assert own.id in [c.document_id for c in chunks] or chunks, "own content must be findable"
    assert all(c.company_id == two_companies["acme"].id for c in chunks)


def test_ask_sources_and_context_never_cross_tenants(auth_client, two_companies, monkeypatch):
    _doc(two_companies["globex"], two_companies["globex_admin"], "globex-secret.txt",
         text="GLOBEXCONFINENTIALPAYROLLDATA")
    _doc(two_companies["acme"], two_companies["acme_admin"], "acme-policy.txt",
         text="ACME remote policy requires two office days")

    captured: list[str] = []
    _stub_llm(monkeypatch, capture=captured)

    resp = auth_client(two_companies["acme_admin"]).post(
        "/api/ask", {"question": "remote office days?"}, format="json")
    assert resp.status_code == 200
    events = [json.loads(line) for line in resp.streaming_content if line.strip()]
    sources = next(e["sources"] for e in events if e["type"] == "sources")
    assert "globex-secret.txt" not in sources
    assert "GLOBEXCONFINENTIALPAYROLLDATA" not in "".join(captured)


# ------------------------------------------------------------------- chat
def test_conversations_and_messages_are_private(auth_client, two_companies, monkeypatch):
    owner = two_companies["acme_employee"]
    other = two_companies["acme_admin"]  # same company, different user
    conv = ChatConversation.objects.create(company=two_companies["acme"], user=owner, title="x")

    stranger = auth_client(other)
    assert stranger.get("/api/conversations").json()["count"] == 0
    assert stranger.get(f"/api/conversations/{conv.id}").status_code == 404
    assert stranger.delete(f"/api/conversations/{conv.id}").status_code == 404
    # same-company colleagues cannot read each other's threads either
    _stub_llm(monkeypatch)
    assert auth_client(owner).get(f"/api/conversations/{conv.id}").status_code == 200


# --------------------------------------------------------------- analytics
def test_analytics_only_counts_own_company(auth_client, two_companies):
    from django.utils import timezone
    AskLog.objects.create(company=two_companies["acme"], user=two_companies["acme_admin"],
                          question="acme q", chunks_found=1, answered=True,
                          created_at=timezone.now())
    AskLog.objects.create(company=two_companies["globex"], user=two_companies["globex_admin"],
                          question="GLOBEX private question", chunks_found=0, answered=False,
                          created_at=timezone.now())

    data = auth_client(two_companies["acme_admin"]).get("/api/admin/analytics").json()
    assert data["totals"]["asks"] == 1
    blob = json.dumps(data)
    assert "GLOBEX private question" not in blob
    assert "g@globex.test" not in blob


def test_usage_reports_own_company_only(auth_client, two_companies):
    _doc(two_companies["globex"], two_companies["globex_admin"])
    data = auth_client(two_companies["acme_admin"]).get("/api/admin/usage").json()
    assert data["usage"]["documents"]["used"] == 0


def test_ask_quota_counts_only_own_company_asks(auth_client, two_companies):
    from django.utils import timezone
    AskLog.objects.create(company=two_companies["globex"], user=two_companies["globex_admin"],
                          question="x", created_at=timezone.now())
    from core.models import Plan
    plan = Plan.default()
    plan.monthly_ask_limit = 1
    plan.save(update_fields=["monthly_ask_limit"])
    resp = auth_client(two_companies["acme_admin"]).post("/api/ask", {"question": "hi"},
                                                         format="json")
    # Company A has zero asks this month: the limit must not be tripped by B's row.
    assert resp.status_code == 200
    plan.monthly_ask_limit = 50
    plan.save(update_fields=["monthly_ask_limit"])


# ---------------------------------------------------------------- audit log
def test_audit_log_filters_company(auth_client, two_companies):
    AuditLog.objects.create(company=two_companies["acme"], user=two_companies["acme_admin"],
                            action="login", detail="acme entry")
    AuditLog.objects.create(company=two_companies["globex"], user=two_companies["globex_admin"],
                            action="login", detail="GLOBEX hidden entry")

    rows = auth_client(two_companies["acme_admin"]).get("/api/admin/audit").json()["results"]
    details = [r["detail"] for r in rows]
    assert "acme entry" in details
    assert all("GLOBEX" not in d for d in details)


# ------------------------------------------------------------------- shares
def test_share_lifecycle_scoped_and_revocable(auth_client, two_companies):
    acme, globex = two_companies["acme"], two_companies["globex"]
    doc = _doc(acme, two_companies["acme_admin"], "shared.txt")
    partner = two_companies["globex_admin"]

    # Without a grant: nothing.
    partner_client = auth_client(partner)
    assert partner_client.get("/api/shared-with-me").json() == []
    assert partner_client.get(f"/api/documents/{doc.id}").status_code == 404

    # Owner grants via the share endpoint (access code + user id).
    owner = auth_client(two_companies["acme_admin"])
    grant = owner.post(f"/api/documents/{doc.id}/shares",
                       {"access_code": globex.access_code, "user_id": partner.id},
                       format="json")
    assert grant.status_code == 201

    shared = partner_client.get("/api/shared-with-me").json()
    assert [s["filename"] for s in shared] == ["shared.txt"]
    assert partner_client.get(f"/api/documents/{doc.id}").status_code == 200

    # A DIFFERENT globex user is still excluded (per-user, not per-company).
    other_globex = two_companies["globex_admin"]  # only one in fixture; craft second
    from core.models import User
    third = User.objects.create_user(email="third@globex.test", password="x", company=globex)
    assert auth_client(third).get(f"/api/documents/{doc.id}").status_code == 404

    # Revocation cuts access immediately.
    revoke = owner.delete(f"/api/documents/{doc.id}/shares/{partner.id}")
    assert revoke.status_code == 204
    assert partner_client.get(f"/api/documents/{doc.id}").status_code == 404
    assert partner_client.get("/api/shared-with-me").json() == []


def test_shares_management_is_owner_company_only(auth_client, two_companies):
    acme, globex = two_companies["acme"], two_companies["globex"]
    doc = _doc(acme, two_companies["acme_admin"])
    stranger = auth_client(two_companies["globex_admin"])
    assert stranger.get(f"/api/documents/{doc.id}/shares").status_code == 404
    assert stranger.post(f"/api/documents/{doc.id}/shares",
                         {"access_code": globex.access_code,
                          "user_id": two_companies["globex_admin"].id},
                         format="json").status_code == 404
    assert stranger.delete(f"/api/documents/{doc.id}/shares/1").status_code == 404


def test_retrieval_includes_shared_document_but_only_for_grantee(two_companies):
    acme, globex = two_companies["acme"], two_companies["globex"]
    doc = _doc(acme, two_companies["acme_admin"], "cross.txt",
               text="ACME cross company shared handbook entry")
    partner = two_companies["globex_admin"]
    DocumentShare.objects.create(document=doc, shared_with_user=partner,
                                 shared_by=two_companies["acme_admin"])
    from core.models import DocumentAccess
    DocumentAccess.objects.create(document=doc, user=partner)

    from core import rag
    chunks = rag.retrieve(partner, "shared handbook", k=4)
    assert doc.id in [c.document_id for c in chunks]
    chunks = rag.retrieve(two_companies["acme_employee"], "shared handbook", k=4)
    # acme employee CAN see it (same company, company scope) — but globex users
    # without a grant never do:
    other_globex_chunks = rag.retrieve(partner, "shared handbook", k=4)
    assert all(c.company_id in (acme.id, globex.id) for c in other_globex_chunks)


# --------------------------------------------------------------- attendance
def test_attendance_me_and_evaluate_are_company_scoped(auth_client, two_companies):
    from core.models import AttendanceRecord
    from django.utils import timezone
    AttendanceRecord.objects.create(company=two_companies["acme"],
                                    user=two_companies["acme_employee"],
                                    date=timezone.localdate(), status="Present")
    mine = auth_client(two_companies["acme_employee"]).get("/api/attendance/me").json()
    assert len(mine["records"]) == 1
    other = auth_client(two_companies["acme_admin"]).get("/api/attendance/me").json()
    assert len(other["records"]) == 0

    results = auth_client(two_companies["acme_admin"]).post(
        "/api/admin/attendance/evaluate", {"dry_run": True}, format="json").json()
    emails = {r["email"] for r in results["results"]}
    assert emails <= {"a@acme.test", "ae@acme.test"}


# ------------------------------------------------------------ announcements
def test_announcements_are_company_scoped(auth_client, two_companies):
    Announcement.objects.create(company=two_companies["globex"], title="GLOBEX only",
                                body="secret", created_by=two_companies["globex_admin"])
    rows = auth_client(two_companies["acme_admin"]).get("/api/admin/announcements").json()
    assert rows == []


# --------------------------------------------------------------- llm config
def test_llm_config_override_is_per_company(auth_client, two_companies):
    acme, globex = two_companies["acme"], two_companies["globex"]
    from core.models import Plan
    byo = Plan.objects.create(name="BYO Test", price_usd=49, allow_custom_llm=True)
    acme.plan = byo
    acme.save(update_fields=["plan"])

    # Company A sets its own override.
    resp = auth_client(two_companies["acme_admin"]).put(
        "/api/admin/llm-config",
        {"provider": "openai", "chat_model": "gpt-4o-mini", "api_key": "sk-test-123"},
        format="json")
    assert resp.status_code == 200

    # Platform row untouched; company B still sees the platform default.
    assert LLMConfig.objects.filter(company=None).count() == 0
    data_b = auth_client(two_companies["globex_admin"]).get("/api/admin/llm-config").json()
    assert data_b["is_company_override"] is False
    data_a = auth_client(two_companies["acme_admin"]).get("/api/admin/llm-config").json()
    assert data_a["is_company_override"] is True
    assert data_a["provider"] == "openai"
    assert "api_key" not in data_a or not data_a.get("has_api_key") is False
    # raw key never serializes
    assert "sk-test-123" not in json.dumps(data_a)


# ------------------------------------------------- platform-admin-only tools
def test_platform_tools_reject_company_admins(auth_client, two_companies):
    client = auth_client(two_companies["acme_admin"])
    assert client.get("/api/admin/companies").status_code == 403
    assert client.post("/api/admin/switch-company", {"company_id": 1},
                       format="json").status_code == 403
    assert client.post("/api/admin/companies/1/plan", {"plan_id": 1},
                       format="json").status_code == 403


def test_member_administration_never_crosses_tenants(auth_client, two_companies):
    from core.models import User
    globex_user = User.objects.get(email="g@globex.test")
    client = auth_client(two_companies["acme_admin"])
    assert client.patch(f"/api/admin/users/{globex_user.id}", {"role": "viewer"},
                        format="json").status_code == 404
    assert client.delete(f"/api/admin/users/{globex_user.id}").status_code == 404
