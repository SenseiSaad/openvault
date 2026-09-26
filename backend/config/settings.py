"""Django settings for the Secure Knowledge Platform API."""
import os
from datetime import timedelta
from pathlib import Path

try:
    from dotenv import load_dotenv
except ImportError:  # python-dotenv is optional; env vars still work without it
    def load_dotenv(*args, **kwargs):
        return False

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")

SECRET_KEY = os.getenv("SECRET_KEY", "dev-insecure-secret-change-me")
DEBUG = os.getenv("DEBUG", "true").lower() in ("1", "true", "yes")
ALLOWED_HOSTS = ["*"]  # dev only — restrict for production

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "rest_framework",
    "corsheaders",
    "core",
]

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
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

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": BASE_DIR / "db.sqlite3",
    }
}

AUTH_USER_MODEL = "core.User"
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ),
    "DEFAULT_PERMISSION_CLASSES": ("rest_framework.permissions.IsAuthenticated",),
}

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=int(os.getenv("ACCESS_TOKEN_MINUTES", "720"))),
}

# Dev: allow the Vite frontend from localhost or the LAN IP. Tighten in production.
CORS_ALLOW_ALL_ORIGINS = True

STATIC_URL = "static/"
LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_TZ = True

# ── App/LLM config ──
DATA_DIR = os.getenv("DATA_DIR", str(BASE_DIR / "data"))
os.makedirs(DATA_DIR, exist_ok=True)
LLM_URL = os.getenv("LLM_URL", "http://localhost:11434").rstrip("/")
LLM_MODEL = os.getenv("LLM_MODEL", "qwen2.5:1.5b")
EMBED_MODEL = os.getenv("EMBED_MODEL", "nomic-embed-text")
TOP_K = int(os.getenv("TOP_K", "4"))
