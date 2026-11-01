"""Feature 5 — monthly attendance evaluation and the 3-strike rule.

Separated from the request/response layer so it can run from a management command
(or an admin-triggered endpoint) rather than on every QR scan — freezing an
account sets `is_active=False`, which is destructive, so it must be a deliberate
periodic job, never a side effect of marking attendance.

Absences are derived, not stored: for the month under review we count the
business days (Mon-Fri) up to today that have no `Present` AttendanceRecord for
the user. That means a day the employee never scanned counts as an absence
without needing a separate "mark absentees" job.
"""
from __future__ import annotations

import calendar as _calendar
from datetime import date as _date

from django.conf import settings
from django.utils import timezone

from .models import AttendanceExemption, AttendanceRecord, Holiday, User, UserStrike


def month_bounds(year: int, month: int) -> tuple[_date, _date]:
    """First and last calendar day of the given month."""
    last_day = _calendar.monthrange(year, month)[1]
    return _date(year, month, 1), _date(year, month, last_day)


def _business_days(start: _date, end: _date) -> list[_date]:
    """Every weekday (Mon-Fri) in [start, end] inclusive."""
    days, cur = [], start
    one = timezone.timedelta(days=1)
    while cur <= end:
        if cur.weekday() < 5:  # 0=Mon .. 4=Fri
            days.append(cur)
        cur += one
    return days


def _holiday_dates(company_id: int | None, first: _date, end: _date) -> set[_date]:
    """Company holidays plus platform-wide ones (company=NULL) in range."""
    from django.db.models import Q
    q = Holiday.objects.filter(date__gte=first, date__lte=end)
    if company_id is not None:
        q = q.filter(Q(company_id=company_id) | Q(company__isnull=True))
    else:
        q = q.filter(company__isnull=True)
    return set(q.values_list("date", flat=True))


def _exemption_days(user, first: _date, end: _date) -> set[_date]:
    """Business days covered by an approved absence window for this user."""
    days: set[_date] = set()
    for exc in AttendanceExemption.objects.filter(
            user=user, start_date__lte=end, end_date__gte=first):
        overlap_start = max(exc.start_date, first)
        overlap_end = min(exc.end_date, end)
        days.update(_business_days(overlap_start, overlap_end))
    return days


def absences_in_month(user, year: int, month: int) -> int:
    """Number of business days in the month (up to today) with no Present scan,
    excluding declared holidays and approved leave windows."""
    first, last = month_bounds(year, month)
    today = timezone.localdate()
    end = min(last, today)
    if end < first:
        return 0  # month is entirely in the future
    expected = set(_business_days(first, end))
    if not expected:
        return 0
    expected -= _holiday_dates(user.company_id, first, end)
    expected -= _exemption_days(user, first, end)
    if not expected:
        return 0
    present = set(
        AttendanceRecord.objects.filter(
            user=user, status="Present", date__gte=first, date__lte=end
        ).values_list("date", flat=True)
    )
    return len(expected - present)


def evaluate_month(
    year: int | None = None,
    month: int | None = None,
    company=None,
    freeze: bool = True,
    dry_run: bool = False,
) -> list[dict]:
    """Refresh every active user's absence count for the month and apply strikes.

    * 3+ absences in the month -> one strike (once per month, guarded by
      `last_evaluated_period`).
    * strikes >= cap -> `is_frozen = True`; when `freeze` is set the account is
      also deactivated (`is_active = False`).

    Superusers are skipped so platform testers are never locked out. With
    `dry_run` nothing is persisted — useful for a preview.
    """
    today = timezone.localdate()
    year = year or today.year
    month = month or today.month
    period = f"{year:04d}-{month:02d}"
    limit = settings.ATTENDANCE_MONTHLY_ABSENCE_LIMIT
    cap = settings.ATTENDANCE_MAX_STRIKES

    users = User.objects.filter(is_active=True, is_superuser=False)
    if company is not None:
        users = users.filter(company=company)

    results: list[dict] = []
    for user in users:
        absent = absences_in_month(user, year, month)
        strike = UserStrike.objects.filter(user=user).first() or UserStrike(user=user)
        strike.absent_count = absent

        newly_struck = False
        if absent >= limit and strike.last_evaluated_period != period:
            strike.strikes += 1
            strike.last_evaluated_period = period
            newly_struck = True

        froze = False
        if strike.strikes >= cap:
            strike.is_frozen = True
            if freeze and user.is_active:
                froze = True

        if not dry_run:
            strike.save()
            if froze:
                user.is_active = False
                user.save(update_fields=["is_active"])

        results.append({
            "user_id": user.id,
            "email": user.email,
            "company_id": user.company_id,
            "absences": absent,
            "strikes": strike.strikes,
            "is_frozen": strike.is_frozen,
            "new_strike": newly_struck,
            "deactivated": froze,
        })
    return results
