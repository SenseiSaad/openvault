from django.contrib import admin

from .models import Company, User, Document, DocumentAccess, Chunk, AuditLog, DocumentShare

admin.site.site_header = "OpenVault administration"
admin.site.site_title = "OpenVault admin"
admin.site.index_title = "Private knowledge platform management"


@admin.register(Company)
class CompanyAdmin(admin.ModelAdmin):
    list_display = ("name", "access_code", "slug", "created_at")
    search_fields = ("name", "access_code", "slug")


@admin.register(User)
class UserAdmin(admin.ModelAdmin):
    list_display = ("email", "full_name", "title", "role", "company", "is_staff", "is_active")
    list_filter = ("role", "is_staff", "is_active", "company")
    search_fields = ("email", "full_name", "title")


@admin.register(Document)
class DocumentAdmin(admin.ModelAdmin):
    list_display = (
        "filename", "company", "category", "access_scope", "is_okf",
        "downloads", "num_chunks", "created_at",
    )
    list_filter = ("category", "access_scope", "is_okf", "company")
    search_fields = ("filename", "description")
    readonly_fields = ("num_chunks", "downloads", "created_at")


@admin.register(DocumentAccess)
class DocumentAccessAdmin(admin.ModelAdmin):
    list_display = ("document", "user", "can_download", "created_at")
    list_filter = ("can_download",)
    search_fields = ("document__filename", "user__email", "user__full_name")


@admin.register(DocumentShare)
class DocumentShareAdmin(admin.ModelAdmin):
    list_display = ("document", "shared_with_user", "shared_by", "can_download", "created_at")
    list_filter = ("can_download",)


@admin.register(Chunk)
class ChunkAdmin(admin.ModelAdmin):
    list_display = ("document", "company", "ord")
    list_filter = ("company",)


@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    list_display = ("created_at", "company", "user", "action", "detail", "ip")
    list_filter = ("action", "company")
    search_fields = ("detail",)
