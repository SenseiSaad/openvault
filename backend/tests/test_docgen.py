"""Template document generation: placeholders, routing, tenant isolation,
download formats, and the no-model (no Bedrock) guarantee."""
import json

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile

from core import docgen, rag
from core.models import Document, GeneratedArtifact

pytestmark = pytest.mark.django_db


def _profile(**kw):
    base = {
        "full_name": "Saad Waseem", "email": "saad@acme.test",
        "title": "Backend Engineer", "department": "Engineering",
        "manager": "Ali Raza", "employee_id": "EMP-1045",
        "company_name": "Acme Corp", "hr_email": "hr@acme.test",
        "date": "2026-11-04",
    }
    base.update(kw)
    return base


# ------------------------------------------------------------- placeholders
def test_fill_known_fields_and_keep_unknown():
    text = ("Full Name: [Full Name]\nManager: [Manager's Name]\n"
            "Unknown: [Reason for leave]\nCheckbox: [ ] Yes")
    r = docgen.fill_template(text, _profile())
    assert "Saad Waseem" in r.text
    assert "Ali Raza" in r.text
    assert "[Reason for leave]" in r.text     # unknown stays
    assert "[ ] Yes" in r.text                # checkbox untouched
    assert "Missing fields (fill before sending):" in r.text
    assert r.text.count("Missing fields") == 1  # exactly ONE line


def test_placeholder_never_invents_facts():
    fields = _profile()
    r = docgen.fill_template("[Employee ID] [Join Date] [Phone]", fields)
    assert "EMP-1045" in r.text
    assert "join_date" not in fields          # empty fields are never injected
    assert "[Join Date]" in r.text
    assert "[Phone]" in r.text


def test_sample_values_and_tokens_are_replaced():
    text = ("Name: Saad Waseem | Email: obsks23@gmail.com | "
            "{{full_name}} | add_user_name_here | {{ unknown_field }}")
    r = docgen.fill_template(text, _profile(full_name="Fatima Khan",
                                            email="fatima@acme.test"))
    assert "Fatima Khan" in r.text
    assert "fatima@acme.test" in r.text
    assert "Saad Waseem" not in r.text
    assert "add_user_name_here" not in r.text
    assert "[unknown field]" in r.text


def test_only_non_empty_profile_fields_in_prompt(make_company, make_user):
    company = make_company()
    user = make_user(company, email="blank@acme.test")
    user.full_name = ""
    user.title = ""
    user.manager = ""
    user.employee_id = ""
    user.save()
    fields = docgen.resolve_fields(user)
    assert "full_name" not in fields
    assert "title" not in fields
    assert "manager" not in fields
    block = docgen.profile_prompt_block(fields)
    assert "EMP-0001" not in block        # no invented employee IDs
    assert "XYZ Company" not in block     # no invented company
    messages = rag.build_messages([], "hello", user=user)
    system = messages[0]["content"]
    assert "EMP-0001" not in system
    assert "General" not in system


def test_prompt_injects_real_values_and_strict_rules(make_company, make_user):
    company = make_company("Real Co")
    user = make_user(company, email="real@acme.test", role="admin")
    user.full_name = "Saad Waseem"
    user.manager = "Ali Raza"
    user.employee_id = "EMP-9"
    user.save()
    messages = rag.build_messages([], "draft the form", user=user,
                                  template_text="FORM [Full Name]",
                                  template_rules=docgen.TEMPLATE_SYSTEM_RULES)
    system = messages[0]["content"]
    assert "Saad Waseem" in system and "Ali Raza" in system
    assert "Never invent facts" in system
    assert "TEMPLATE DOCUMENT" in messages[-1]["content"]  # whole template, not chunks


# ------------------------------------------------------------- classification
@pytest.mark.parametrize("question,expected", [
    ("What is the remote work policy?", ["text"]),
    ("mujhe leave policy batao", ["text"]),
    ("draft the leave request form for me", ["form"]),
    ("email likh do manager ko", ["email"]),
    ("make me a table of holidays", ["table"]),
])
def test_classify_single_output(question, expected):
    plan = docgen.classify(question, outputs=expected)
    assert plan.outputs == expected


def test_classify_mixed_and_only_requested_outputs():
    plan = docgen.classify("policy text and also the leave form and an email to HR")
    assert "text" in plan.outputs
    assert "form" in plan.outputs and "email" in plan.outputs


def test_explicit_outputs_override_keywords():
    plan = docgen.classify("draft the form", outputs=["email"])
    assert plan.outputs == ["email"] and plan.text_requested is False


# -------------------------------------------------------------- builtin file
def test_builtin_template_has_form_and_email_sections():
    tpls = docgen.load_builtin_templates()
    kinds = {t.kind for t in tpls}
    assert "form" in kinds and "email" in kinds


def test_render_real_rough_template_with_client_info():
    tpls = {t.kind: t for t in docgen.load_builtin_templates()}
    r = docgen.render_artifact(tpls["form"], _profile())
    assert "Saad Waseem" in r["content_md"]
    assert "EMP-1045" in r["content_md"]
    assert "Ali Raza" in r["content_md"]
    assert "Acme Corp" in r["title"]
    assert "[YYYY-MM-DD]" in r["content_md"]      # unknown stays
    assert r["structured"]["sections"]            # structured JSON for forms
    assert r["structured"]["markdown"]            # markdown fallback present

    email = docgen.render_artifact(tpls["email"], _profile())
    assert email["subject"]
    assert "Saad Waseem" in email["content_md"]
    assert "[Colleague's Name]" in email["content_md"]
    assert "Missing fields" in email["raw_text"]


# ------------------------------------------------------------- tenant safety
def test_uploaded_template_is_whole_and_tenant_isolated(make_company, make_user):
    a = make_company("A Co")
    b = make_company("B Co")
    a_admin = make_user(a, email="a@a.test", role="admin")
    b_admin = make_user(b, email="b@b.test", role="admin")
    Document.objects.create(
        company=a, filename="a-form.txt", stored_path="s", uploaded_by=a_admin,
        is_template=True, template_type="form",
        preview_text="SECRET-A-TEMPLATE [Full Name]")

    a_tpls = docgen.collect_uploaded_templates(a_admin, ["form"])
    b_tpls = docgen.collect_uploaded_templates(b_admin, ["form"])
    assert len(a_tpls) == 1 and "SECRET-A-TEMPLATE" in a_tpls[0].text
    assert b_tpls == []                            # no cross-tenant templates


def test_templates_endpoint_never_leaks_other_company(auth_client, make_company, make_user):
    a = make_company("A Co")
    b = make_company("B Co")
    a_admin = make_user(a, email="a2@a.test", role="admin")
    b_admin = make_user(b, email="b2@b.test", role="admin")
    Document.objects.create(
        company=a, filename="confidential-template.txt", stored_path="s",
        uploaded_by=a_admin, is_template=True, template_type="email",
        preview_text="A SECRET TEMPLATE")
    body = auth_client(b_admin).get("/api/templates").json()
    assert all("confidential-template" not in t["title"] for t in body["templates"])


# ------------------------------------------------------------- API + formats
def test_docgen_generate_returns_only_artifacts_no_model_call(auth_client, make_company,
                                                              make_user, monkeypatch):
    def explode(**kw):
        raise AssertionError("docgen must not call a chat provider (no Bedrock)")
    monkeypatch.setattr("core.rag.providers.get_chat_provider", explode)
    company = make_company("Acme")
    user = make_user(company, email="saad@acme.test")
    user.full_name, user.manager, user.employee_id = "Saad Waseem", "Ali Raza", "EMP-1"
    user.save()
    resp = auth_client(user).post("/api/docgen",
                                  {"question": "draft the leave form and an email",
                                   "outputs": ["form", "email"]},
                                  format="json")
    assert resp.status_code == 201, resp.content
    body = resp.json()
    kinds = [a["kind"] for a in body["artifacts"]]
    assert "form" in kinds and "email" in kinds
    assert body["outputs"] == ["form", "email"]   # no text answer
    assert "Saad Waseem" in body["artifacts"][0]["content_md"]
    assert body["missing_fields"]                 # unknown placeholders reported


def test_docgen_rejects_text_only_requests(auth_client, make_company, make_user):
    company = make_company()
    user = make_user(company, email="t@acme.test")
    resp = auth_client(user).post("/api/docgen", {"question": "what is the policy"},
                                  format="json")
    assert resp.status_code == 400


def test_ask_artifacts_only_emits_no_text_tokens(auth_client, make_company, make_user,
                                                monkeypatch):
    def explode(**kw):
        raise AssertionError("no model call for artifact-only requests")
    monkeypatch.setattr("core.rag.providers.get_chat_provider", explode)
    company = make_company()
    user = make_user(company, email="ask@acme.test")
    resp = auth_client(user).post("/api/ask",
                                  {"question": "make the leave form",
                                   "outputs": ["form"]}, format="json")
    assert resp.status_code == 200
    events = [json.loads(line) for line in resp.streaming_content if line.strip()]
    types = [e["type"] for e in events]
    assert "token" not in types                  # only the finished document
    assert "artifact" in types and "done" in types
    assert types[-1] == "done"


def test_artifact_download_formats(auth_client, make_company, make_user):
    company = make_company()
    user = make_user(company, email="dl@acme.test")
    client = auth_client(user)
    created = client.post("/api/artifacts/from_text",
                          {"content": "# Heading\n\n- **Name:** Saad Waseem\n\n| A | B |\n|---|---|\n| 1 | 2 |",
                           "title": "My Doc", "kind": "form"}, format="json")
    assert created.status_code == 201
    art_id = created.json()["id"]
    for fmt, ctype in (("md", "text/markdown"), ("txt", "text/plain"),
                       ("docx", "wordprocessingml"), ("pdf", "application/pdf"),
                       ("html", "text/html"), ("json", "application/json")):
        r = client.get(f"/api/artifacts/{art_id}/download?fmt={fmt}")
        assert r.status_code == 200, (fmt, r.status_code)
        assert ctype in r["Content-Type"]
    bad = client.get(f"/api/artifacts/{art_id}/download?fmt=exe")
    assert bad.status_code == 400


def test_artifact_is_private_to_its_owner(auth_client, make_company, make_user):
    company = make_company()
    owner = make_user(company, email="owner@acme.test")
    other = make_user(company, email="other@acme.test")
    client = auth_client(owner)
    created = client.post("/api/artifacts/from_text", {"content": "private"}, format="json")
    art_id = created.json()["id"]
    assert auth_client(other).get(f"/api/artifacts/{art_id}").status_code == 404
    assert auth_client(other).get(f"/api/artifacts/{art_id}/download").status_code == 404


# ------------------------------------------------------- upload + admin rules
def test_upload_can_mark_template_and_only_admin_edits(auth_client, make_company, make_user):
    company = make_company()
    admin = make_user(company, email="admin2@acme.test", role="admin")
    employee = make_user(company, email="emp2@acme.test")
    up = SimpleUploadedFile("tpl.txt", b"[Full Name]", content_type="text/plain")
    resp = auth_client(admin).post("/api/documents/upload",
                                   {"file": up, "access_scope": "company",
                                    "is_template": "true", "template_type": "email"},
                                   format="multipart")
    assert resp.status_code == 201
    doc_id = resp.json()["id"]
    assert Document.objects.get(pk=doc_id).is_template is True
    assert Document.objects.get(pk=doc_id).template_type == "email"

    # an employee cannot change the template flags
    denied = auth_client(employee).patch(
        f"/api/documents/{doc_id}", {"is_template": False}, format="json")
    assert denied.status_code == 403
    ok = auth_client(admin).patch(
        f"/api/documents/{doc_id}", {"template_type": "form"}, format="json")
    assert ok.status_code == 200 and ok.json()["template_type"] == "form"


def test_invalid_template_type_rejected(auth_client, make_company, make_user):
    company = make_company()
    admin = make_user(company, email="adm3@acme.test", role="admin")
    up = SimpleUploadedFile("t.txt", b"x", content_type="text/plain")
    resp = auth_client(admin).post("/api/documents/upload",
                                   {"file": up, "template_type": "virus"}, format="multipart")
    assert resp.status_code == 400


def test_profile_and_company_fields_are_editable(auth_client, make_company, make_user):
    company = make_company()
    admin = make_user(company, email="prof@acme.test", role="admin")
    client = auth_client(admin)
    me = client.patch("/api/auth/update-me",
                      {"full_name": "Saad Waseem", "manager": "Ali Raza",
                       "employee_id": "EMP-77", "join_date": "2024-01-15"},
                      format="json")
    assert me.status_code == 200
    assert me.json()["manager"] == "Ali Raza" and me.json()["employee_id"] == "EMP-77"
    bad = client.patch("/api/auth/update-me", {"join_date": "15-01-2024"}, format="json")
    assert bad.status_code == 400
    comp = client.patch("/api/admin/company",
                        {"hr_email": "hr@acme.test", "signature": "Regards, HR",
                         "tone": "formal"}, format="json")
    assert comp.status_code == 200 and comp.json()["tone"] == "formal"
