"""Django settings for the OpenVault API."""
import logging
import os
import tempfile
from datetime import timedelta
from pathlib import Path

try:
    from dotenv import load_dotenv
except ImportError:  # python-dotenv is optional; env vars still work without it
    def load_dotenv(*args, **kwargs):
        return False

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")

SECRET_KEY = os.environ.get("SECRET_KEY")
if not SECRET_KEY:
    raise ValueError("SECRET_KEY environment variable is required")
DEBUG = os.getenv("DEBUG", "false").lower() in ("1", "true", "yes")
ALLOWED_HOSTS = [h.strip() for h in os.getenv("ALLOWED_HOSTS", "localhost,127.0.0.1,testserver").split(",") if h.strip()]
# Render provides the generated service hostname at runtime. Include it even
# when the deployment also uses a custom API domain.
RENDER_EXTERNAL_HOSTNAME = os.getenv("RENDER_EXTERNAL_HOSTNAME", "").strip()
if RENDER_EXTERNAL_HOSTNAME and RENDER_EXTERNAL_HOSTNAME not in ALLOWED_HOSTS:
    ALLOWED_HOSTS.append(RENDER_EXTERNAL_HOSTNAME)

# Vercel provides runtime hostnames automatically for preview and production deployments.
IS_VERCEL = os.getenv("VERCEL", "").strip() in ("1", "true")
for _vercel_var in ("VERCEL_URL", "VERCEL_BRANCH_URL", "VERCEL_PROJECT_PRODUCTION_URL"):
    _v_host = os.getenv(_vercel_var, "").strip()
    if _v_host and _v_host not in ALLOWED_HOSTS:
        ALLOWED_HOSTS.append(_v_host)

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "rest_framework",
    "rest_framework_simplejwt.token_blacklist",
    "corsheaders",
    "core",
]

MIDDLEWARE = [
    "core.middleware.RequestIDMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
    "core.middleware.OriginCheckMiddleware",
    "core.mfa_admin.AdminMFAMiddleware",
]

ROOT_URLCONF = "config.urls"
WSGI_APPLICATION = "config.wsgi.application"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

# SQLite for zero-config local use; PostgreSQL in production/staging via
# DATABASE_URL or the POSTGRES_* variables (see .env.example).
if os.getenv("DATABASE_URL"):
    import dj_database_url  # optional dependency
    _conn_max_age = 0 if IS_VERCEL else int(os.getenv("DB_CONN_MAX_AGE", "600"))
    DATABASES = {
        "default": dj_database_url.config(
            default=os.environ["DATABASE_URL"],
            conn_max_age=_conn_max_age,
            conn_health_checks=True,
        )
    }
elif os.getenv("POSTGRES_DB"):
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.postgresql",
            "NAME": os.getenv("POSTGRES_DB"),
            "USER": os.getenv("POSTGRES_USER", "openvault"),
            "PASSWORD": os.getenv("POSTGRES_PASSWORD", ""),
            "HOST": os.getenv("POSTGRES_HOST", "db"),
            "PORT": os.getenv("POSTGRES_PORT", "5432"),
            "CONN_MAX_AGE": 600,
        }
    }
else:
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            # Honour SQLITE_PATH so container deployments can put the database
            # on a persistent volume instead of inside the image layer.
            "NAME": os.getenv("SQLITE_PATH") or str(BASE_DIR / "db.sqlite3"),
        }
    }

AUTH_USER_MODEL = "core.User"
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "core.auth.CookieJWTAuthentication",
    ),
    "DEFAULT_PERMISSION_CLASSES": ("rest_framework.permissions.IsAuthenticated",),
}

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=int(os.getenv("ACCESS_TOKEN_MINUTES", "15"))),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=int(os.getenv("REFRESH_TOKEN_DAYS", "7"))),
    "ROTATE_REFRESH_TOKENS": True,
    # The old token is blacklisted on every rotation, so a stolen refresh token
    # stops working as soon as the real user refreshes. Login/logout also
    # blacklist explicitly (see views.refresh/logout).
    "BLACKLIST_AFTER_ROTATION": True,
}

# Reject weak passwords at the API boundary too (not just in the UI).
AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator",
     "OPTIONS": {"min_length": 8}},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

# Cookies are HttpOnly + SameSite=Lax; set Secure when serving over HTTPS.
SESSION_COOKIE_SECURE = os.getenv("COOKIE_SECURE", "false").lower() in ("1", "true", "yes")
CSRF_COOKIE_SECURE = SESSION_COOKIE_SECURE
CSRF_TRUSTED_ORIGINS = [
    o.strip() for o in os.getenv("CSRF_TRUSTED_ORIGINS", "").split(",") if o.strip()
]

# Rate limiting counters live in the cache. LocMem is fine for one process;
# point CACHES at Redis (CACHE_URL) when running multiple workers/gunicorn.
if os.getenv("CACHE_URL", "").startswith("redis"):
    CACHES = {
        "default": {
            "BACKEND": "django.core.cache.backends.redis.RedisCache",
            "LOCATION": os.getenv("CACHE_URL"),
        }
    }
else:
    CACHES = {
        "default": {
            "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
            "LOCATION": "openvault-ratelimit",
        }
    }

# Number of trusted reverse proxies in front of Django (Caddy/ALB/Render = 1).
# Controls how much of X-Forwarded-For is believed for rate limiting and the
# audit trail; 0 ignores the header entirely (direct exposure).
TRUSTED_PROXY_COUNT = int(os.getenv("TRUSTED_PROXY_COUNT", "1"))

# Tighten CORS in production: list exact origins. The wide-open flag defaults OFF.
CORS_ALLOW_ALL_ORIGINS = os.getenv("CORS_ALLOW_ALL_ORIGINS", "false").lower() in ("1", "true", "yes")
CORS_ALLOWED_ORIGINS = [
    o.strip() for o in os.getenv(
        "CORS_ALLOWED_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000"
    ).split(",") if o.strip()
]
CORS_ALLOW_CREDENTIALS = True  # needed for the HttpOnly cookie session

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
STORAGES = {
    "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
    # Compressed (not manifest) so a missing optional asset cannot break the app.
    "staticfiles": {"BACKEND": "whitenoise.storage.CompressedStaticFilesStorage"},
}
LANGUAGE_CODE = "en-us"
TIME_ZONE = os.getenv("TIME_ZONE", "Asia/Karachi")
USE_TZ = True

DATA_UPLOAD_MAX_MEMORY_SIZE = int(os.getenv("MAX_UPLOAD_SIZE", 50 * 1024 * 1024))
FILE_UPLOAD_MAX_MEMORY_SIZE = DATA_UPLOAD_MAX_MEMORY_SIZE
# Disable in tests (pytest sets RATELIMIT_ENABLED=false) so shared loopback
# traffic is not throttled.
RATELIMIT_ENABLED = os.getenv("RATELIMIT_ENABLED", "true").lower() in ("1", "true", "yes")

# ── App/LLM config ──
_default_data_dir = str(Path(tempfile.gettempdir()) / "openvault" / "data") if IS_VERCEL else str(BASE_DIR / "data")
DATA_DIR = os.getenv("DATA_DIR", _default_data_dir)
try:
    os.makedirs(DATA_DIR, exist_ok=True)
except OSError:
    pass

# ── Optional S3 Object Storage (used on Vercel / stateless hosts) ──
AWS_STORAGE_BUCKET_NAME = os.getenv("AWS_STORAGE_BUCKET_NAME", "").strip()
AWS_S3_REGION_NAME = os.getenv("AWS_S3_REGION_NAME", os.getenv("BEDROCK_REGION", "ap-south-1")).strip()
AWS_S3_ENDPOINT_URL = os.getenv("AWS_S3_ENDPOINT_URL", "").strip()
AWS_ACCESS_KEY_ID = os.getenv("AWS_ACCESS_KEY_ID", "").strip()
AWS_SECRET_ACCESS_KEY = os.getenv("AWS_SECRET_ACCESS_KEY", "").strip()

# Run RAG indexing synchronously on serverless platforms where daemon threads are frozen after response.
SYNC_INDEXING = os.getenv("SYNC_INDEXING", "true" if IS_VERCEL else "false").lower() in ("1", "true", "yes")

# ── Celery (background indexing / retention jobs) ──
# Inactive without CELERY_BROKER_URL: indexing falls back to in-process threads
# so local/dev keeps working with zero config. Prod compose sets the broker to
# Redis; beat runs the requeue and retention jobs (see CELERY_BEAT_SCHEDULE).
CELERY_BROKER_URL = os.getenv("CELERY_BROKER_URL", "")
CELERY_TASK_ALWAYS_EAGER = os.getenv("CELERY_TASK_ALWAYS_EAGER", "false").lower() in ("1", "true", "yes")
CELERY_TASK_TIME_LIMIT = int(os.getenv("CELERY_TASK_TIME_LIMIT", "900"))
CELERY_BROKER_CONNECTION_RETRY_ON_STARTUP = True
if CELERY_BROKER_URL or CELERY_TASK_ALWAYS_EAGER:
    from celery.schedules import crontab
    CELERY_BEAT_SCHEDULE = {
        "requeue-stuck-documents": {
            "task": "core.tasks.requeue_stuck_documents",
            "schedule": 900.0,  # every 15 minutes
        },
        "prune-asklogs": {
            "task": "core.tasks.prune_asklogs_task",
            "schedule": crontab(hour=3, minute=15),
        },
    }

# ── LLM provider config ──
# API keys saved through the settings UI are encrypted at rest. Set a stable
# LLM_KEY_ENCRYPTION_KEY in production (back it up); when blank it is derived
# from SECRET_KEY, so rotating SECRET_KEY also invalidates stored keys.
LLM_KEY_ENCRYPTION_KEY = os.getenv("LLM_KEY_ENCRYPTION_KEY", "")
LLM_URL = os.getenv("LLM_URL", "http://localhost:11434").rstrip("/")
LLM_MODEL = os.getenv("LLM_MODEL", "qwen2.5:1.5b")
EMBED_MODEL = os.getenv("EMBED_MODEL", "nomic-embed-text")
TOP_K = int(os.getenv("TOP_K", "4"))
# pgvector column dimension — must match the embedding provider's output width
# (titan-embed-text-v2 = 1024, nomic-embed-text = 768, text-embedding-3-small =
# 1536). Changing it requires a reindex; see docs/runbooks.
EMBED_DIM = int(os.getenv("EMBED_DIM", "1024"))
# Upper bound on the chunk pool scanned in Python when pgvector is unavailable
# (SQLite dev, or a Postgres without the extension). Keeps retrieval latency
# bounded instead of growing with the whole corpus.
RETRIEVAL_MAX_POOL = int(os.getenv("RETRIEVAL_MAX_POOL", "2000"))

# Gate login on a verified email address (off for local dev convenience).
REQUIRE_EMAIL_VERIFICATION = os.getenv("REQUIRE_EMAIL_VERIFICATION", "false").lower() in ("1", "true", "yes")

# ── Media (generated artefacts: auto-filled leave forms, etc.) ──
MEDIA_URL = os.getenv("MEDIA_URL", "/media/")
_default_media_root = str(Path(tempfile.gettempdir()) / "openvault" / "media") if IS_VERCEL else str(BASE_DIR / "media")
MEDIA_ROOT = os.getenv("MEDIA_ROOT", _default_media_root)
try:
    os.makedirs(os.path.join(MEDIA_ROOT, "forms"), exist_ok=True)
except OSError:
    pass

# ── Email (verification / reset / meeting confirmations) ──
EMAIL_BACKEND = os.getenv("EMAIL_BACKEND", "django.core.mail.backends.console.EmailBackend")
EMAIL_HOST = os.getenv("EMAIL_HOST", "localhost")
EMAIL_PORT = int(os.getenv("EMAIL_PORT", "25"))
EMAIL_HOST_USER = os.getenv("EMAIL_HOST_USER", "")
EMAIL_HOST_PASSWORD = os.getenv("EMAIL_HOST_PASSWORD", "")
EMAIL_USE_TLS = os.getenv("EMAIL_USE_TLS", "false").lower() in ("1", "true", "yes")
DEFAULT_FROM_EMAIL = os.getenv("DEFAULT_FROM_EMAIL", "OpenVault <no-reply@openvault.local>")

# ── Google Calendar (meeting scheduling) ──
GOOGLE_CALENDAR_CREDENTIALS = os.getenv("GOOGLE_CALENDAR_CREDENTIALS", "")
GOOGLE_CALENDAR_ID = os.getenv("GOOGLE_CALENDAR_ID", "primary")

# Absolute origin used for emailed links and generated-form download URLs.
PUBLIC_BASE_URL = os.getenv("PUBLIC_BASE_URL", "").rstrip("/")

# ── Attendance / strike policy (Feature 5) ──
ATTENDANCE_MONTHLY_ABSENCE_LIMIT = int(os.getenv("ATTENDANCE_MONTHLY_ABSENCE_LIMIT", "3"))
ATTENDANCE_MAX_STRIKES = int(os.getenv("ATTENDANCE_MAX_STRIKES", "3"))

# ── Security headers (HTTPS deployments) ──
SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_REFERRER_POLICY = "same-origin"
X_FRAME_OPTIONS = "DENY"
SESSION_COOKIE_HTTPONLY = True
CSRF_COOKIE_HTTPONLY = False  # the frontend reads this only if CSRF headers are added
SESSION_COOKIE_SAMESITE = "Lax"
CSRF_COOKIE_SAMESITE = "Lax"

if SESSION_COOKIE_SECURE:
    SECURE_SSL_REDIRECT = os.getenv("SECURE_SSL_REDIRECT", "true").lower() in ("1", "true", "yes")
    # Render's internal health check can arrive over plain HTTP; never redirect it.
    SECURE_REDIRECT_EXEMPT = [r"^api/health/?$"]
    SECURE_HSTS_SECONDS = int(os.getenv("SECURE_HSTS_SECONDS", "31536000"))
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    SECURE_HSTS_PRELOAD = True
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")

# Fail fast instead of silently serving production traffic over plain HTTP or
# with a wildcard host. Set ENVIRONMENT=production in real deployments; local
# Docker/HTTP runs either leave it unset or set ALLOW_INSECURE_HTTP=true.
IS_PRODUCTION = os.getenv("ENVIRONMENT", "").strip().lower() in ("production", "prod")
if not DEBUG and IS_PRODUCTION:
    if not SESSION_COOKIE_SECURE and os.getenv("ALLOW_INSECURE_HTTP", "false").lower() not in ("1", "true", "yes"):
        raise ValueError(
            "Refusing to start in production with insecure cookies. "
            "Set COOKIE_SECURE=true (HTTPS) or ALLOW_INSECURE_HTTP=true for local HTTP."
        )
    if not ALLOWED_HOSTS or "*" in ALLOWED_HOSTS:
        raise ValueError("ALLOWED_HOSTS must list explicit hostnames in production.")

# ── Logging (stdout/stderr so Docker/CloudWatch collect it) ──
LOG_FORMAT = os.getenv("LOG_FORMAT", "plain")  # "json" in production
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")


class JsonLogFormatter(logging.Formatter):
    """One JSON object per log line, with the request id when available."""

    def format(self, record):
        import json as _json
        payload = {
            "ts": self.formatTime(record, "%Y-%m-%dT%H:%M:%S%z"),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }
        rid = getattr(record, "request_id", "")
        if rid:
            payload["request_id"] = rid
        if record.exc_info:
            payload["exception"] = self.formatException(record.exc_info)
        return _json.dumps(payload, ensure_ascii=False)


_CONSOLE_HANDLER = {
    "class": "logging.StreamHandler",
    "formatter": "json" if LOG_FORMAT == "json" else "verbose",
    "filters": ["request_id"],
}

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "filters": {
        "request_id": {"()": "core.middleware.RequestIDLogFilter"},
    },
    "formatters": {
        "verbose": {"format": "%(asctime)s %(levelname)s [%(request_id)s] %(name)s %(message)s"},
        "json": {"()": JsonLogFormatter},
    },
    "handlers": {"console": _CONSOLE_HANDLER},
    "root": {"handlers": ["console"], "level": LOG_LEVEL},
    "loggers": {
        "django.request": {"handlers": ["console"], "level": "WARNING", "propagate": False},
    },
}

# ── Sentry (error tracking) — inactive until SENTRY_DSN is set ──
SENTRY_DSN = os.getenv("SENTRY_DSN", "").strip()
if SENTRY_DSN:
    import sentry_sdk
    from sentry_sdk.integrations.django import DjangoIntegration

    sentry_sdk.init(
        dsn=SENTRY_DSN,
        integrations=[DjangoIntegration()],
        traces_sample_rate=float(os.getenv("SENTRY_TRACES_RATE", "0.1")),
        send_default_pii=False,
        environment=os.getenv("ENVIRONMENT", "development"),
    )
