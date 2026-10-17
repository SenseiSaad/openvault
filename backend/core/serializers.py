from rest_framework import serializers

from .models import (
    Announcement, AskLog, AuditLog, ChatConversation, ChatMessage, Company, Department,
    Document, DocumentAccess, DocumentShare, DocumentVersion, LLMConfig, Plan,
    AttendanceRecord, UserStrike, User,
)


class PlanSerializer(serializers.ModelSerializer):
    class Meta:
        model = Plan
        fields = [
            "id", "name", "price_pkr", "billing_period", "max_members", "max_documents",
            "storage_mb", "monthly_ask_limit", "allow_versions", "allow_departments",
            "allow_custom_llm", "is_default",
        ]


class DepartmentSerializer(serializers.ModelSerializer):
    member_count = serializers.IntegerField(source="members.count", read_only=True)

    class Meta:
        model = Department
        fields = ["id", "name", "member_count", "created_at"]


class CompanySerializer(serializers.ModelSerializer):
    class Meta:
        model = Company
        fields = ["id", "name", "slug"]


class CompanyDirectorySerializer(serializers.ModelSerializer):
    """Minimal registered-company record used by the sharing directory."""
    member_count = serializers.IntegerField(source="users.count", read_only=True)

    class Meta:
        model = Company
        fields = ["id", "name", "access_code", "member_count"]


class MemberDirectorySerializer(serializers.ModelSerializer):
    """Safe member identity fields for a company selected by access code."""
    class Meta:
        model = User
        fields = ["id", "email", "full_name", "title", "role"]


class CompanyProfileSerializer(serializers.ModelSerializer):
    """Fuller company view for the company's OWN authenticated members (workspace).

    Includes the current plan and its limits so the UI can show usage.
    """
    plan = PlanSerializer(read_only=True)

    class Meta:
        model = Company
        fields = ["id", "name", "slug", "access_code", "website", "contact_email", "phone",
                  "max_employees", "plan"]


class UserSerializer(serializers.ModelSerializer):
    company_id = serializers.IntegerField(source="company.id", read_only=True)
    # Nested own-company profile (null for platform admins with no company).
    company = CompanyProfileSerializer(read_only=True)
    department_id = serializers.IntegerField(source="department.id", read_only=True, default=None)
    department_name = serializers.CharField(source="department.name", read_only=True, default=None)
    is_platform_admin = serializers.BooleanField(read_only=True)
    is_superuser = serializers.BooleanField(read_only=True)

    class Meta:
        model = User
        fields = ["id", "email", "username", "full_name", "title", "role",
                  "company_id", "company", "department_id", "department_name",
                  "email_verified", "language", "is_active",
                  "is_platform_admin", "is_superuser"]

    def to_representation(self, instance):
        # The caller's own profile includes email_verified; listings keep it too
        # (it is not sensitive) but drop the hidden platform flag from non-self views.
        data = super().to_representation(instance)
        request = self.context.get("request")
        if request is None or request.user.id != instance.id:
            data.pop("email_verified", None)
        return data


class DocumentSerializer(serializers.ModelSerializer):
    company_name = serializers.CharField(source="company.name", read_only=True)
    department_name = serializers.CharField(source="department.name", read_only=True, default=None)
    tags = serializers.SerializerMethodField()

    class Meta:
        model = Document
        fields = [
            "id", "filename", "content_type", "size", "category", "description",
            "downloads", "is_okf", "num_chunks", "access_scope", "department",
            "department_name", "tags", "indexing_status", "index_error",
            "version", "created_at", "updated_at", "company_name",
        ]

    def get_tags(self, obj):
        raw = (obj.tags or "").strip()
        return [t.strip() for t in raw.split(",") if t.strip()]


class DocumentVersionSerializer(serializers.ModelSerializer):
    class Meta:
        model = DocumentVersion
        fields = ["id", "version_number", "filename", "size", "uploaded_by", "created_at"]


class AuditSerializer(serializers.ModelSerializer):
    user_id = serializers.IntegerField(source="user.id", read_only=True, default=None)

    class Meta:
        model = AuditLog
        fields = ["id", "user_id", "action", "detail", "ip", "created_at"]


class RegisterCompanySerializer(serializers.Serializer):
    company_name = serializers.CharField()
    admin_name = serializers.CharField(required=False, allow_blank=True, default="")
    # optional company profile + the first admin's job title
    admin_title = serializers.CharField(required=False, allow_blank=True, default="")
    website = serializers.CharField(required=False, allow_blank=True, default="")
    contact_email = serializers.CharField(required=False, allow_blank=True, default="")
    phone = serializers.CharField(required=False, allow_blank=True, default="")
    max_employees = serializers.IntegerField(required=False, allow_null=True, min_value=1)
    email = serializers.EmailField()
    password = serializers.CharField(min_length=6)


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField()


class UserCreateSerializer(serializers.Serializer):
    full_name = serializers.CharField(required=False, allow_blank=True, default="")
    title = serializers.CharField(required=False, allow_blank=True, default="")
    department_id = serializers.IntegerField(required=False, allow_null=True, default=None)
    email = serializers.EmailField()
    password = serializers.CharField(min_length=6)
    role = serializers.ChoiceField(choices=["admin", "employee", "viewer"], default="employee")


class AskSerializer(serializers.Serializer):
    question = serializers.CharField()
    mode = serializers.ChoiceField(choices=["local", "online"], required=False, allow_null=True, default=None)
    provider = serializers.CharField(required=False, allow_blank=True, default="")
    conversation_id = serializers.IntegerField(required=False, allow_null=True, default=None)


class DocumentShareSerializer(serializers.ModelSerializer):
    """Who a document is shared with (returned to the owning company)."""
    user_id = serializers.IntegerField(source="shared_with_user.id", read_only=True)
    email = serializers.CharField(source="shared_with_user.email", read_only=True)
    full_name = serializers.CharField(source="shared_with_user.full_name", read_only=True)
    title = serializers.CharField(source="shared_with_user.title", read_only=True)
    role = serializers.CharField(source="shared_with_user.role", read_only=True)
    company_name = serializers.CharField(
        source="shared_with_user.company.name", read_only=True, default=None
    )
    access_code = serializers.CharField(
        source="shared_with_user.company.access_code", read_only=True, default=None
    )

    class Meta:
        model = DocumentShare
        fields = ["id", "user_id", "email", "full_name", "title", "role",
                  "company_name", "access_code", "can_download", "created_at"]


class LLMConfigSerializer(serializers.ModelSerializer):
    """The api_key is write-only; reads expose only whether one is set."""
    api_key = serializers.CharField(
        required=False, allow_blank=True, write_only=True, style={"input_type": "password"}
    )
    has_api_key = serializers.SerializerMethodField()
    is_company_override = serializers.SerializerMethodField()

    class Meta:
        model = LLMConfig
        fields = ["provider", "chat_model", "base_url", "temperature",
                  "max_tokens", "api_key", "has_api_key", "is_company_override", "updated_at"]

    def get_has_api_key(self, obj):
        return bool(obj.api_key)

    def get_is_company_override(self, obj):
        return obj.company_id is not None


class AttendanceRecordSerializer(serializers.ModelSerializer):
    """One day's attendance mark for the signed-in user."""
    class Meta:
        model = AttendanceRecord
        fields = ["id", "date", "scanned_at", "status"]


class UserStrikeSerializer(serializers.ModelSerializer):
    """Rolling attendance-discipline counters for one user."""
    class Meta:
        model = UserStrike
        fields = ["absent_count", "strikes", "is_frozen",
                  "last_evaluated_period", "last_updated"]


class ChatConversationSerializer(serializers.ModelSerializer):
    message_count = serializers.IntegerField(source="messages.count", read_only=True)

    class Meta:
        model = ChatConversation
        fields = ["id", "title", "message_count", "created_at", "updated_at"]


class ChatMessageSerializer(serializers.ModelSerializer):
    sources = serializers.SerializerMethodField()

    class Meta:
        model = ChatMessage
        fields = ["id", "role", "content", "sources", "rating", "created_at"]

    def get_sources(self, obj):
        import json as _json
        try:
            return _json.loads(obj.sources) if obj.sources else []
        except Exception:
            return []


class AnnouncementSerializer(serializers.ModelSerializer):
    created_by_name = serializers.CharField(source="created_by.full_name", read_only=True, default=None)

    class Meta:
        model = Announcement
        fields = ["id", "title", "body", "created_by_name", "created_at"]


class AskLogSerializer(serializers.ModelSerializer):
    user_email = serializers.CharField(source="user.email", read_only=True, default=None)
    user_name = serializers.CharField(source="user.full_name", read_only=True, default=None)

    class Meta:
        model = AskLog
        fields = ["id", "user_email", "user_name", "question", "mode", "provider",
                  "chunks_found", "answered", "flagged", "latency_ms", "created_at"]
