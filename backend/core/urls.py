from django.urls import path

from . import views

urlpatterns = [
    # ops
    path("health", views.health),
    # auth (cookie-based; header still accepted)
    path("auth/register", views.register_company),
    path("auth/login", views.login),
    path("auth/mfa/activate", views.mfa_activate),
    path("auth/mfa/verify", views.mfa_verify),
    path("auth/mfa/setup", views.mfa_setup),
    path("auth/logout", views.logout),
    path("auth/refresh", views.refresh),
    path("auth/me", views.me),
    path("auth/update-me", views.update_me),
    path("auth/request-verification", views.request_verification),
    path("auth/verify", views.verify_email),
    path("auth/forgot-password", views.forgot_password),
    path("auth/reset-password", views.reset_password),
    # documents
    path("documents", views.documents),
    path("documents/upload", views.upload_document),
    path("documents/presign", views.upload_presign),
    path("documents/confirm", views.upload_confirm),
    path("documents/<int:pk>", views.document_detail),
    path("documents/<int:pk>/download", views.download_document),
    path("documents/<int:pk>/preview", views.document_preview),
    path("documents/<int:pk>/reindex", views.document_reindex),
    path("documents/<int:pk>/versions", views.document_versions),
    path("documents/<int:pk>/versions/new", views.document_new_version),
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
    path("conversations", views.conversations),
    path("conversations/<int:pk>", views.conversation_detail),
    path("messages/<int:pk>/rate", views.message_rate),
    # generated workflow document downloads (Features 2 & 3)
    path("workflow/forms/<int:user_id>/<str:name>", views.workflow_form_download),
    # attendance + 3-strike discipline (Feature 5)
    path("attendance/scan", views.attendance_scan),
    path("attendance/me", views.attendance_me),
    path("attendance/qr", views.attendance_qr),
    path("admin/attendance/holidays", views.admin_holidays),
    path("admin/attendance/holidays/<int:pk>", views.admin_holiday_detail),
    path("admin/attendance/exemptions", views.admin_exemptions),
    path("admin/attendance/exemptions/<int:pk>", views.admin_exemption_detail),
    # company admin
    path("admin/users", views.users),
    path("admin/users/<int:pk>", views.user_detail),
    path("admin/audit", views.audit_log),
    path("admin/attendance/evaluate", views.admin_attendance_evaluate),
    path("admin/company", views.company_settings),
    path("admin/departments", views.departments),
    path("admin/departments/<int:pk>", views.department_detail),
    path("admin/announcements", views.announcements),
    path("admin/announcements/<int:pk>", views.announcement_detail),
    path("admin/analytics", views.analytics),
    path("admin/usage", views.usage),
    # LLM provider settings (platform default or per-company override)
    path("admin/llm-config", views.llm_config),
    path("admin/llm-test", views.llm_test),
    # plans
    path("plans", views.plans),
    # platform admin tools
    path("admin/companies", views.list_companies),
    path("admin/companies/<int:pk>/plan", views.company_set_plan),
    path("admin/switch-company", views.switch_company),
    path("admin/detach-company", views.detach_company),
]
