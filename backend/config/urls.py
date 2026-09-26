from django.contrib import admin
from django.urls import path, include

from .views import landing

urlpatterns = [
    path("", landing),
    path("admin/", admin.site.urls),
    path("api/", include("core.urls")),
]
