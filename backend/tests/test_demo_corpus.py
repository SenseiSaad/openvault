"""Demo corpus + grounding + interactive-field behaviour."""
import json
from pathlib import Path

import pytest

from core import docgen, rag
from core.models import Document

pytestmark = pytest.mark.django_db

DEMO = Path(__file__).resolve().parent.parent.parent / "demo_docs"


def test_demo_corpus_has_25_plus_substantial_distinct_documents():
    files = sorted(DEMO.glob("*.md"))
    assert len(files) >= 25
    for f in files:
        assert len(f.read_text().splitlines()) >= 200, f.name
    titles = {f.read_text().splitlines()[0] for f in files}
    assert len(titles) >= 25  # different kinds of information


def test_seeder_ingests_policies_and_templates():
    from django.core.management import call_command
    from core.models import Company

    call_command("seed_policy_docs", company_slug="seed-test", email="seed@test.local",
                 password="Seed!Pass123", skip_embeddings=True, verbosity=0)
    c = Company.objects.get(slug="seed-test")
    assert c.documents.count() >= 25
    assert c.documents.filter(is_template=True).count() >= 4
    assert c.industry
    first = c.documents.filter(is_template=False).first()
    assert first.preview_text and len(first.preview_text) > 1000
    assert first.chunks.count() > 0


def test_grounding_rule_is_in_every_text_prompt():
    messages = rag.build_messages([], "what is the leave policy?", user=None)
    system = messages[0]["content"]
    assert "I do not have that information in the uploaded documents." in system
    assert "Never invent facts" in system


def test_ui_placeholder_labels_resolve_to_fields():
    fields = docgen.resolve_fields(
        type("U", (), {
            "full_name": "Saad Waseem", "email": "s@x", "title": "", "role": "",
            "manager": "", "employee_id": "", "join_date": "",
            "company": type("C", (), {"name": "Acme", "hr_email": "",
                                      "signature": "", "tone": "", "phone": ""})(),
            "department": type("D", (), {"name": ""})(),
        })(),
        {"[Manager's Name]": "Ali Raza", "[Employee ID]": "EMP-42"},
    )
    assert fields["manager"] == "Ali Raza"
    assert fields["employee_id"] == "EMP-42"
    out = docgen.fill_template("Hi [Manager's Name], ID [Employee ID]", fields).text
    assert out == "Hi Ali Raza, ID EMP-42"
