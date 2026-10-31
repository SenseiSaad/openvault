"""TOTP two-factor login for platform admins (API + Django admin gate)."""
import pytest
from django.test import Client

from core import mfa
from core.models import User

from .conftest import PASSWORD, make_user  # noqa: F401  (fixtures import for IDE)

pytestmark = pytest.mark.django_db


def _make_platform_admin(make_company, make_user):
    company = make_company("Root Co")
    return make_user(company, email="root@openvault.test", role="admin",
                     is_platform_admin=True, is_superuser=True, is_staff=True)


def _code_for(secret):
    import time
    from core.mfa import _code_at
    return _code_at(secret, int(time.time()) // 30)


def test_platform_admin_login_requires_enrollment_then_activate(api, make_company, make_user):
    _make_platform_admin(make_company, make_user)

    resp = api.post("/api/auth/login", {"email": "root@openvault.test", "password": PASSWORD},
                    format="json")
    assert resp.status_code == 200
    body = resp.json()
    assert body["mfa_required"] is True
    assert body["enrollment"]["secret"]
    assert body["enrollment"]["uri"].startswith("otpauth://totp/")
    # No session cookies yet: the password alone must never sign a root admin in.
    assert "openvault_access" not in api.cookies

    activate = api.post("/api/auth/mfa/activate",
                        {"challenge": body["challenge"],
                         "code": _code_for(body["enrollment"]["secret"])},
                        format="json")
    assert activate.status_code == 200
    assert api.get("/api/auth/me").status_code == 200

    user = User.objects.get(email="root@openvault.test")
    assert user.mfa_enabled is True
    assert user.mfa_secret == body["enrollment"]["secret"]


def test_platform_admin_second_login_uses_verify_step(api, make_company, make_user):
    _make_platform_admin(make_company, make_user)
    first = api.post("/api/auth/login", {"email": "root@openvault.test", "password": PASSWORD},
                     format="json").json()
    api.post("/api/auth/mfa/activate",
             {"challenge": first["challenge"], "code": _code_for(first["enrollment"]["secret"])},
             format="json")
    api.cookies.clear()

    second = api.post("/api/auth/login", {"email": "root@openvault.test", "password": PASSWORD},
                      format="json").json()
    assert second["mfa_required"] is True
    assert "enrollment" not in second

    wrong = api.post("/api/auth/mfa/verify",
                     {"challenge": second["challenge"], "code": "000000"}, format="json")
    assert wrong.status_code == 400
    assert "openvault_access" not in api.cookies

    ok = api.post("/api/auth/mfa/verify",
                  {"challenge": second["challenge"], "code": _code_for(User.objects.get(
                      email="root@openvault.test").mfa_secret)}, format="json")
    assert ok.status_code == 200
    assert api.get("/api/auth/me").status_code == 200


def test_mfa_challenge_tokens_are_single_purpose_and_shortlived():
    token = mfa.issue_challenge(1, "login")
    assert mfa.read_challenge(token, "login") is not None
    assert mfa.read_challenge(token, "enroll") is None  # purpose mismatch
    assert mfa.read_challenge(token[:-2] + "xx", "login") is None  # tampered


def test_regular_company_login_has_no_mfa_step(api, register_company):
    register_company(email="admin@acme.test")
    resp = api.post("/api/auth/login", {"email": "admin@acme.test", "password": PASSWORD},
                    format="json")
    assert resp.status_code == 200
    assert "mfa_required" not in resp.json()
    assert api.get("/api/auth/me").status_code == 200


def test_django_admin_redirects_to_totp_gate(make_company, make_user):
    user = _make_platform_admin(make_company, make_user)
    client = Client()
    client.force_login(user)

    resp = client.get("/admin/")
    assert resp.status_code == 302
    assert resp["Location"].startswith("/admin/mfa-enroll/")

    # Complete enrollment through the admin form.
    enroll_page = client.get(resp["Location"])
    assert b"Set up two-factor authentication" in enroll_page.content
    secret = client.session["mfa_enroll_secret"]
    verify = client.post(f"/admin/mfa-enroll/?next=/admin/", {"code": _code_for(secret)})
    assert verify.status_code == 302
    assert client.get("/admin/").status_code == 200

    # A fresh session (new client) must verify again.
    fresh = Client()
    fresh.force_login(user)
    gate = fresh.get("/admin/")
    assert gate["Location"].startswith("/admin/mfa-verify/")
    wrong = fresh.post("/admin/mfa-verify/?next=/admin/", {"code": "000000"})
    assert b"did not match" in wrong.content
