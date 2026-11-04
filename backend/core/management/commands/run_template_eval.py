"""Evaluate deterministic template filling — no model calls, no Bedrock.

    python manage.py run_template_eval
    python manage.py run_template_eval --report evals/template_report.json

Measures, over 20 cases (email, form, policy, table, Roman Urdu):
* placeholder accuracy — expected values filled AND unknown placeholders kept,
* no-invention rate — no profile value from a DIFFERENT case leaks into an
  output (the deterministic filler can only substitute supplied fields),
* missing-field reporting — unknown fields listed on ONE line.
"""
import json
from pathlib import Path
from types import SimpleNamespace

from django.core.management.base import BaseCommand

from core import docgen

CASES = Path(__file__).resolve().parent.parent.parent.parent / "evals" / "template_cases.jsonl"

BASE_PROFILES = {
    "saad": {
        "full_name": "Saad Waseem", "email": "saad@acme.test",
        "title": "Backend Engineer", "role": "employee", "department": "Engineering",
        "manager": "Ali Raza", "employee_id": "EMP-1045", "join_date": "2024-02-01",
        "company_name": "OpenVault", "hr_email": "hr@openvault.test",
        "signature": "Regards, HR", "tone": "formal", "phone": "+92-300-0000000",
    },
    "fatima": {
        "full_name": "Fatima Khan", "email": "fatima@acme.test",
        "title": "HR Lead", "role": "admin", "department": "HR",
        "manager": "Bilal Ahmed", "employee_id": "EMP-77", "join_date": "2023-06-15",
        "company_name": "Acme Corp", "hr_email": "hr@acme.test",
        "signature": "Best, HR", "tone": "friendly", "phone": "+92-301-1111111",
    },
    "zoya": {
        "full_name": "Zoya Khan", "email": "zoya@acme.test",
        "title": "Designer", "role": "employee", "department": "HR",
        "manager": "", "employee_id": "EMP-88", "join_date": "",
        "company_name": "Acme Corp", "hr_email": "", "signature": "", "tone": "",
        "phone": "",
    },
}


def fake_user(profile: dict):
    company = SimpleNamespace(**{k: profile.get(k, "") for k in (
        "company_name", "hr_email", "signature", "tone", "phone")})
    company.name = profile.get("company_name", "")
    dept = SimpleNamespace(name=profile.get("department", ""))
    user = SimpleNamespace(**{k: profile.get(k, "") for k in (
        "full_name", "email", "title", "role", "manager", "employee_id", "join_date")})
    user.company = company
    user.department = dept
    return user


def profile_for(case: dict) -> dict:
    return dict(BASE_PROFILES[case.get("profile", "saad")])


# Distinctive personal identifiers: if one of these appears in an output it
# must have been supplied to THAT case. Common words (tone, role, ...) are not
# identifiers and cannot be "invented data".
IDENTIFIERS = {
    "Saad Waseem", "Fatima Khan", "Zoya Khan",
    "saad@acme.test", "fatima@acme.test", "zoya@acme.test",
    "EMP-1045", "EMP-77", "EMP-88", "OpenVault", "Acme Corp",
    "Ali Raza", "Bilal Ahmed", "hr@openvault.test", "hr@acme.test",
}


class Command(BaseCommand):
    help = "Run the deterministic template-filling evaluation (20 cases)."

    def add_arguments(self, parser):
        parser.add_argument("--report", default="", help="Write JSON results here.")

    def handle(self, *args, **opts):
        cases = [json.loads(l) for l in CASES.read_text().splitlines() if l.strip()]
        builtin = {t.kind: t for t in docgen.load_builtin_templates()}
        rows = []

        for case in cases:
            profile = profile_for(case)
            for blank in case.get("blank_fields", []):
                profile[blank] = ""
            overrides = case.get("overrides") or {}
            fields = docgen.resolve_fields(fake_user(profile), overrides)
            rendered_docs = []
            for kind in case.get("outputs") or [case["kind"]]:
                text = case.get("template_text") if kind == case["kind"] else None
                tpl = (docgen.TemplateDoc(kind=kind, title=case["id"],
                                          text=text, source="eval")
                       if text else builtin.get(kind) or builtin["form"])
                rendered_docs.append(docgen.render_artifact(tpl, fields, overrides))
            r = rendered_docs[0]
            out = "\n".join(d["content_md"] + "\n" + d["raw_text"]
                             for d in rendered_docs)

            filled_ok = all(v in out for v in case.get("expect_filled", []))
            kept_ok = all(p in out for p in case.get("expect_placeholders", []))
            # A value may appear only if it was supplied to THIS case.
            supplied = set(fields.values()) | set(overrides.values())
            invented = sorted(v for v in IDENTIFIERS if v not in supplied and v in out)
            missing_ok = all(
                ("Missing fields (fill before sending):" in d["raw_text"]
                 and d["raw_text"].count("Missing fields") == 1)
                for d in rendered_docs if d["missing_fields"])
            rows.append({
                "id": case["id"], "lang": case["lang"], "kind": case["kind"],
                "filled_ok": filled_ok, "kept_ok": kept_ok,
                "no_invention": not invented, "missing_line_ok": missing_ok,
                "pass": filled_ok and kept_ok and not invented and missing_ok,
                "invented": invented,
            })

        n = len(rows)
        summary = {
            "cases": n,
            "placeholder_accuracy": round(sum(r["filled_ok"] and r["kept_ok"] for r in rows) / n, 3),
            "no_invention_rate": round(sum(r["no_invention"] for r in rows) / n, 3),
            "missing_line_rate": round(sum(r["missing_line_ok"] for r in rows) / n, 3),
            "pass_rate": round(sum(r["pass"] for r in rows) / n, 3),
        }
        self.stdout.write("=== Template-filling eval (deterministic, no model) ===")
        for key, value in summary.items():
            self.stdout.write(f"{key}: {value}")
        for r in rows:
            if not r["pass"]:
                self.stdout.write(self.style.WARNING(
                    f"FAIL {r['id']}: filled={r['filled_ok']} kept={r['kept_ok']} "
                    f"no_invention={r['no_invention']} missing={r['missing_line_ok']} "
                    f"invented={r['invented']}"))
        if opts["report"]:
            Path(opts["report"]).write_text(json.dumps({"summary": summary, "cases": rows},
                                                        indent=2))
            self.stdout.write(f"Report written to {opts['report']}")
        if summary["pass_rate"] < 0.9:
            raise SystemExit(1)
        self.stdout.write(self.style.SUCCESS("Template eval passed."))
