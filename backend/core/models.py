"""Database tables. Every tenant-owned row carries `company` — that FK is the
backbone of multi-tenant isolation (one company can never see another's data)."""
import secrets
import string

from django.contrib.auth.models import (
    AbstractBaseUser, BaseUserManager, PermissionsMixin,
)
from django.db import models


_COMPANY_CODE_ALPHABET = string.ascii_uppercase + string.digits


def generate_company_code():
    """Return a short, human-shareable identifier unique to one company."""
    return "".join(secrets.choice(_COMPANY_CODE_ALPHABET) for _ in range(5))


class Company(models.Model):
    """One tenant. Every document, chunk, user and audit row hangs off a company,
    and queries always filter by it, so tenants stay fully isolated."""
    name = models.CharField(max_length=200)
    slug = models.SlugField(unique=True)
    # Short identifier shown to admins and used for cross-company lookup.
    # It is intentionally not derived from the company name, so it is safe to
    # share without exposing a predictable tenant URL.
    access_code = models.CharField(max_length=5, unique=True, null=True, blank=True)
    # --- optional company profile (collected at registration, shown in the workspace) ---
    website = models.CharField(max_length=200, blank=True, default="")
    contact_email = models.EmailField(blank=True, default="")
    phone = models.CharField(max_length=40, blank=True, default="")
    # Seat limit for member accounts. NULL means unlimited; when set, admins can't
    # add more members than this (enforced in the users() view, never crashes).
    max_employees = models.PositiveIntegerField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def save(self, *args, **kwargs):
        if not self.access_code:
            # The collision loop also covers the very small chance of a code
            # collision during imports or local demo seeding.
            while True:
                code = generate_company_code()
                if not type(self).objects.filter(access_code=code).exclude(pk=self.pk).exists():
                    self.access_code = code
                    break
        super().save(*args, **kwargs)

    def __str__(self):
        return self.name


class UserManager(BaseUserManager):
    """Custom manager: users are keyed by email (there is no separate username field
    for enterprise accounts) and passwords are always hashed via set_password."""
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
    """An enterprise account. `role` is the security level and `title` is a
    display job label used when selecting document recipients."""
    ROLES = [
        ("admin", "admin"),
        ("employee", "employee"),
        ("viewer", "viewer"),
    ]

    email = models.EmailField(unique=True)
    # Retained nullable for compatibility with pre-existing database rows; all
    # current enterprise authentication uses email.
    username = models.CharField(max_length=150, unique=True, null=True, blank=True)
    full_name = models.CharField(max_length=200, blank=True, default="")
    # Display job title only (CEO, CTO, HR, ...). This is a label, NOT a permission:
    # what a user can actually do is decided by `role` below.
    title = models.CharField(max_length=120, blank=True, default="")
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
    """An uploaded file owned by one company. Access is company-wide or
    explicitly restricted to named users; `is_okf` marks a trusted AI note."""
    # 30 subject genres for the public knowledge library, plus the legacy
    # business categories (kept so enterprise uploads still have those options).
    CATEGORIES = [
        # --- knowledge-library subject genres ---
        ("Technology", "Technology"),
        ("Artificial Intelligence", "Artificial Intelligence"),
        ("Cybersecurity", "Cybersecurity"),
        ("Software Engineering", "Software Engineering"),
        ("Data Science", "Data Science"),
        ("Biology", "Biology"),
        ("Biotechnology", "Biotechnology"),
        ("Medicine", "Medicine"),
        ("Neuroscience", "Neuroscience"),
        ("Genetics", "Genetics"),
        ("Agriculture", "Agriculture"),
        ("Environmental Science", "Environmental Science"),
        ("Climate", "Climate"),
        ("Energy", "Energy"),
        ("Physics", "Physics"),
        ("Chemistry", "Chemistry"),
        ("Mathematics", "Mathematics"),
        ("Astronomy", "Astronomy"),
        ("Economics", "Economics"),
        ("Finance", "Finance"),
        ("Business", "Business"),
        ("Law", "Law"),
        ("Education", "Education"),
        ("Psychology", "Psychology"),
        ("Sociology", "Sociology"),
        ("History", "History"),
        ("Philosophy", "Philosophy"),
        ("Arts & Design", "Arts & Design"),
        ("Literature", "Literature"),
        ("Engineering", "Engineering"),
        # --- legacy business categories (enterprise workspace) ---
        ("Legal", "Legal"), ("HR", "HR"), ("Marketing", "Marketing"),
        ("Research", "Research"), ("Operations", "Operations"),
        ("Other", "Other"),
    ]
    company = models.ForeignKey(Company, on_delete=models.CASCADE, related_name="documents")
    filename = models.CharField(max_length=300)
    stored_path = models.CharField(max_length=500)
    content_type = models.CharField(max_length=100, blank=True, default="")
    size = models.IntegerField(default=0)
    category = models.CharField(max_length=50, choices=CATEGORIES, default="Other")
    description = models.TextField(blank=True, default="")
    downloads = models.IntegerField(default=0)
    is_okf = models.BooleanField(default=False)     # curated OKF note, always in context
    uploaded_by = models.ForeignKey(User, null=True, on_delete=models.SET_NULL)
    num_chunks = models.IntegerField(default=0)
    # `company` keeps the existing tenant-wide behaviour. `restricted` means
    # only the uploader and explicitly granted users may read/search/download.
    ACCESS_SCOPES = [("company", "Entire company"), ("restricted", "Selected people")]
    access_scope = models.CharField(max_length=20, choices=ACCESS_SCOPES, default="company")
    created_at = models.DateTimeField(auto_now_add=True)


class DocumentAccess(models.Model):
    """An explicit per-user grant for a restricted document.

    This is separate from DocumentShare so the same access rule works for
    people in the owning company and for registered people in another company.
    DocumentShare stores the collaboration/audit metadata for external grants.
    """
    document = models.ForeignKey(Document, on_delete=models.CASCADE, related_name="access_grants")
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="document_access")
    can_download = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("document", "user")


class Chunk(models.Model):
    """A slice of a document's text plus its embedding, used for RAG retrieval.
    Carries `company` too so retrieval can filter by tenant without a join."""
    document = models.ForeignKey(Document, on_delete=models.CASCADE, related_name="chunks")
    company = models.ForeignKey(Company, on_delete=models.CASCADE, related_name="chunks")
    ord = models.IntegerField(default=0)
    text = models.TextField()
    # numpy float32 vector as raw bytes; NULL when embeddings unavailable
    embedding = models.BinaryField(null=True, blank=True)


class AuditLog(models.Model):
    """Append-only activity trail per company (login, upload, share, ...) shown
    on the admin audit page."""
    company = models.ForeignKey(Company, on_delete=models.CASCADE, related_name="audit")
    user = models.ForeignKey(User, null=True, on_delete=models.SET_NULL)
    action = models.CharField(max_length=50)
    detail = models.CharField(max_length=300, blank=True, default="")
    ip = models.CharField(max_length=64, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)


class DocumentShare(models.Model):
    """Granular cross-company collaboration.

    Isolation stays the default: a user only sees their OWN company's rows.
    A DocumentShare is an explicit exception — it grants ONE named user (who may
    belong to another company) access to ONE specific document. So Company A's
    HR person can be given exactly one Company C file, and nothing else.
    """
    document = models.ForeignKey(Document, on_delete=models.CASCADE, related_name="shares")
    shared_with_user = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name="shared_documents"
    )
    # who granted it (their company owns the document)
    shared_by = models.ForeignKey(
        User, null=True, on_delete=models.SET_NULL, related_name="shares_created"
    )
    can_download = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("document", "shared_with_user")


class LLMConfig(models.Model):
    """Platform-wide LLM settings, editable at runtime from the Settings page.

    A single row (pk=1). When a field is left blank the matching .env value is
    used instead (see providers._resolve). The api_key is stored in plaintext —
    fine for local testing; in production put it in .env / a secrets manager and
    leave this blank.
    """
    PROVIDERS = [("ollama", "ollama"), ("openai", "openai"),
                 ("anthropic", "anthropic"), ("gemini", "gemini")]

    provider = models.CharField(max_length=20, choices=PROVIDERS, default="ollama")
    chat_model = models.CharField(max_length=120, blank=True, default="")
    api_key = models.CharField(max_length=400, blank=True, default="")
    base_url = models.CharField(max_length=300, blank=True, default="")
    temperature = models.FloatField(default=0.2)
    max_tokens = models.IntegerField(default=512)
    updated_at = models.DateTimeField(auto_now=True)

    @classmethod
    def load(cls):
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj
