"""Targeted top-up tests for modules the hardening work added: attendance
month math edges, middleware branches, storage guards, and rag helpers."""
from datetime import date, timedelta
from io import BytesIO

import pytest
from django.utils import timezone

from core import attendance as att
from core import storage
from core.models import AttendanceExemption, Holiday

pytestmark = pytest.mark.django_db


def test_month_bounds_and_future_month(make_company, make_user):
    company = make_company()
    user = make_user(company, email="mb@acme.test")
    first, last = att.month_bounds(2026, 2)
    assert (first, last) == (date(2026, 2, 1), date(2026, 2, 28))
    assert first.weekday() == 6  # sanity: Feb 1 2026 is a Sunday
    # Entirely-future month => zero absences (no business days elapsed).
    assert att.absences_in_month(user, 2030, 1) == 0


def test_business_days_and_holiday_edges(make_company, make_user):
    company = make_company()
    user = make_user(company, email="bd@acme.test")
    days = att._business_days(date(2026, 3, 2), date(2026, 3, 8))  # Mon..Sun
    assert len(days) == 5
    Holiday.objects.create(company=None, date=date(2026, 3, 3), name="X")
    # Platform-wide holidays apply to every tenant; company holidays do not.
    assert date(2026, 3, 3) in att._holiday_dates(None, date(2026, 3, 1), date(2026, 3, 31))
    assert date(2026, 3, 3) in att._holiday_dates(company.id, date(2026, 3, 1),
                                                  date(2026, 3, 31))
    Holiday.objects.create(company=company, date=date(2026, 3, 4), name="Co")
    assert date(2026, 3, 4) in att._holiday_dates(company.id, date(2026, 3, 1),
                                                  date(2026, 3, 31))
    assert date(2026, 3, 4) not in att._holiday_dates(None, date(2026, 3, 1), date(2026, 3, 31))


def test_exemption_days_clipped_to_month(make_company, make_user):
    company = make_company()
    user = make_user(company, email="clip@acme.test")
    AttendanceExemption.objects.create(user=user, start_date=date(2026, 1, 1),
                                       end_date=date(2026, 1, 10), reason="leave")
    days = att._exemption_days(user, date(2026, 1, 5), date(2026, 1, 31))
    assert date(2026, 1, 5) in days
    assert date(2026, 1, 9) in days       # Friday inside the window
    assert date(2026, 1, 12) not in days  # Monday after the window (Jan 10 = Sat)


def test_evaluate_month_strikes_and_freeze(make_company, make_user, settings):
    settings.ATTENDANCE_MONTHLY_ABSENCE_LIMIT = 1
    settings.ATTENDANCE_MAX_STRIKES = 1
    company = make_company()
    emp = make_user(company, email="freeze@acme.test")
    # A fully elapsed PAST month with zero scans => absence limit hit, strike,
    # freeze — deterministic regardless of today's weekday.
    results = att.evaluate_month(year=2026, month=10, company=company,
                                 freeze=True, dry_run=False)
    mine = next(r for r in results if r["email"] == emp.email)
    assert mine["new_strike"] is True and mine["deactivated"] is True
    emp.refresh_from_db()
    assert emp.is_active is False

    # dry_run touches nothing: a second employee stays active.
    other = make_user(company, email="dry@acme.test")
    results = att.evaluate_month(year=2026, month=10, company=company,
                                 freeze=True, dry_run=True)
    other.refresh_from_db()
    assert other.is_active is True
    assert next(r for r in results if r["email"] == other.email)["new_strike"] is True


def test_evaluate_month_guard_period_prevents_double_strike(make_company, make_user,
                                                             settings):
    settings.ATTENDANCE_MONTHLY_ABSENCE_LIMIT = 1
    company = make_company()
    make_user(company, email="guard@acme.test")
    first = att.evaluate_month(year=2026, month=10, company=company,
                               freeze=False, dry_run=False)
    second = att.evaluate_month(year=2026, month=10, company=company,
                                freeze=False, dry_run=False)
    assert first[0]["new_strike"] is True
    assert second[0]["new_strike"] is False  # last_evaluated_period guard


def test_absences_for_user_without_company(make_user):
    user = make_user(None, email="free-agent@openvault.test")
    today = timezone.localdate()
    assert att.absences_in_month(user, today.year, today.month) >= 0  # no crash


# ------------------------------------------------------------- middleware
def test_origin_check_allows_trusted_and_blocks_foreign(rf, settings):
    from core.middleware import OriginCheckMiddleware

    settings.CSRF_TRUSTED_ORIGINS = ["https://app.example.com"]
    settings.CORS_ALLOWED_ORIGINS = []
    mw = OriginCheckMiddleware(lambda req: "ok")

    class R:
        def __init__(self, meta, method="POST", path="/api/ask"):
            self.META = meta
            self.method = method
            self.path = path

        def get_host(self):
            return "api.example.com"

        def is_secure(self):
            return True

    passed = mw(R({"HTTP_ORIGIN": "https://app.example.com", "REMOTE_ADDR": "1"}))
    assert passed == "ok"
    same = mw(R({"HTTP_ORIGIN": "https://api.example.com", "REMOTE_ADDR": "1"}))
    assert same == "ok"
    blocked = mw(R({"HTTP_ORIGIN": "https://evil.example.net", "REMOTE_ADDR": "1"}))
    assert blocked.status_code == 403
    # GETs and no-Origin requests pass
    assert mw(R({}, method="GET")) == "ok"
    assert mw(R({"REMOTE_ADDR": "1"})) == "ok"


def test_request_id_middleware_generates_and_honours_incoming(rf):
    from core.middleware import RequestIDMiddleware

    captured = {}

    def downstream(request):
        captured["rid"] = request.request_id
        from django.http import HttpResponse
        return HttpResponse("x")

    mw = RequestIDMiddleware(downstream)
    resp = mw(rf.get("/api/health", HTTP_X_REQUEST_ID="abc-123"))
    assert captured["rid"] == "abc-123"
    assert resp["X-Request-ID"] == "abc-123"

    mw2 = RequestIDMiddleware(downstream)
    resp2 = mw2(rf.get("/api/health"))
    assert 8 <= len(captured["rid"]) <= 64 and captured["rid"] != "abc-123"
    assert resp2["X-Request-ID"] == captured["rid"]

    # hostile header is sanitised, not echoed
    mw3 = RequestIDMiddleware(downstream)
    mw3(rf.get("/api/health", HTTP_X_REQUEST_ID="<script>x" * 30))
    assert "<" not in captured["rid"]


# ---------------------------------------------------------------- storage
def test_storage_rejects_missing_reads(tmp_path):
    with pytest.raises(OSError):
        storage.read_bytes("nope/missing.txt", base_dir=str(tmp_path))


def test_storage_save_uploaded_file_returns_path(tmp_path):
    from django.core.files.uploadedfile import SimpleUploadedFile
    path = storage.save_uploaded_file("co/file.txt",
                                      SimpleUploadedFile("file.txt", b"data"),
                                      base_dir=str(tmp_path))
    assert storage.exists(path)


# ------------------------------------------------------------------- rag
def test_stem_variant_matching():
    from core.rag import _stem
    assert _stem("rotated") == _stem("rotate")
    assert _stem("passwords") == _stem("password")
    assert _stem("policy") == "policy"  # short words untouched


def test_chunk_ord_and_reindex_style_flow(make_company, make_user):
    from core.models import Chunk, Document
    from core import rag
    company = make_company()
    user = make_user(company, email="idx@acme.test")
    doc = Document.objects.create(company=company, filename="r.txt", stored_path="s",
                                  uploaded_by=user)
    # Two short paragraphs pack into ONE 900-char chunk; assert the ord chain.
    raw = ("OpenVault reimbursement policy. Receipts within seven days.\n\n"
           "Expense above five thousand needs approval.").encode()
    n = rag.index_document(doc, raw)
    assert n == 1
    assert list(Chunk.objects.filter(document=doc).order_by("ord")
                .values_list("ord", flat=True)) == [0]


def test_zip_guard_accepts_normal_docx():
    import zipfile
    from core.uploads import guard_zip_archive, UploadRejected, validate_extension
    # Realistic document XML: mixed words compress ~3-5x, far below the guard.
    body = " ".join(["reimbursement policy receipts within seven days"] * 1200).encode()
    buf = BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("word/document.xml", b"<doc>" + body + b"</doc>")
    guard_zip_archive(buf.getvalue())  # no raise

    with pytest.raises(UploadRejected):
        validate_extension("evil.exe")
