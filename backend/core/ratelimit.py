"""A tiny cache-backed rate limiter for open and high-cost endpoints.

Counters live in Django's cache (LocMem in dev; Redis via CACHES in production
for multi-process correctness) and are incremented ATOMICALLY: `cache.add`
creates the window bucket only if it does not exist, `cache.incr` does the
counting — concurrent requests can no longer slip past the limit the way they
could with the old read-modify-write list.

Client identity:
    TRUSTED_PROXY_COUNT (default 1) is the number of reverse proxies between
    the browser and Django. With N >= 1 the Nth-from-the-last X-Forwarded-For
    entry is the IP the *first trusted proxy* saw (a client-supplied prefix is
    ignored, and the final entry is the one OUR proxy appended). With 0 the
    header is ignored entirely and REMOTE_ADDR is used — the safe mode when the
    API is reachable directly.

Usage:
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
    """Client IP for rate-limit keys and the audit trail.

    Uses the last `TRUSTED_PROXY_COUNT` X-Forwarded-For entries (the values our
    own proxies appended) so a spoofed client prefix cannot bypass the limiter
    or forge the audit trail. Falls back to REMOTE_ADDR when the API is exposed
    directly (TRUSTED_PROXY_COUNT=0) or no header is present.
    """
    count = int(getattr(settings, "TRUSTED_PROXY_COUNT", 1) or 0)
    remote = request.META.get("REMOTE_ADDR", "") or "unknown"
    if count <= 0:
        return remote
    fwd = request.META.get("HTTP_X_FORWARDED_FOR")
    if not fwd:
        return remote
    parts = [p.strip() for p in fwd.split(",") if p.strip()]
    if not parts:
        return remote
    return parts[-count]


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

    Fixed-window counters via the cache's atomic increment; when the limit is
    exceeded it responds 429 with a Retry-After for the remainder of the window.
    """
    def decorator(view_func):
        def wrapped(request, *args, **kwargs):
            if not getattr(settings, "RATELIMIT_ENABLED", True):
                return view_func(request, *args, **kwargs)
            ident = _identity(request, key)
            now = time.time()
            window = int(now // per_seconds)
            cache_key = f"rl:{name}:{ident}:{window}"
            hits = _increment(cache_key, per_seconds)
            if hits > rate:
                retry = int(per_seconds - (now % per_seconds)) + 1
                resp = Response(
                    {"detail": f"Too many attempts. Try again in {retry}s."},
                    status=429,
                )
                resp["Retry-After"] = str(retry)
                return resp
            return view_func(request, *args, **kwargs)
        return wrapped
    return decorator


def _increment(cache_key, per_seconds):
    """Atomically bump the window counter; returns the new count."""
    try:
        return cache.incr(cache_key)
    except ValueError:
        # Bucket missing: add() is atomic create-if-not-exists, so exactly one
        # racing request seeds it; everyone else increments from there.
        cache.add(cache_key, 0, per_seconds)
        try:
            return cache.incr(cache_key)
        except ValueError:
            return 1
