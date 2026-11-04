"""Platform/root admins are report-only: no tenant data, ever."""
import pytest

from core.models import Document

pytestmark = pytest.mark.django_db


@pytest.fixture
def root(make_user):
    return make_user(None, email="root@openvault.test", role="admin",
                     is_platform_admin=True, is_superuser=True)


def test_root_admin_sees_no_company_documents(auth_client, root, make_company, make_user):
    company = make_company("Tenant Co")
    admin = make_user(company, email="tenant@acme.test", role="admin")
    Document.objects.create(company=company, filename="secret-policy.txt",
                            stored_path="s", uploaded_by=admin,
                            preview_text="CONFIDENTIAL-MARKER-42")

    client = auth_client(root)
    assert client.get("/api/documents").status_code == 403
    assert client.get("/api/documents/1").status_code == 403
    assert client.get("/api/health").status_code == 200   # platform health is fine


def test_root_admin_cannot_query_chat_or_generate(auth_client, root):
    client = auth_client(root)
    assert client.post("/api/ask", {"question": "what is the policy"},
                       format="json").status_code == 403
    assert client.post("/api/docgen", {"outputs": ["form"]}, format="json").status_code == 403
    assert client.get("/api/templates").status_code == 403
    assert client.get("/api/conversations").status_code == 403
    assert client.get("/api/companies/search?code=ABC").status_code == 403
    assert client.get("/api/shared-with-me").status_code == 403


def test_root_admin_cannot_switch_into_a_tenant(auth_client, root, make_company):
    company = make_company("Target Co")
    client = auth_client(root)
    assert client.post("/api/admin/switch-company", {"company_id": company.id},
                       format="json").status_code == 403
    assert client.post("/api/admin/detach-company", format="json").status_code == 403
    root.refresh_from_db()
    assert root.company_id is None


def test_reports_show_subscription_by_company_type_not_tenant_data(
        auth_client, root, make_company, make_user):
    tech = make_company("Tech Co")
    tech.industry = "Technology"
    tech.save(update_fields=["industry"])
    make_user(tech, email="tech-admin@acme.test", role="admin")
    Document.objects.create(company=tech, filename="private-handbook.txt",
                            stored_path="s", preview_text="SECRET-TENANT-CONTENT")

    resp = auth_client(root).get("/api/admin/reports")
    assert resp.status_code == 200
    body = resp.json()
    assert body["summary"]["total_companies"] >= 1
    assert "Technology" in body["summary"]["companies_by_industry"]
    entry = next(c for c in body["companies"] if c["name"] == "Tech Co")
    assert entry["industry"] == "Technology"
    assert "plan" in entry and "member_count" in entry and "document_count" in entry
    # Reports must never carry company data.
    blob = str(body)
    assert "SECRET-TENANT-CONTENT" not in blob
    assert "private-handbook.txt" not in blob
    assert "tech-admin@acme.test" not in blob


def test_company_admin_cannot_read_platform_reports(auth_client, make_company, make_user):
    company = make_company()
    admin = make_user(company, email="notroot@acme.test", role="admin")
    assert auth_client(admin).get("/api/admin/reports").status_code == 403
