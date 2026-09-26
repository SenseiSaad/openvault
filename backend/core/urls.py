from django.urls import path

from . import views

urlpatterns = [
    # auth
    path("auth/register", views.register_company),
    path("auth/login", views.login),
    path("auth/me", views.me),
    # consumer (public) auth
    path("public/register", views.public_register),
    path("public/login", views.public_login),
    # documents
    path("documents", views.documents),
    path("documents/upload", views.upload_document),
    path("documents/<int:pk>", views.document_detail),
    path("documents/<int:pk>/download", views.download_document),
    # chat
    path("ask", views.ask),
    path("llm-status", views.llm_status),
    # company admin
    path("admin/users", views.users),
    path("admin/users/<int:pk>", views.user_detail),
    path("admin/audit", views.audit_log),
    # public portal (browse without auth)
    path("public/companies", views.public_companies),
    path("public/categories", views.public_categories),
    path("public/documents", views.public_documents),
    path("public/documents/<int:pk>", views.public_document_detail),
    path("public/documents/<int:pk>/download", views.public_download),
    # favourites (require an account)
    path("favorites", views.favorites),
    path("favorites/<int:pk>", views.favorite_detail),
]
