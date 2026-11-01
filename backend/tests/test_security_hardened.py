"""Security hardening regressions: rate limits, upload validation, SSRF,
XFF spoofing, document-management permissions, provider-override rule."""
import io
import json
import zipfile
from unittest.mock import patch

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile

from core.models import Document, LLMConfig
from core.netguard import UnsafeURLError, validate_public_url
from core.ratelimit import _client_ip
from core.views import client_ip
from .fakes import StubChatProvider

pytestmark = pytest.mark.django_db


# ------------------------------------------------------------- rate limits
@pytest.fixture
def limits_on(settings):
    # The LocMem cache persists across the whole test process; earlier tests'
    # registrations share this test's IP key, so start every limiter test clean.
    # NOTE: RATELIMIT_ENABLED is set inside each test BODY (after all fixtures)
    # because fixture-vs-autouse ordering made it flaky in full-suite runs.
    from django.core.cache import cache
    cache.clear()
    settings.RATELIMIT_ENABLED = True
    return settings


class _FrozenClock:
    """Deterministic clock: the fixed-window limiter must see one stable
    window even though real logins take ~150ms of password hashing each and
    can otherwise straddle a 60s boundary."""

    def __init__(self, start=1_800_000_000.5):
        self.now = start

    def time(self):
        return self.now


def test_login_rate_limit_blocks_the_ninth_attempt(api, register_company, limits_on,
                                                   monkeypatch):
    settings = limits_on
    settings.RATELIMIT_ENABLED = True
    monkeypatch.setattr("core.ratelimit.time", _FrozenClock())
    register_company(email="rl@acme.test")
    codes = []
    for _ in range(9):
        resp = api.post("/api/auth/login", {"email": "rl@acme.test", "password": "wrong"},
                        format="json", REMOTE_ADDR="10.9.9.1")
        codes.append(resp.status_code)
    assert codes[:8] == [401] * 8, codes
    assert codes[8] == 429, codes
    assert "Retry-After" in resp


def test_ask_rate_limit_is_per_user(api, auth_client, make_company, make_user, limits_on,
                                    monkeypatch):
    settings = limits_on
    settings.RATELIMIT_ENABLED = True
    monkeypatch.setattr("core.ratelimit.time", _FrozenClock())
    from .fakes import StubChatProvider
    company = make_company()
    admin = make_user(company, email="askrl@acme.test", role="admin")
    stub = StubChatProvider()
    monkeypatch.setattr("core.rag.providers.get_chat_provider", lambda **kw: stub)
    monkeypatch.setattr("core.rag.embed", lambda texts: None)

    client = auth_client(admin)
    codes = []
    for i in range(21):
        resp = client.post("/api/ask", {"question": f"q{i}"}, format="json")
        codes.append(resp.status_code)
    assert codes[:20] == [200] * 20
    assert codes[20] == 429


def test_rate_limit_counter_is_atomic_fixed_window(limits_on):
    """Two increments from the same identity must count as 2 (the old
    read-modify-write list lost increments under concurrency)."""
    from django.core.cache import cache
    from core.ratelimit import _increment
    key = "rl:test-atomic:someone"
    cache.delete(key)
    assert _increment(key, 60) == 1
    assert _increment(key, 60) == 2
    assert _increment(key, 60) == 3


# -------------------------------------------------------- upload rejection
def _upload_response(auth_client, user, name, content=b"hello", **extra):
    upload = SimpleUploadedFile(name, content, content_type="application/octet-stream")
    return auth_client(user).post("/api/documents/upload",
                                  {"file": upload, "access_scope": "company", **extra},
                                  format="multipart")


def test_upload_rejects_disallowed_extensions(auth_client, make_company, make_user):
    company = make_company()
    admin = make_user(company, email="up@acme.test", role="admin")
    for name in ("payload.exe", "script.sh", "page.html", "archive.zip", "noextension"):
        resp = _upload_response(auth_client, admin, name)
        assert resp.status_code == 400, name
        assert "not supported" in resp.json()["detail"]
    assert Document.objects.count() == 0


def test_upload_rejects_oversized_filenames(auth_client, make_company, make_user):
    company = make_company()
    admin = make_user(company, email="up@acme.test", role="admin")
    resp = _upload_response(auth_client, admin, "x" * 300 + ".txt")
    assert resp.status_code == 400
    assert "too long" in resp.json()["detail"]


def test_upload_rejects_docx_zip_bomb(auth_client, make_company, make_user):
    company = make_company()
    admin = make_user(company, email="up@acme.test", role="admin")
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        # 300MB of zeros compresses to ~300KB — classic decompression bomb.
        zf.writestr("word/document.xml", b"0" * (300 * 1024 * 1024))
    resp = _upload_response(auth_client, admin, "bomb.docx", content=buf.getvalue())
    assert resp.status_code == 400
    assert "unsafe compression ratio" in resp.json()["detail"] or \
           "supported size limit" in resp.json()["detail"]
    assert Document.objects.count() == 0


# ------------------------------------------------------------------- SSRF
def test_netguard_blocks_private_and_metadata_targets():
    for bad in ("http://169.254.169.254/latest/meta-data/",
                "https://169.254.169.254/latest/meta-data/",
                "https://127.0.0.1:11434", "https://10.0.0.5/v1",
                "https://192.168.1.10/v1", "https://172.16.0.9/v1",
                "http://localhost:8000", "file:///etc/passwd",
                "https://192.0.2.1/v1"):  # TEST-NET-1 is reserved
        with pytest.raises(UnsafeURLError):
            validate_public_url(bad)


def test_llm_config_serializer_rejects_unsafe_base_url(auth_client, make_company, make_user):
    from core.models import Plan
    company = make_company()
    company.plan = Plan.objects.create(name="BYO SSRF", price_usd=49, allow_custom_llm=True)
    company.save(update_fields=["plan"])
    admin = make_user(company, email="ssrf@acme.test", role="admin")

    resp = auth_client(admin).put("/api/admin/llm-config",
                                  {"provider": "openai", "base_url": "http://169.254.169.254/v1",
                                   "api_key": "sk-x"},
                                  format="json")
    assert resp.status_code == 400
    assert LLMConfig.objects.filter(company=company).count() == 0


def test_llm_test_never_echoes_provider_errors(auth_client, make_company, make_user, monkeypatch):
    company = make_company()
    admin = make_user(company, email="echo@acme.test", role="admin")

    class Exploding:
        label = "stub"
        chat_model = "x"

        def available(self):
            return True

        def stream_chat(self, *a, **k):
            raise RuntimeError("secret-internal-endpoint http://10.0.0.1 rejected")

    monkeypatch.setattr("core.providers.get_chat_provider", lambda **kw: Exploding())
    resp = auth_client(admin).post("/api/admin/llm-test", format="json")
    assert resp.status_code == 200
    assert "secret-internal-endpoint" not in resp.json()["detail"]
    assert "could not be reached" in resp.json()["detail"]


# ------------------------------------------------------------ XFF spoofing
def test_xff_trust_follows_trusted_proxy_count(rf, settings):
    req = rf.post("/api/auth/login", REMOTE_ADDR="10.0.0.1",
                  HTTP_X_FORWARDED_FOR="1.2.3.4, 9.9.9.9")

    settings.TRUSTED_PROXY_COUNT = 0
    assert _client_ip(req) == "10.0.0.1"  # direct exposure: header ignored

    settings.TRUSTED_PROXY_COUNT = 1
    assert _client_ip(req) == "9.9.9.9"   # one proxy: our proxy's entry wins

    settings.TRUSTED_PROXY_COUNT = 2
    assert _client_ip(req) == "1.2.3.4"   # two proxies: one level further back

    # Audit trail uses the same trusted logic.
    settings.TRUSTED_PROXY_COUNT = 0
    assert client_ip(req) == "10.0.0.1"


# ------------------------------------------- item-8 permission boundaries
def test_scope_change_and_delete_need_admin_or_uploader(auth_client, make_company, make_user):
    company = make_company()
    uploader = make_user(company, email="uploader@acme.test")       # employee
    colleague = make_user(company, email="colleague@acme.test")     # employee
    admin = make_user(company, email="admin@acme.test", role="admin")
    doc = Document.objects.create(company=company, filename="doc.txt", stored_path="s",
                                  uploaded_by=uploader, access_scope="company")

    # A colleague employee may edit content but NOT widen the audience or delete.
    colleague_client = auth_client(colleague)
    assert colleague_client.patch(f"/api/documents/{doc.id}", {"description": "ok"},
                                  format="json").status_code == 200
    assert colleague_client.patch(f"/api/documents/{doc.id}", {"access_scope": "restricted"},
                                  format="json").status_code == 403
    assert colleague_client.delete(f"/api/documents/{doc.id}").status_code == 403

    # The uploader (an employee) CAN manage their own document.
    uploader_client = auth_client(uploader)
    assert uploader_client.patch(f"/api/documents/{doc.id}", {"access_scope": "restricted"},
                                 format="json").status_code == 200
    assert uploader_client.patch(f"/api/documents/{doc.id}", {"access_scope": "company"},
                                 format="json").status_code == 200

    # Admins can do both; viewers can do neither.
    assert auth_client(admin).delete(f"/api/documents/{doc.id}").status_code == 204


# ------------------------------------------------- provider override rule
def test_ask_rejects_provider_override_without_company_key(auth_client, make_company,
                                                           make_user, monkeypatch):
    company = make_company()
    admin = make_user(company, email="prov@acme.test", role="admin")
    monkeypatch.setattr("core.rag.providers.get_chat_provider",
                        lambda **kw: StubChatProvider())
    monkeypatch.setattr("core.rag.embed", lambda texts: None)

    resp = auth_client(admin).post("/api/ask",
                                   {"question": "hi", "provider": "gemini"}, format="json")
    assert resp.status_code == 400
    assert "own AI key" in resp.json()["detail"]

    # With a company key configured the override is accepted.
    from core.models import Plan
    company.plan = Plan.objects.create(name="BYO Prov", price_usd=49, allow_custom_llm=True)
    company.save(update_fields=["plan"])
    auth_client(admin).put("/api/admin/llm-config",
                           {"provider": "openai", "api_key": "sk-test"}, format="json")
    resp = auth_client(admin).post("/api/ask",
                                   {"question": "hi", "provider": "openai"}, format="json")
    assert resp.status_code == 200


# -------------------------------------------------------------- moderation
def test_moderation_flags_cnic_and_iban_but_not_benign_text():
    from core.moderation import scan
    assert scan("my CNIC is 42101-1234567-1 please save it").flagged
    assert scan("send salary to PK36SCBL0000001123456702").flagged
    assert not scan("what is the leave policy for this year?").flagged
