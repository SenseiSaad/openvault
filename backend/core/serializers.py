from rest_framework import serializers

from .models import Company, User, Document, AuditLog, DocumentShare, LLMConfig



class CompanySerializer(serializers.ModelSerializer):
    class Meta:
        model = Company
        fields = ["id", "name", "slug"]


class CompanyProfileSerializer(serializers.ModelSerializer):
    """Fuller company view for the company's OWN authenticated members (workspace).

    Kept separate from CompanySerializer, which is used by the PUBLIC portal, so
    contact details never leak to unauthenticated visitors.
    """
    class Meta:
        model = Company
        fields = ["id", "name", "slug", "website", "contact_email", "phone",
                  "max_employees"]


class UserSerializer(serializers.ModelSerializer):
    company_id = serializers.IntegerField(source="company.id", read_only=True)
    # Nested own-company profile (null for consumer/public users with no company).
    company = CompanyProfileSerializer(read_only=True)

    class Meta:
        model = User
        fields = ["id", "email", "username", "full_name", "title", "role",
                  "company_id", "company"]


class DocumentSerializer(serializers.ModelSerializer):
    company_name = serializers.CharField(source="company.name", read_only=True)

    class Meta:
        model = Document
        fields = [
            "id", "filename", "content_type", "size", "category", "description",
            "downloads", "is_public", "is_okf", "num_chunks", "created_at",
            "company_name",
        ]


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


class PublicRegisterSerializer(serializers.Serializer):
    """Consumer sign-up: username + email + password."""
    username = serializers.CharField(min_length=3, max_length=150)
    email = serializers.EmailField()
    password = serializers.CharField(min_length=6)


class PublicLoginSerializer(serializers.Serializer):
    """Consumers sign in with username + password (not email)."""
    username = serializers.CharField()
    password = serializers.CharField()


class UserCreateSerializer(serializers.Serializer):
    full_name = serializers.CharField(required=False, allow_blank=True, default="")
    title = serializers.CharField(required=False, allow_blank=True, default="")
    email = serializers.EmailField()
    password = serializers.CharField(min_length=6)
    role = serializers.ChoiceField(choices=["admin", "employee", "viewer"], default="employee")


class AskSerializer(serializers.Serializer):
    question = serializers.CharField()


class DocumentShareSerializer(serializers.ModelSerializer):
    """Who a document is shared with (returned to the owning company)."""
    user_id = serializers.IntegerField(source="shared_with_user.id", read_only=True)
    email = serializers.CharField(source="shared_with_user.email", read_only=True)
    full_name = serializers.CharField(source="shared_with_user.full_name", read_only=True)
    company_name = serializers.CharField(
        source="shared_with_user.company.name", read_only=True, default=None
    )

    class Meta:
        model = DocumentShare
        fields = ["id", "user_id", "email", "full_name", "company_name",
                  "can_download", "created_at"]


class LLMConfigSerializer(serializers.ModelSerializer):
    """The api_key is write-only; reads expose only whether one is set."""
    api_key = serializers.CharField(
        required=False, allow_blank=True, write_only=True, style={"input_type": "password"}
    )
    has_api_key = serializers.SerializerMethodField()

    class Meta:
        model = LLMConfig
        fields = ["provider", "chat_model", "base_url", "temperature",
                  "max_tokens", "api_key", "has_api_key", "updated_at"]

    def get_has_api_key(self, obj):
        return bool(obj.api_key)
