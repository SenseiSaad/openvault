"""Database tables. Every tenant-owned row carries `company` — that FK is the
backbone of multi-tenant isolation (one company can never see another's data)."""
import os
import secrets
import string
from datetime import timedelta

from django.contrib.auth.models import (
    AbstractBaseUser, BaseUserManager, PermissionsMixin,
)
from django.db import models

from .crypto import decrypt_secret, encrypt_secret


class EncryptedCharField(models.CharField):
    """CharField whose value is encrypted at rest, transparently.

    Database column type is unchanged; legacy plaintext rows still read and are
    encrypted the next time they are written.
    """

    def from_db_value(self, value, expression, connection):
        return decrypt_secret(value)

    def get_prep_value(self, value):
        return encrypt_secret(super().get_prep_value(value))


_COMPANY_CODE_ALPHABET = string.ascii_uppercase + string.digits


def generate_company_code():
    """Return a short, human-shareable identifier unique to one company.

    Eight characters (36^8 ≈ 2.8 trillion) keeps the directory endpoints
    un-enumerable while staying typeable by hand.
    """
    return "".join(secrets.choice(_COMPANY_CODE_ALPHABET) for _ in range(8))


class Company(models.Model):
    """One tenant. Every document, chunk, user and audit row hangs off a company,
    and queries always filter by it, so tenants stay fully isolated."""
    name = models.CharField(max_length=200)
    slug = models.SlugField(unique=True)
    # Short identifier shown to admins and used for cross-company lookup.
    # It is intentionally not derived from the company name, so it is safe to
    # share without exposing a predictable tenant URL. 8 chars since the
    # directory hardening; older 5-char codes keep working.
    access_code = models.CharField(max_length=8, unique=True, null=True, blank=True)
    # --- optional company profile (collected at registration, shown in the workspace) ---
    website = models.CharField(max_length=200, blank=True, default="")
    contact_email = models.EmailField(blank=True, default="")
    phone = models.CharField(max_length=40, blank=True, default="")
    # Seat limit for member accounts. NULL means unlimited; when set, admins can't
    # add more members than this (enforced in the users() view, never crashes).
    max_employees = models.PositiveIntegerField(null=True, blank=True)
    # Subscription tier. Governed by Plan limits; every new company starts on
    # the default (Free) plan. Platform admins can move a company between plans.
    plan = models.ForeignKey(
        "Plan", on_delete=models.PROTECT, related_name="companies", null=True, blank=True,
    )
    # Stripe linkage (blank when billing is handled offline / not configured).
    stripe_customer_id = models.CharField(max_length=120, blank=True, default="")
    stripe_subscription_id = models.CharField(max_length=120, blank=True, default="")
    subscription_status = models.CharField(max_length=30, blank=True, default="")
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

    # Reply-language preference for the AI assistant. English is the default;
    # Roman Urdu (Urdu written in Latin script) is the opt-in for daily use.
    LANGUAGES = [("en", "English"), ("ur", "Roman Urdu")]

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
    department = models.ForeignKey(
        "Department", on_delete=models.SET_NULL, related_name="members",
        null=True, blank=True,
    )
    role = models.CharField(max_length=20, choices=ROLES, default="employee")
    # Platform root admin: complete authority over every tenant, the platform
    # LLM default, plans and company plan assignment. Granted via the
    # `create_platform_admin` management command — never hardcoded to an email.
    is_platform_admin = models.BooleanField(default=False)
    # TOTP two-factor secrets (RFC 6238). Required for platform-admin sign-ins;
    # see core.mfa. The secret is encrypted at rest like LLMConfig.api_key.
    mfa_secret = EncryptedCharField(max_length=64, blank=True, default="")
    mfa_enabled = models.BooleanField(default=False)
    email_verified = models.BooleanField(default=False)
    language = models.CharField(max_length=2, choices=LANGUAGES, default="en")
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    objects = UserManager()
    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = []

    def __str__(self):
        return self.email


class Department(models.Model):
    """A team inside one company. Documents can be scoped to a department so
    only its members (plus explicit grantees) can read them."""
    company = models.ForeignKey(Company, on_delete=models.CASCADE, related_name="departments")
    name = models.CharField(max_length=120)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("company", "name")
        ordering = ["name"]

    def __str__(self):
        return f"{self.company.name} / {self.name}"


class Plan(models.Model):
    """A subscription tier. Limits are enforced server-side (seats on member
    creation, document count + storage on upload, monthly asks on /api/ask).
    Prices are in USD per month; the Free plan is auto-attached to every new
    company. Local payment methods and a PKR equivalent are handled at
    checkout, not in this table."""
    name = models.CharField(max_length=60, unique=True)
    price_usd = models.PositiveIntegerField(default=0)
    billing_period = models.CharField(max_length=20, default="month")
    max_members = models.PositiveIntegerField(null=True, blank=True)      # None = unlimited
    max_documents = models.PositiveIntegerField(null=True, blank=True)
    storage_mb = models.PositiveIntegerField(null=True, blank=True)
    monthly_ask_limit = models.PositiveIntegerField(null=True, blank=True)
    # Extra capabilities a plan unlocks (checked in views, not just shown).
    allow_versions = models.BooleanField(default=False)
    allow_departments = models.BooleanField(default=False)
    allow_custom_llm = models.BooleanField(default=False)
    is_default = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name

    @classmethod
    def default(cls):
        """The default (Free) plan. Auto-provisions it on fresh installs so a
        missing seed command can never block company registration."""
        plan = cls.objects.filter(is_default=True, is_active=True).first()
        if plan is None:
            plan = cls.objects.filter(name="Free").first()
        if plan is None:
            plan = cls.objects.create(
                name="Free", price_usd=0, billing_period="month",
                max_members=3, max_documents=20, storage_mb=512, monthly_ask_limit=50,
                is_default=True,
            )
        return plan


class OneTimeToken(models.Model):
    """Single-purpose, expiring, hashed token for email verification and
    password resets. The raw token only ever exists in the emailed link."""
    PURPOSES = [("verify_email", "verify_email"), ("password_reset", "password_reset")]

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="one_time_tokens")
    purpose = models.CharField(max_length=20, choices=PURPOSES)
    token_hash = models.CharField(max_length=64, unique=True)  # sha256 hex of the raw token
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    used_at = models.DateTimeField(null=True, blank=True)

    def is_valid(self):
        from django.utils import timezone
        return self.used_at is None and self.expires_at > timezone.now()

    @classmethod
    def issue(cls, user, purpose, minutes=60):
        import hashlib
        from django.utils import timezone
        raw = secrets.token_urlsafe(32)
        obj = cls.objects.create(
            user=user, purpose=purpose, token_hash=hashlib.sha256(raw.encode()).hexdigest(),
            expires_at=timezone.now() + timedelta(minutes=minutes),
        )
        return obj, raw

    @classmethod
    def consume(cls, raw, purpose):
        """Return the token row when valid, marking it used. None otherwise."""
        import hashlib
        from django.utils import timezone
        h = hashlib.sha256((raw or "").encode()).hexdigest()
        obj = cls.objects.filter(token_hash=h, purpose=purpose).first()
        if not obj or not obj.is_valid():
            return None
        obj.used_at = timezone.now()
        obj.save(update_fields=["used_at"])
        return obj


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
    # `department` limits visibility to members of document.department.
    ACCESS_SCOPES = [
        ("company", "Entire company"),
        ("restricted", "Selected people"),
        ("department", "My department"),
    ]
    access_scope = models.CharField(max_length=20, choices=ACCESS_SCOPES, default="company")
    department = models.ForeignKey(
        Department, on_delete=models.SET_NULL, related_name="documents", null=True, blank=True,
    )
    # Comma-separated free-form tags (searchable/filterable in the workspace).
    tags = models.CharField(max_length=300, blank=True, default="")
    # Background indexing lifecycle: upload returns immediately (pending) and a
    # worker thread flips this to ready (or failed) once chunks exist.
    INDEXING_STATES = [("pending", "pending"), ("ready", "ready"), ("failed", "failed")]
    indexing_status = models.CharField(max_length=10, choices=INDEXING_STATES, default="ready")
    index_error = models.CharField(max_length=300, blank=True, default="")
    version = models.PositiveIntegerField(default=1)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)


class DocumentVersion(models.Model):
    """A frozen copy of a document's file as of a version upload. The current
    file lives on Document; older ones are archived here (plan-gated)."""
    document = models.ForeignKey(Document, on_delete=models.CASCADE, related_name="versions")
    version_number = models.PositiveIntegerField()
    stored_path = models.CharField(max_length=500)
    filename = models.CharField(max_length=300)
    size = models.IntegerField(default=0)
    uploaded_by = models.ForeignKey(User, null=True, on_delete=models.SET_NULL)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("document", "version_number")
        ordering = ["-version_number"]


class ChatConversation(models.Model):
    """A named chat thread for one user in one company. Messages persist so the
    assistant keeps context across turns and users can revisit old answers."""
    company = models.ForeignKey(Company, on_delete=models.CASCADE, related_name="conversations")
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="conversations")
    title = models.CharField(max_length=120, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-updated_at"]

    def __str__(self):
        return self.title or f"Chat {self.pk}"


class ChatMessage(models.Model):
    """One persisted turn inside a ChatConversation. Assistant rows keep their
    grounded source names and a thumbs up/down rating for quality analytics."""
    conversation = models.ForeignKey(
        ChatConversation, on_delete=models.CASCADE, related_name="messages",
    )
    role = models.CharField(max_length=10)  # "user" | "assistant"
    content = models.TextField()
    sources = models.TextField(blank=True, default="")  # JSON list of filenames
    # null = unrated; 1 = thumbs up; -1 = thumbs down
    rating = models.IntegerField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at"]


class AskLog(models.Model):
    """One row per /api/ask call. Powers usage analytics: questions per user or
    department, unanswered questions (zero chunks retrieved), flagged asks and
    plan quota accounting."""
    company = models.ForeignKey(Company, on_delete=models.CASCADE, related_name="ask_logs")
    user = models.ForeignKey(User, null=True, on_delete=models.SET_NULL, related_name="ask_logs")
    department = models.ForeignKey(
        Department, on_delete=models.SET_NULL, null=True, blank=True, related_name="ask_logs",
    )
    question = models.TextField()
    mode = models.CharField(max_length=10, blank=True, default="")
    provider = models.CharField(max_length=20, blank=True, default="")
    chunks_found = models.IntegerField(default=0)
    answered = models.BooleanField(default=False)
    flagged = models.BooleanField(default=False)
    latency_ms = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)


class Announcement(models.Model):
    """A company-wide broadcast from an admin, shown in the workspace."""
    company = models.ForeignKey(Company, on_delete=models.CASCADE, related_name="announcements")
    title = models.CharField(max_length=200)
    body = models.TextField()
    created_by = models.ForeignKey(User, null=True, on_delete=models.SET_NULL)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]


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
    """Runtime-editable LLM settings.

    Two levels: the platform-wide row (company NULL, pk arbitrary) and optional
    per-company overrides (a company's own provider/model/key). Resolution in
    providers._resolve(): company row -> platform row -> .env, except that the
    Render BEDROCK_API_KEY/BEDROCK_MODEL win over a stale platform row so every
    ordinary user shares the platform key. The api_key is encrypted at rest
    (core.crypto) and never returned by the API.
    """
    PROVIDERS = [("ollama", "ollama"), ("openai", "openai"),
                 ("anthropic", "anthropic"), ("gemini", "gemini"),
                 ("bedrock", "bedrock")]

    company = models.ForeignKey(
        Company, on_delete=models.CASCADE, related_name="llm_configs",
        null=True, blank=True,
    )
    provider = models.CharField(max_length=20, choices=PROVIDERS, default="ollama")
    chat_model = models.CharField(max_length=120, blank=True, default="")
    api_key = EncryptedCharField(max_length=1000, blank=True, default="")
    base_url = models.CharField(max_length=300, blank=True, default="")
    temperature = models.FloatField(default=0.2)
    max_tokens = models.IntegerField(default=512)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["company"], condition=models.Q(company__isnull=False),
                name="uniq_llmconfig_per_company",
            )
        ]

    @classmethod
    def load(cls):
        """The platform-wide row when one exists; otherwise an UNSAVED default
        derived from the environment. Never auto-creates a row, so `.env` stays
        the source of truth until a platform admin explicitly saves settings."""
        obj = cls.objects.filter(company=None).first()
        if obj is not None:
            return obj
        provider = os.getenv("LLM_PROVIDER", "ollama").strip().lower()
        if provider not in dict(cls.PROVIDERS):
            provider = "ollama"
        model_env = "LLM_MODEL" if provider == "ollama" else f"{provider.upper()}_MODEL"
        return cls(provider=provider, chat_model=os.getenv(model_env, "").strip())

    @classmethod
    def for_company(cls, company):
        """The company's own override row, or None when it uses the platform default."""
        if company is None:
            return None
        return cls.objects.filter(company=company).first()


class AttendanceRecord(models.Model):
    """One attendance mark for one user on one calendar day (Feature 5).

    Created when an employee scans the company QR code from an authenticated web
    session. `company` keeps the row tenant-scoped like every other table, and
    the (user, date) pair is unique so a day can only be marked once."""
    STATUSES = [("Present", "Present"), ("Absent", "Absent")]

    company = models.ForeignKey(Company, on_delete=models.CASCADE, related_name="attendance")
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="attendance")
    date = models.DateField()
    scanned_at = models.DateTimeField(auto_now_add=True)
    status = models.CharField(max_length=10, choices=STATUSES, default="Present")

    class Meta:
        unique_together = ("user", "date")
        ordering = ["-date", "-scanned_at"]

    def __str__(self):
        return f"{self.user} {self.date} {self.status}"


class UserStrike(models.Model):
    """Rolling attendance-discipline counter for one user (Feature 5).

    The monthly evaluation utility refreshes `absent_count`, and when a month
    crosses the absence limit it increments `strikes`. Once `strikes` reaches the
    cap the account is frozen (and deactivated by the evaluator). `last_evaluated_period`
    guards against double-counting if the evaluation runs twice in the same month."""
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="strike_record")
    absent_count = models.IntegerField(default=0)
    strikes = models.IntegerField(default=0)
    is_frozen = models.BooleanField(default=False)
    # "YYYY-MM" of the last month already counted toward strikes.
    last_evaluated_period = models.CharField(max_length=7, blank=True, default="")
    last_updated = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.user}: {self.strikes} strike(s), {self.absent_count} absence(s)"
