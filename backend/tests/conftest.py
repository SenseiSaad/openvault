"""Shared pytest fixtures for the OpenVault API test suite."""
import secrets
import pytest
from rest_framework.test import APIClient

from core.models import Company, Plan, User

PASSWORD = secrets.token_urlsafe(32)


@pytest.fixture(autouse=True)
def _no_rate_limit(settings):
    """Rate limiting is exercised separately; disable it for deterministic tests."""
    settings.RATELIMIT_ENABLED = False


@pytest.fixture(autouse=True)
def _isolated_storage(settings, tmp_path):
    """Keep uploaded files and generated artefacts out of the repo."""
    settings.MEDIA_ROOT = tmp_path / "media"
    settings.DATA_DIR = str(tmp_path / "data")
    settings.STATIC_ROOT = tmp_path / "staticfiles"
    (tmp_path / "media").mkdir(parents=True, exist_ok=True)
    (tmp_path / "data").mkdir(parents=True, exist_ok=True)
    (tmp_path / "staticfiles").mkdir(parents=True, exist_ok=True)


@pytest.fixture
def api():
    return APIClient()


@pytest.fixture
def free_plan(db):
    return Plan.default()


@pytest.fixture
def make_company(db):
    def _make(name="Acme Corp", plan=None):
        return Company.objects.create(name=name, slug=name.lower().replace(" ", "-"),
                                      plan=plan or Plan.default())
    return _make


@pytest.fixture
def make_user(db):
    def _make(company, email=None, role="employee", password=PASSWORD, **extra):
        email = email or f"{role}-{User.objects.count() + 1}@example.com"
        return User.objects.create_user(
            email=email, password=password, company=company, role=role,
            email_verified=True, **extra,
        )
    return _make


@pytest.fixture
def auth_client():
    """Return a factory that yields an APIClient authenticated as `user`."""
    def _make(user):
        client = APIClient()
        client.force_authenticate(user=user)
        return client
    return _make


@pytest.fixture
def register_company(api):
    """Register a company through the real endpoint; returns (response, payload)."""
    def _register(name="Acme Corp", email="admin@acme.test", password=PASSWORD, **extra):
        payload = {"company_name": name, "email": email, "password": password, **extra}
        resp = api.post("/api/auth/register", payload, format="json")
        return resp, payload
    return _register
