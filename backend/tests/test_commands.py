"""Management commands used during deployment/operations."""
import io
import secrets
import sys
from unittest.mock import patch
import pytest
from django.core.management import call_command
from django.core.management.base import CommandError

from core.models import User

pytestmark = pytest.mark.django_db


def test_create_platform_admin_is_ready_to_log_in():
    password = secrets.token_urlsafe(32)
    call_command("create_platform_admin", "root@example.com",
                 password=password, verbosity=0)
    user = User.objects.get(email="root@example.com")
    assert user.is_platform_admin is True
    assert user.is_superuser is True
    assert user.is_staff is True
    assert user.email_verified is True
    assert user.check_password(password)


def test_create_platform_admin_rejects_weak_password():
    weak_password = "".join(chr(97) for _ in range(7))
    with pytest.raises(CommandError):
        call_command("create_platform_admin", "root@example.com",
                     password=weak_password, verbosity=0)
    assert not User.objects.filter(email="root@example.com").exists()


def test_create_platform_admin_prompts_without_printing_password(monkeypatch):
    password = secrets.token_urlsafe(32)
    class InteractiveStdin(io.StringIO):
        def isatty(self):
            return True

    monkeypatch.setattr(sys, "stdin", InteractiveStdin())
    output = io.StringIO()
    with patch("builtins.input", return_value="interactive-root@example.test"), \
         patch("core.management.commands.create_platform_admin.getpass.getpass",
               side_effect=[password, password]):
        call_command("create_platform_admin", stdout=output, verbosity=0)

    user = User.objects.get(email="interactive-root@example.test")
    assert user.is_platform_admin is True
    assert user.check_password(password)
    assert password not in output.getvalue()


def test_verify_platform_admin_mfa_does_not_print_totp_secret():
    totp_secret = "NEVER-PRINT-THIS-TOTP-SECRET"
    User.objects.create_user(
        email="mfa-root@example.test", password=secrets.token_urlsafe(32),
        full_name="MFA Root", role="admin", is_platform_admin=True,
        is_staff=True, is_superuser=True, email_verified=True,
        mfa_secret=totp_secret, mfa_enabled=True,
    )
    output = io.StringIO()
    call_command("verify_platform_admin_mfa", "mfa-root@example.test", stdout=output, verbosity=0)
    assert "enabled" in output.getvalue().lower()
    assert totp_secret not in output.getvalue()


def test_seed_demo_company_persists_sample_docs_through_storage(monkeypatch, tmp_path, settings):
    from core.models import Company, Document

    settings.DATA_DIR = str(tmp_path)
    settings.AWS_STORAGE_BUCKET_NAME = ""
    password = secrets.token_urlsafe(32)
    answers = iter([password, password])
    monkeypatch.setattr(
        "core.management.commands.seed_demo_company.getpass.getpass",
        lambda _prompt: next(answers),
    )
    monkeypatch.setattr(
        "core.management.commands.seed_demo_company.rag.index_document",
        lambda document, raw: 1,
    )
    class InteractiveStdin(io.StringIO):
        def isatty(self):
            return True

    monkeypatch.setattr(sys, "stdin", InteractiveStdin())

    call_command(
        "seed_demo_company", company_name="Smoke Demo", slug="smoke-demo",
        email="demo-admin@example.test", verbosity=0,
    )

    company = Company.objects.get(slug="smoke-demo")
    docs = list(Document.objects.filter(company=company))
    assert len(docs) == 2
    assert all(__import__("os").path.isfile(doc.stored_path) for doc in docs)
    assert not any(password in doc.stored_path for doc in docs)


def test_promote_existing_user(make_company, make_user):
    company = make_company()
    user = make_user(company, email="boss@acme.test", role="employee")
    assert user.email_verified is True  # fixture default

    call_command("create_platform_admin", "boss@acme.test", promote=True, verbosity=0)
    user.refresh_from_db()
    assert user.is_platform_admin is True
    assert user.is_superuser is True
    assert user.company_id == company.id


def test_bootstrap_platform_admin_from_environment(monkeypatch):
    password = secrets.token_urlsafe(32)
    monkeypatch.setenv("BOOTSTRAP_PLATFORM_ADMIN_EMAIL", "root@example.com")
    monkeypatch.setenv("BOOTSTRAP_PLATFORM_ADMIN_PASSWORD", password)

    call_command("bootstrap_platform_admin", verbosity=0)

    user = User.objects.get(email="root@example.com")
    assert user.is_platform_admin is True
    assert user.is_staff is True
    assert user.is_superuser is True
    assert user.email_verified is True
    assert user.check_password(password)


def test_bootstrap_is_idempotent_and_does_not_reset_password(monkeypatch):
    original_password = secrets.token_urlsafe(32)
    monkeypatch.setenv("BOOTSTRAP_PLATFORM_ADMIN_EMAIL", "root@example.com")
    monkeypatch.setenv("BOOTSTRAP_PLATFORM_ADMIN_PASSWORD", original_password)
    call_command("bootstrap_platform_admin", verbosity=0)

    monkeypatch.setenv("BOOTSTRAP_PLATFORM_ADMIN_PASSWORD", secrets.token_urlsafe(32))
    call_command("bootstrap_platform_admin", verbosity=0)

    user = User.objects.get(email="root@example.com")
    assert user.check_password(original_password)


def test_bootstrap_requires_both_environment_values(monkeypatch):
    monkeypatch.setenv("BOOTSTRAP_PLATFORM_ADMIN_EMAIL", "root@example.com")
    monkeypatch.delenv("BOOTSTRAP_PLATFORM_ADMIN_PASSWORD", raising=False)

    with pytest.raises(CommandError, match="Set both"):
        call_command("bootstrap_platform_admin", verbosity=0)


def test_bootstrap_rejects_weak_password(monkeypatch):
    monkeypatch.setenv("BOOTSTRAP_PLATFORM_ADMIN_EMAIL", "root@example.com")
    monkeypatch.setenv("BOOTSTRAP_PLATFORM_ADMIN_PASSWORD", "password")

    with pytest.raises(CommandError, match="password rejected"):
        call_command("bootstrap_platform_admin", verbosity=0)
    assert not User.objects.filter(email="root@example.com").exists()
