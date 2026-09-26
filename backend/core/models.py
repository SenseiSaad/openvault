"""Database tables. Every tenant-owned row carries `company` — that FK is the
backbone of multi-tenant isolation (one company can never see another's data)."""
from django.contrib.auth.models import (
    AbstractBaseUser, BaseUserManager, PermissionsMixin,
)
from django.db import models


class Company(models.Model):
    name = models.CharField(max_length=200)
    slug = models.SlugField(unique=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name


class UserManager(BaseUserManager):
    def create_user(self, email, password=None, **extra):
        if not email:
            raise ValueError("Email is required")
        user = self.model(email=self.normalize_email(email), **extra)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra):
        extra.setdefault("is_staff", True)
        extra.setdefault("is_superuser", True)
        extra.setdefault("role", "admin")
        return self.create_user(email, password, **extra)


class User(AbstractBaseUser, PermissionsMixin):
    ROLES = [
        ("admin", "admin"),
        ("employee", "employee"),
        ("viewer", "viewer"),
        ("public", "public"),  # consumer accounts (no company) — browse + favourites
    ]

    email = models.EmailField(unique=True)
    # Consumers log in with this; enterprise users leave it NULL and use email.
    username = models.CharField(max_length=150, unique=True, null=True, blank=True)
    full_name = models.CharField(max_length=200, blank=True, default="")
    # one employee belongs to exactly ONE company and cannot log into another
    company = models.ForeignKey(
        Company, on_delete=models.CASCADE, related_name="users", null=True, blank=True
    )
    role = models.CharField(max_length=20, choices=ROLES, default="employee")
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    objects = UserManager()
    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = []

    def __str__(self):
        return self.email


class Document(models.Model):
    CATEGORIES = [
        ("Finance", "Finance"), ("Legal", "Legal"), ("HR", "HR"),
        ("Technology", "Technology"), ("Marketing", "Marketing"),
        ("Research", "Research"), ("Operations", "Operations"), ("Other", "Other"),
    ]
    company = models.ForeignKey(Company, on_delete=models.CASCADE, related_name="documents")
    filename = models.CharField(max_length=300)
    stored_path = models.CharField(max_length=500)
    content_type = models.CharField(max_length=100, blank=True, default="")
    size = models.IntegerField(default=0)
    category = models.CharField(max_length=40, choices=CATEGORIES, default="Other")
    description = models.TextField(blank=True, default="")
    downloads = models.IntegerField(default=0)  # popularity counter for the public site
    is_public = models.BooleanField(default=False)  # shown on the public portal
    is_okf = models.BooleanField(default=False)     # curated OKF note, always in context
    uploaded_by = models.ForeignKey(User, null=True, on_delete=models.SET_NULL)
    num_chunks = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)


class Chunk(models.Model):
    document = models.ForeignKey(Document, on_delete=models.CASCADE, related_name="chunks")
    company = models.ForeignKey(Company, on_delete=models.CASCADE, related_name="chunks")
    ord = models.IntegerField(default=0)
    text = models.TextField()
    # numpy float32 vector as raw bytes; NULL when embeddings unavailable
    embedding = models.BinaryField(null=True, blank=True)


class AuditLog(models.Model):
    company = models.ForeignKey(Company, on_delete=models.CASCADE, related_name="audit")
    user = models.ForeignKey(User, null=True, on_delete=models.SET_NULL)
    action = models.CharField(max_length=50)
    detail = models.CharField(max_length=300, blank=True, default="")
    ip = models.CharField(max_length=64, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)


class Favorite(models.Model):
    """A consumer's saved public document. Not tenant-scoped — belongs to a user."""
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="favorites")
    document = models.ForeignKey(Document, on_delete=models.CASCADE, related_name="favorited_by")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("user", "document")
