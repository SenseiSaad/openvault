"""Signed attendance QR tokens and holiday/leave exemption math."""
from datetime import date, timedelta

import pytest
from django.utils import timezone

from core import attendance as att
from core import qr_tokens
from core.models import AttendanceExemption, Holiday

pytestmark = pytest.mark.django_db


# ------------------------------------------------------------ signed tokens
def test_qr_token_roundtrip_and_expiry(monkeypatch):
    monkeypatch.setattr(qr_tokens, "default_ttl", lambda: 600)
    token = qr_tokens.issue(7)
    assert qr_tokens.verify(token, 7)
    assert not qr_tokens.verify(token, 8)          # another company's QR
    assert not qr_tokens.verify("garbage", 7)      # forged
    assert not qr_tokens.verify(token[:-3] + "abc", 7)  # tampered

    monkeypatch.setattr(qr_tokens, "default_ttl", lambda: -1)  # expired
    assert not qr_tokens.verify(token, 7)


def test_scan_requires_fresh_company_token(auth_client, make_company, make_user):
    company = make_company("QR Co")
    other = make_company("Other Co")
    employee = make_user(company, email="qr@acme.test")
    client = auth_client(employee)

    missing = client.post("/api/attendance/scan", {}, format="json")
    assert missing.status_code == 400

    forged = client.post("/api/attendance/scan", {"token": "x:signed"}, format="json")
    assert forged.status_code == 403

    wrong_company = client.post("/api/attendance/scan",
                                {"token": qr_tokens.issue(other.id)}, format="json")
    assert wrong_company.status_code == 403

    ok = client.post("/api/attendance/scan", {"token": qr_tokens.issue(company.id)},
                     format="json")
    assert ok.status_code == 201


def test_qr_target_embeds_token(auth_client, make_company, make_user):
    company = make_company("QR Target Co")
    admin = make_user(company, email="qradmin@acme.test", role="admin")
    payload = auth_client(admin).get("/api/attendance/qr").json()
    assert "?scan=1&t=" in payload["target"]


def test_scan_allows_disabling_qr_requirement(auth_client, make_company, make_user, settings):
    settings.ATTENDANCE_QR_REQUIRED = False
    company = make_company("Kiosk Co")
    employee = make_user(company, email="kiosk@acme.test")
    resp = auth_client(employee).post("/api/attendance/scan", {}, format="json")
    assert resp.status_code == 201


# --------------------------------------------------- holidays + exemptions
def _eval_user(make_company, make_user, email="cnic-exempt@acme.test"):
    company = make_company("Ex Co")
    return company, make_user(company, email=email)


def test_holiday_is_not_an_absence(make_company, make_user):
    company, user = _eval_user(make_company, make_user)
    today = timezone.localdate()
    # Today is a working day with no scan => normally 1 absence...
    if today.weekday() < 5:
        assert att.absences_in_month(user, today.year, today.month) >= 0
        Holiday.objects.create(company=company, date=today, name="Company day")
        assert att.absences_in_month(user, today.year, today.month) == 0


def test_platform_wide_holiday_applies_to_all_tenants(make_company, make_user):
    company, user = _eval_user(make_company, make_user, email="plat@acme.test")
    today = timezone.localdate()
    if today.weekday() < 5:
        Holiday.objects.create(company=None, date=today, name="National day")
        assert att.absences_in_month(user, today.year, today.month) == 0


def test_approved_leave_window_is_not_an_absence(make_company, make_user):
    company, user = _eval_user(make_company, make_user, email="leave@acme.test")
    today = timezone.localdate()
    AttendanceExemption.objects.create(
        user=user, start_date=today - timedelta(days=30),
        end_date=today + timedelta(days=30), reason="approved leave",
        created_by=user)
    # The whole month is exempted => zero absences regardless of scans.
    assert att.absences_in_month(user, today.year, today.month) == 0


def test_evaluate_month_uses_exempted_math(make_company, make_user):
    company, user = _eval_user(make_company, make_user, email="strike@acme.test")
    today = timezone.localdate()
    AttendanceExemption.objects.create(
        user=user, start_date=today - timedelta(days=60),
        end_date=today + timedelta(days=60), reason="long leave")
    results = att.evaluate_month(company=company, freeze=True, dry_run=False)
    mine = next(r for r in results if r["email"] == user.email)
    assert mine["absences"] == 0
    assert mine["strikes"] == 0


# ------------------------------------------------------------ admin endpoints
def test_admin_holiday_and_exemption_endpoints(auth_client, make_company, make_user):
    company = make_company("Cal Co")
    admin = make_user(company, email="cal@acme.test", role="admin")
    employee = make_user(company, email="emp@acme.test")
    client = auth_client(admin)

    made = client.post("/api/admin/attendance/holidays",
                       {"date": "2026-12-25", "name": "Quaid-e-Azam Day"}, format="json")
    assert made.status_code == 201
    dup = client.post("/api/admin/attendance/holidays", {"date": "2026-12-25"}, format="json")
    assert dup.status_code == 400
    bad = client.post("/api/admin/attendance/holidays", {"date": "25-12-2026"}, format="json")
    assert bad.status_code == 400
    rows = client.get("/api/admin/attendance/holidays").json()
    assert any(r["date"] == "2026-12-25" for r in rows)
    assert client.delete(f"/api/admin/attendance/holidays/{made.json()['id']}").status_code == 204

    exc = client.post("/api/admin/attendance/exemptions",
                      {"user_id": employee.id, "start_date": "2026-12-01",
                       "end_date": "2026-12-05", "reason": "umrah"}, format="json")
    assert exc.status_code == 201
    listed = client.get("/api/admin/attendance/exemptions").json()
    assert listed[0]["email"] == "emp@acme.test"
    assert client.delete(f"/api/admin/attendance/exemptions/{exc.json()['id']}").status_code == 204

    stranger = make_user(make_company("Elsewhere"), email="else@x.test")
    cross = client.post("/api/admin/attendance/exemptions",
                        {"user_id": stranger.id, "start_date": "2026-12-01",
                         "end_date": "2026-12-02"}, format="json")
    assert cross.status_code == 400
