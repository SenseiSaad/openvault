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


def test_live_probe_is_cheap_and_public(api):
    """The ALB readiness check is /api/health; /api/health/live must answer
    without touching the database or storage, even when both are broken."""
    resp = api.get("/api/health/live")
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"
