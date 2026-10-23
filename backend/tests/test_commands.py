"""Management commands used during deployment/operations."""
import secrets
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


def test_promote_existing_user(make_company, make_user):
    company = make_company()
    user = make_user(company, email="boss@acme.test", role="employee")
    assert user.email_verified is True  # fixture default

    call_command("create_platform_admin", "boss@acme.test", promote=True, verbosity=0)
    user.refresh_from_db()
    assert user.is_platform_admin is True
    assert user.is_superuser is True
    assert user.company_id == company.id
