from django.urls import path

from . import views

urlpatterns = [
    # auth
    path("auth/register", views.register_company),
    path("auth/login", views.login),
    path("auth/me", views.me),
    # documents
    path("documents", views.documents),
    path("documents/upload", views.upload_document),
    path("documents/<int:pk>", views.document_detail),
    path("documents/<int:pk>/download", views.download_document),
    # cross-company collaboration (granular per-user document sharing)
    path("documents/<int:pk>/shares", views.document_shares),
    path("documents/<int:pk>/shares/<int:user_id>", views.document_share_detail),
    path("shared-with-me", views.shared_with_me),
    # Registered-company directory used for controlled document sharing.
    path("companies/search", views.company_search),
    path("companies/<str:access_code>/members", views.company_members),
    # chat
    path("ask", views.ask),
    path("llm-status", views.llm_status),
    # company admin
    path("admin/users", views.users),
    path("admin/users/<int:pk>", views.user_detail),
    path("admin/audit", views.audit_log),
    # LLM provider settings (admin)
    path("admin/llm-config", views.llm_config),
    path("admin/llm-test", views.llm_test),
]
