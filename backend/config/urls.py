from django.contrib import admin
from django.urls import path, include

from core import mfa_admin
from .views import landing

urlpatterns = [
    path("", landing),
    # TOTP gate for the admin panel — must be registered BEFORE admin.site.urls
    # so /admin/mfa-* is not swallowed by the admin's own URLconf.
    path("admin/mfa-enroll/", mfa_admin.admin_mfa_enroll),
    path("admin/mfa-verify/", mfa_admin.admin_mfa_verify),
    path("admin/", admin.site.urls),
    path("api/", include("core.urls")),
]
