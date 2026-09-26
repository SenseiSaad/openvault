from rest_framework import serializers

from .models import Company, User, Document, AuditLog


class CompanySerializer(serializers.ModelSerializer):
    class Meta:
        model = Company
        fields = ["id", "name", "slug"]


class UserSerializer(serializers.ModelSerializer):
    company_id = serializers.IntegerField(source="company.id", read_only=True)

    class Meta:
        model = User
        fields = ["id", "email", "username", "full_name", "role", "company_id"]


class DocumentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Document
        fields = [
            "id", "filename", "content_type", "size", "category", "description",
            "downloads", "is_public", "is_okf", "num_chunks", "created_at",
        ]


class AuditSerializer(serializers.ModelSerializer):
    user_id = serializers.IntegerField(source="user.id", read_only=True, default=None)

    class Meta:
        model = AuditLog
        fields = ["id", "user_id", "action", "detail", "ip", "created_at"]


class RegisterCompanySerializer(serializers.Serializer):
    company_name = serializers.CharField()
    admin_name = serializers.CharField(required=False, allow_blank=True, default="")
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
    email = serializers.EmailField()
    password = serializers.CharField(min_length=6)
    role = serializers.ChoiceField(choices=["admin", "employee", "viewer"], default="employee")


class AskSerializer(serializers.Serializer):
    question = serializers.CharField()
