from django.contrib import admin

from .models import (
    Announcement, AskLog, AuditLog, AttendanceExemption, ChatConversation,
    ChatMessage, Company, Department, Chunk, Document, DocumentAccess,
    DocumentShare, DocumentVersion, Holiday, LLMConfig, Plan, User,
)

admin.site.site_header = "OpenVault administration"
admin.site.site_title = "OpenVault admin"
admin.site.index_title = "Private knowledge platform management"


@admin.register(Plan)
class PlanAdmin(admin.ModelAdmin):
    list_display = ("name", "price_usd", "billing_period", "max_members", "max_documents",
                    "storage_mb", "monthly_ask_limit", "is_default")
    search_fields = ("name",)


@admin.register(Department)
class DepartmentAdmin(admin.ModelAdmin):
    list_display = ("name", "company", "created_at")
    list_filter = ("company",)
    search_fields = ("name",)


@admin.register(Company)
class CompanyAdmin(admin.ModelAdmin):
    list_display = ("name", "access_code", "slug", "plan", "created_at")
    list_filter = ("plan",)
    search_fields = ("name", "access_code", "slug")


@admin.register(User)
class UserAdmin(admin.ModelAdmin):
    list_display = ("email", "full_name", "title", "role", "company", "department",
                    "is_platform_admin", "email_verified", "language", "is_staff", "is_active")
    list_filter = ("role", "is_platform_admin", "is_staff", "is_active", "company", "language")
    search_fields = ("email", "full_name")


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


@admin.register(AskLog)
class AskLogAdmin(admin.ModelAdmin):
    list_display = ("created_at", "company", "user", "mode", "provider",
                    "chunks_found", "answered", "flagged")
    list_filter = ("company", "mode", "flagged")
    search_fields = ("question",)


@admin.register(ChatConversation)
class ChatConversationAdmin(admin.ModelAdmin):
    list_display = ("title", "company", "user", "updated_at")
    search_fields = ("title",)


@admin.register(ChatMessage)
class ChatMessageAdmin(admin.ModelAdmin):
    list_display = ("conversation", "role", "rating", "created_at")
    list_filter = ("role",)


@admin.register(DocumentVersion)
class DocumentVersionAdmin(admin.ModelAdmin):
    list_display = ("document", "version_number", "filename", "size", "created_at")


@admin.register(Announcement)
class AnnouncementAdmin(admin.ModelAdmin):
    list_display = ("title", "company", "created_by", "created_at")
    search_fields = ("title", "body")


@admin.register(LLMConfig)
class LLMConfigAdmin(admin.ModelAdmin):
    list_display = ("company", "provider", "chat_model", "updated_at")


@admin.register(Holiday)
class HolidayAdmin(admin.ModelAdmin):
    list_display = ("date", "name", "company", "created_at")
    list_filter = ("company",)


@admin.register(AttendanceExemption)
class AttendanceExemptionAdmin(admin.ModelAdmin):
    list_display = ("user", "start_date", "end_date", "reason", "created_by")
    search_fields = ("user__email",)
