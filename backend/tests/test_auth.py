"""Authentication: registration, HttpOnly cookies, refresh rotation, logout."""
import pytest
from rest_framework_simplejwt.token_blacklist.models import (
    BlacklistedToken, OutstandingToken,
)

from core.models import Company, User

from .conftest import PASSWORD

pytestmark = pytest.mark.django_db


def test_register_creates_tenant_and_sets_httponly_cookies(api, register_company):
    resp, _payload = register_company(name="Acme Corp", email="admin@acme.test")
    assert resp.status_code == 201

    company = Company.objects.get(name="Acme Corp")
    admin = User.objects.get(email="admin@acme.test")
    assert admin.company_id == company.id
    assert admin.role == "admin"
    assert company.access_code and len(company.access_code) == 5

    access = resp.cookies["openvault_access"]
    refresh = resp.cookies["openvault_refresh"]
    assert access["httponly"] is True
    assert refresh["httponly"] is True
    assert access["samesite"] == "Lax"
    # Raw tokens only ever live in HttpOnly cookies, never in the JSON body.
    body = resp.content.decode()
    assert access.value not in body
    assert refresh.value not in body
    assert "token" not in resp.json()
    assert "password" not in resp.json()["user"]


def test_me_works_with_cookie_session_and_fails_after_logout(api, register_company):
    register_company(email="admin@acme.test")
    assert api.get("/api/auth/me").status_code == 200
    assert api.post("/api/auth/logout", format="json").status_code == 200
    assert api.get("/api/auth/me").status_code == 401


def test_login_rejects_bad_password(api, register_company):
    register_company(email="admin@acme.test")
    api.post("/api/auth/logout", format="json")
    resp = api.post("/api/auth/login", {"email": "admin@acme.test", "password": "wrong"},
                    format="json")
    assert resp.status_code == 401
    assert "Invalid email or password" in resp.json()["detail"]


def test_weak_passwords_are_rejected(api):
    for weak in ("password", "12345678", "short"):
        resp = api.post("/api/auth/register",
                        {"company_name": "Weak Co", "email": f"w{len(weak)}@x.test",
                         "password": weak}, format="json")
        assert resp.status_code == 400, weak


def test_refresh_rotates_and_blacklists_the_old_token(api, register_company):
    register_company(email="admin@acme.test")
    old_refresh = api.cookies["openvault_refresh"].value
    assert OutstandingToken.objects.count() == 1

    resp = api.post("/api/auth/refresh", format="json")
    assert resp.status_code == 200
    new_refresh = resp.cookies["openvault_refresh"].value
    assert new_refresh != old_refresh

    # The old token was blacklisted during rotation and can no longer be used.
    assert BlacklistedToken.objects.count() == 1
    from rest_framework.test import APIClient
    replay = APIClient()
    replay.cookies["openvault_refresh"] = old_refresh
    assert replay.post("/api/auth/refresh", format="json").status_code == 401


def test_logout_blacklists_the_refresh_token(api, register_company):
    register_company(email="admin@acme.test")
    assert api.post("/api/auth/logout", format="json").status_code == 200
    assert BlacklistedToken.objects.count() == 1
    assert api.post("/api/auth/refresh", format="json").status_code == 401


def test_password_reset_revokes_all_refresh_tokens(api, register_company, make_company,
                                                    make_user):
    register_company(email="admin@acme.test")
    admin = User.objects.get(email="admin@acme.test")
    # A second device issued a refresh token for the same user.
    from rest_framework_simplejwt.tokens import RefreshToken
    RefreshToken.for_user(admin)
    assert api.post("/api/auth/refresh", format="json").status_code == 200
    before = OutstandingToken.objects.filter(user=admin).count()
    assert before >= 2

    from core.models import OneTimeToken
    _, raw = OneTimeToken.issue(admin, "password_reset", minutes=30)
    resp = api.post("/api/auth/reset-password",
                    {"token": raw, "password": "BrandNew!Pass9"}, format="json")
    assert resp.status_code == 200

    blacklisted = BlacklistedToken.objects.filter(token__user=admin).count()
    assert blacklisted == OutstandingToken.objects.filter(user=admin).count()
    # Reset token is single-use.
    again = api.post("/api/auth/reset-password",
                     {"token": raw, "password": "Another!Pass9"}, format="json")
    assert again.status_code == 400


def test_update_me_changes_own_password_and_requires_current(auth_client, make_company,
                                                             make_user):
    company = make_company()
    user = make_user(company, email="me@acme.test", role="admin")
    client = auth_client(user)
    resp = client.patch("/api/auth/update-me",
                        {"new_password": "NewSecret!77"}, format="json")
    assert resp.status_code == 400  # current_password missing
    resp = client.patch("/api/auth/update-me",
                        {"current_password": PASSWORD, "new_password": "NewSecret!77"},
                        format="json")
    assert resp.status_code == 200
    user.refresh_from_db()
    assert user.check_password("NewSecret!77")
