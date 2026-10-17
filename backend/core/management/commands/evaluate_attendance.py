"""Feature 5 — run the monthly attendance evaluation and 3-strike rule.

Why this exists
---------------
Freezing an account (`is_frozen = True`, and `is_active = False`) is destructive,
so it must never happen as a side effect of a QR scan. Instead the discipline
logic lives in `core.attendance.evaluate_month` and is applied deliberately: by
a company admin from the admin endpoint, or by an operator from this command
(e.g. a cron job on the 1st of each month).

    # evaluate the current month for every company, applying strikes + freezes
    python manage.py evaluate_attendance

    # preview only — persist nothing
    python manage.py evaluate_attendance --dry-run

    # apply strikes but do NOT deactivate frozen accounts
    python manage.py evaluate_attendance --no-freeze

    # a specific month / a single company
    python manage.py evaluate_attendance --year 2026 --month 9 --company 3

The underlying utility is idempotent within a month (guarded by
`UserStrike.last_evaluated_period`), so running it twice will not double-count.
"""
from django.core.management.base import BaseCommand, CommandError

from core.models import Company
from core import attendance


class Command(BaseCommand):
    help = "Evaluate monthly attendance, apply strikes, and freeze over-limit accounts."

    def add_arguments(self, parser):
        parser.add_argument("--year", type=int, default=None,
                            help="Year to evaluate (defaults to the current year).")
        parser.add_argument("--month", type=int, default=None,
                            help="Month 1-12 to evaluate (defaults to the current month).")
        parser.add_argument("--company", type=int, default=None,
                            help="Limit to a single company id (defaults to all companies).")
        parser.add_argument("--no-freeze", action="store_true",
                            help="Apply strikes but do not deactivate frozen accounts.")
        parser.add_argument("--dry-run", action="store_true",
                            help="Report what would happen without persisting anything.")

    def handle(self, *args, **opts):
        company = None
        if opts["company"] is not None:
            company = Company.objects.filter(pk=opts["company"]).first()
            if not company:
                raise CommandError(f"No company with id {opts['company']}.")

        results = attendance.evaluate_month(
            year=opts["year"],
            month=opts["month"],
            company=company,
            freeze=not opts["no_freeze"],
            dry_run=opts["dry_run"],
        )

        new_strikes = sum(1 for r in results if r["new_strike"])
        frozen = sum(1 for r in results if r["deactivated"])
        for r in results:
            if r["new_strike"] or r["is_frozen"]:
                self.stdout.write(
                    f"  {r['email']}: {r['absences']} absence(s), "
                    f"{r['strikes']} strike(s)"
                    f"{' [FROZEN]' if r['is_frozen'] else ''}"
                    f"{' [deactivated]' if r['deactivated'] else ''}"
                )

        prefix = "DRY RUN — " if opts["dry_run"] else ""
        self.stdout.write(self.style.SUCCESS(
            f"{prefix}Evaluated {len(results)} user(s): "
            f"{new_strikes} new strike(s), {frozen} account(s) deactivated."
        ))
