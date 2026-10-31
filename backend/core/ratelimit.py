"""A tiny cache-backed rate limiter for the open (unauthenticated) endpoints.

Sliding-window counters live in Django's cache (LocMem in dev; swap in Redis
via CACHES in production for multi-process correctness). Usage:

    @api_view(["POST"])
    @permission_classes([AllowAny])
    @rate_limit("login", rate=5, per_seconds=60, key="ip_email")
    def login(request): ...
"""
import time

from django.conf import settings
from django.core.cache import cache
from rest_framework.response import Response


def _client_ip(request):
    """Client IP for rate-limit keys.

    Use the last X-Forwarded-For entry (the value added by the trusted reverse
    proxy) so a spoofed prefix cannot bypass the limiter. Falls back to
    REMOTE_ADDR when the API is exposed directly.
    """
    fwd = request.META.get("HTTP_X_FORWARDED_FOR")
    if fwd:
        parts = [p.strip() for p in fwd.split(",") if p.strip()]
        if parts:
            return parts[-1]
    return request.META.get("REMOTE_ADDR", "") or "unknown"


def _identity(request, key):
    if key == "user":
        # Authenticated endpoints are limited per account, not per IP, so a
        # shared office NAT does not throttle colleagues into each other.
        user = getattr(request, "user", None)
        if user is not None and getattr(user, "is_authenticated", False):
            return f"u{user.pk}"
        return _client_ip(request)
    if key == "ip":
        return _client_ip(request)
    if key == "ip_email":
        email = ""
        if isinstance(request.data, dict):
            email = str(request.data.get("email") or request.data.get("username") or "").lower()
        return f"{_client_ip(request)}:{email}"
    return _client_ip(request)


def rate_limit(name, rate=5, per_seconds=60, key="ip"):
    """Return a DRF decorator limiting `name` to `rate` hits per window.
    When the limit is exceeded it responds 429 with a friendly Retry-After."""
    def decorator(view_func):
        def wrapped(request, *args, **kwargs):
            if not getattr(settings, "RATELIMIT_ENABLED", True):
                return view_func(request, *args, **kwargs)
            ident = _identity(request, key)
            cache_key = f"rl:{name}:{ident}"
            now = time.time()
            hits = cache.get(cache_key)
            if not isinstance(hits, list):
                hits = []
            hits = [t for t in hits if now - t < per_seconds]
            if len(hits) >= rate:
                retry = int(per_seconds - (now - hits[0])) + 1
                resp = Response(
                    {"detail": f"Too many attempts. Try again in {retry}s."},
                    status=429,
                )
                resp["Retry-After"] = str(retry)
                return resp
            hits.append(now)
            cache.set(cache_key, hits, per_seconds)
            return view_func(request, *args, **kwargs)
        return wrapped
    return decorator
