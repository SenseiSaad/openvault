"""Public health/readiness endpoint."""
import pytest

pytestmark = pytest.mark.django_db


def test_health_reports_ok_with_database(api):
    resp = api.get("/api/health")
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "ok"
    assert body["db"] is True
    assert "time" in body


def test_health_is_public(api):
    # No credentials: still reachable so a load balancer can probe it.
    resp = api.get("/api/health")
    assert resp.status_code == 200
