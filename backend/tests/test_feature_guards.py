"""Tests for Option 2: Feature Flags, Legal Compliance (Warn-Only Attendance),
DocGen Toggles, and Vector Dimension Guards.
"""
import pytest
from core import attendance as att
from core import providers
from core.models import Chunk, Document, LLMConfig
from core.serializers import DocumentSerializer, LLMConfigSerializer


@pytest.mark.django_db
def test_attendance_disabled_blocks_endpoints(make_company, make_user, auth_client):
    company = make_company(name="No Attendance Corp")
    company.enable_attendance = False
    company.save()

    emp = make_user(company, role="employee")
    adm = make_user(company, role="admin")
    c_emp = auth_client(emp)
    c_adm = auth_client(adm)

    # Member endpoints
    res = c_emp.get("/api/attendance/me")
    assert res.status_code == 403
    assert "Attendance tracking is disabled" in res.data["detail"]

    res = c_emp.post("/api/attendance/scan", {"token": "dummy"})
    assert res.status_code == 403

    res = c_emp.get("/api/attendance/qr")
    assert res.status_code == 403

    # Admin endpoints
    res = c_adm.post("/api/admin/attendance/evaluate", {})
    assert res.status_code == 403

    res = c_adm.get("/api/admin/attendance/holidays")
    assert res.status_code == 403

    res = c_adm.get("/api/admin/attendance/exemptions")
    assert res.status_code == 403


@pytest.mark.django_db
def test_attendance_warn_only_by_default_preserves_active_account(make_company, make_user, settings):
    settings.ATTENDANCE_MONTHLY_ABSENCE_LIMIT = 1
    settings.ATTENDANCE_MAX_STRIKES = 1

    company = make_company(name="Warn Only Corp")
    assert company.attendance_auto_freeze is False  # default is warn-only!

    emp = make_user(company, email="warn@acme.test")

    # Evaluate past month without explicit freeze argument (freeze=None)
    # Warn-only mode must record strike and flag is_frozen, but NEVER deactivate is_active.
    results = att.evaluate_month(year=2026, month=10, company=company, freeze=None, dry_run=False)
    mine = next(r for r in results if r["email"] == emp.email)

    assert mine["new_strike"] is True
    assert mine["is_frozen"] is True
    assert mine["deactivated"] is False  # account was NOT deactivated!

    emp.refresh_from_db()
    assert emp.is_active is True  # Employee can still log in!


@pytest.mark.django_db
def test_attendance_explicit_admin_freeze_or_opt_in(make_company, make_user, settings):
    settings.ATTENDANCE_MONTHLY_ABSENCE_LIMIT = 1
    settings.ATTENDANCE_MAX_STRIKES = 1

    company = make_company(name="Hard Freeze Corp")
    emp = make_user(company, email="freeze_explicit@acme.test")

    # Explicit freeze=True forces deactivation
    results = att.evaluate_month(year=2026, month=10, company=company, freeze=True, dry_run=False)
    mine = next(r for r in results if r["email"] == emp.email)
    assert mine["deactivated"] is True

    emp.refresh_from_db()
    assert emp.is_active is False


@pytest.mark.django_db
def test_docgen_disabled_blocks_endpoints(make_company, make_user, auth_client):
    company = make_company(name="No DocGen Corp")
    company.enable_docgen = False
    company.save()

    emp = make_user(company, role="employee")
    c = auth_client(emp)

    res = c.get("/api/templates")
    assert res.status_code == 403
    assert "Document and template generation is disabled" in res.data["detail"]

    res = c.post("/api/docgen", {"question": "I need a leave form"})
    assert res.status_code == 403


@pytest.mark.django_db
def test_company_settings_can_toggle_feature_flags(make_company, make_user, auth_client):
    company = make_company(name="Toggle Corp")
    adm = make_user(company, role="admin")
    c = auth_client(adm)

    res = c.get("/api/admin/company")
    assert res.status_code == 200
    assert res.data["enable_attendance"] is True
    assert res.data["attendance_auto_freeze"] is False
    assert res.data["enable_docgen"] is True

    # Admin updates flags
    res = c.patch("/api/admin/company", {
        "enable_attendance": False,
        "attendance_auto_freeze": True,
        "enable_docgen": False,
    })
    assert res.status_code == 200
    assert res.data["enable_attendance"] is False
    assert res.data["attendance_auto_freeze"] is True
    assert res.data["enable_docgen"] is False

    company.refresh_from_db()
    assert company.enable_attendance is False
    assert company.attendance_auto_freeze is True
    assert company.enable_docgen is False


@pytest.mark.django_db
def test_embedding_dimension_warning_logic(settings, monkeypatch):
    settings.EMBED_DIM = 1024  # Bedrock Titan v2 width
    monkeypatch.delenv("EMBED_PROVIDER", raising=False)

    # Bedrock matches 1024 -> no warning
    warn = providers.check_embed_dimension_warning("bedrock")
    assert warn == ""

    # Ollama uses 768 -> dimension warning!
    warn = providers.check_embed_dimension_warning("ollama")
    assert "uses 768-dimensional embeddings" in warn
    assert "configured for 1024 dimensions" in warn

    # Serializer surfaces dimension_warning
    cfg = LLMConfig(provider="ollama")
    s = LLMConfigSerializer(cfg)
    assert "768-dimensional" in s.data["dimension_warning"]


@pytest.mark.django_db
def test_document_reindex_required_serializer_field(make_company, monkeypatch):
    company = make_company(name="Reindex Corp")
    doc = Document.objects.create(
        company=company, filename="policy.pdf",
        num_chunks=5, embed_model="old-model-v1",
    )
    # Add a chunk so num_chunks > 0
    Chunk.objects.create(document=doc, company=company, ord=0, text="test")

    # Mock active provider's embed model to be different
    class FakeEmbedProv:
        label = "test"
        embed_model_name = "new-model-v2"
    monkeypatch.setattr(providers, "get_embed_provider", lambda company=None: FakeEmbedProv())

    data = DocumentSerializer(doc).data
    assert data["embed_model"] == "old-model-v1"
    assert data["reindex_required"] is True

    # When models match, reindex_required is False
    doc.embed_model = "new-model-v2"
    doc.save()
    data = DocumentSerializer(doc).data
    assert data["reindex_required"] is False
