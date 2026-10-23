"""Tenant isolation and document-level access control (the core security rules)."""
import pytest

from core.models import Department, Document, DocumentAccess, DocumentShare

pytestmark = pytest.mark.django_db


def _document(company, uploader, scope="company", **kw):
    return Document.objects.create(
        company=company, filename="policy.txt", stored_path="policy.txt",
        uploaded_by=uploader, access_scope=scope, **kw,
    )


def test_documents_never_cross_tenants(auth_client, make_company, make_user):
    acme = make_company("Acme")
    globex = make_company("Globex")
    acme_admin = make_user(acme, email="a@acme.test", role="admin")
    globex_admin = make_user(globex, email="b@globex.test", role="admin")
    doc = _document(acme, acme_admin)

    other = auth_client(globex_admin)
    listing = other.get("/api/documents").json()
    assert listing["count"] == 0
    assert other.get(f"/api/documents/{doc.id}").status_code == 404
    assert other.get(f"/api/documents/{doc.id}/download").status_code == 404

    same = auth_client(acme_admin).get("/api/documents").json()
    assert same["count"] == 1


def test_restricted_document_needs_a_grant(auth_client, make_company, make_user):
    company = make_company()
    uploader = make_user(company, email="up@acme.test", role="admin")
    colleague = make_user(company, email="col@acme.test")
    doc = _document(company, uploader, scope="restricted")

    client = auth_client(colleague)
    assert client.get(f"/api/documents/{doc.id}").status_code == 404

    DocumentAccess.objects.create(document=doc, user=colleague, can_download=True)
    assert client.get(f"/api/documents/{doc.id}").status_code == 200


def test_department_scope_requires_matching_department(auth_client, make_company, make_user):
    company = make_company()
    uploader = make_user(company, email="up@acme.test", role="admin")
    hr = Department.objects.create(company=company, name="HR")
    finance = Department.objects.create(company=company, name="Finance")
    hr_member = make_user(company, email="hr@acme.test", department=hr)
    finance_member = make_user(company, email="fin@acme.test", department=finance)
    doc = _document(company, uploader, scope="department", department=hr)

    assert auth_client(hr_member).get(f"/api/documents/{doc.id}").status_code == 200
    assert auth_client(finance_member).get(f"/api/documents/{doc.id}").status_code == 404


def test_cross_company_share_appears_in_shared_with_me(auth_client, make_company, make_user):
    acme = make_company("Acme")
    globex = make_company("Globex")
    acme_admin = make_user(acme, email="a@acme.test", role="admin")
    partner = make_user(globex, email="p@globex.test")
    doc = _document(acme, acme_admin)

    # Before the grant: nothing visible to the partner.
    assert auth_client(partner).get("/api/shared-with-me").json() == []

    DocumentShare.objects.create(document=doc, shared_with_user=partner,
                                 shared_by=acme_admin, can_download=False)
    DocumentAccess.objects.create(document=doc, user=partner, can_download=False)

    shared = auth_client(partner).get("/api/shared-with-me").json()
    assert len(shared) == 1
    assert shared[0]["filename"] == "policy.txt"
    assert shared[0]["can_download"] is False

    # A share with can_download=False must block the download endpoint.
    resp = auth_client(partner).get(f"/api/documents/{doc.id}/download")
    assert resp.status_code == 403


def test_viewers_cannot_edit_or_delete(auth_client, make_company, make_user):
    company = make_company()
    admin = make_user(company, email="a@acme.test", role="admin")
    viewer = make_user(company, email="v@acme.test", role="viewer")
    doc = _document(company, admin)

    client = auth_client(viewer)
    assert client.get(f"/api/documents/{doc.id}").status_code == 200
    assert client.patch(f"/api/documents/{doc.id}", {"description": "x"},
                        format="json").status_code == 403
    assert client.delete(f"/api/documents/{doc.id}").status_code == 403


def test_non_admin_cannot_list_or_create_members(auth_client, make_company, make_user):
    company = make_company()
    employee = make_user(company, email="e@acme.test", role="employee")
    client = auth_client(employee)
    assert client.get("/api/admin/users").status_code == 403
    assert client.post("/api/admin/users", {"email": "new@acme.test",
                                            "password": "Valid!Pass99"},
                       format="json").status_code == 403


def test_member_listing_hides_other_users_account_flags(auth_client, make_company, make_user):
    company = make_company()
    admin = make_user(company, email="a@acme.test", role="admin")
    colleague = make_user(company, email="b@acme.test")
    colleague.is_platform_admin = True
    colleague.is_superuser = True
    colleague.save(update_fields=["is_platform_admin", "is_superuser"])

    rows = auth_client(admin).get("/api/admin/users").json()
    assert len(rows) == 2
    colleague_row = next(r for r in rows if r["email"] == "b@acme.test")
    assert "is_platform_admin" not in colleague_row
    assert "is_superuser" not in colleague_row

    # Your own profile still carries the flags the UI needs.
    me = auth_client(admin).get("/api/auth/me").json()
    assert me["is_platform_admin"] is False
    assert me["is_superuser"] is False
