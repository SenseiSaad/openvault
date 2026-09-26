from django.contrib import admin

from .models import Company, User, Document, Chunk, AuditLog, Favorite

admin.site.site_header = "SecureKB administration"
admin.site.site_title = "SecureKB admin"
admin.site.index_title = "Knowledge platform management"


@admin.register(Company)
class CompanyAdmin(admin.ModelAdmin):
    list_display = ("name", "slug", "created_at")
    search_fields = ("name", "slug")


@admin.register(User)
class UserAdmin(admin.ModelAdmin):
    list_display = ("email", "username", "full_name", "role", "company", "is_staff", "is_active")
    list_filter = ("role", "is_staff", "is_active", "company")
    search_fields = ("email", "username", "full_name")


@admin.register(Document)
class DocumentAdmin(admin.ModelAdmin):
    list_display = (
        "filename", "company", "category", "is_public", "is_okf",
        "downloads", "num_chunks", "created_at",
    )
    list_filter = ("category", "is_public", "is_okf", "company")
    search_fields = ("filename", "description")
    readonly_fields = ("num_chunks", "downloads", "created_at")


@admin.register(Chunk)
class ChunkAdmin(admin.ModelAdmin):
    list_display = ("document", "company", "ord")
    list_filter = ("company",)


@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    list_display = ("created_at", "company", "user", "action", "detail", "ip")
    list_filter = ("action", "company")
    search_fields = ("detail",)


@admin.register(Favorite)
class FavoriteAdmin(admin.ModelAdmin):
    list_display = ("user", "document", "created_at")
