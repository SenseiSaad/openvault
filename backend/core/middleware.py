"""Request-level middleware: Origin validation and request IDs.

OriginCheckMiddleware is defence-in-depth for the cookie-JWT session: DRF's
custom authentication bypasses Django's CSRF machinery, and SameSite=Lax is
the only other line of defence. Browsers attach an `Origin` header to every
cross-origin (and most same-origin) unsafe requests, so requiring it to match
a trusted origin closes the remaining CSRF surface without breaking API
scripts, which simply send no Origin header at all.
"""
import contextvars
import logging
import uuid

from django.conf import settings


UNSAFE_METHODS = {"POST", "PUT", "PATCH", "DELETE"}

# One id per request, visible in every log line and the X-Request-ID response
# header — the join key between a user report, Sentry and the raw logs.
_request_id_var: contextvars.ContextVar = contextvars.ContextVar("request_id", default="")


def current_request_id() -> str:
    return _request_id_var.get("")


class RequestIDLogFilter(logging.Filter):
    def filter(self, record):
        record.request_id = _request_id_var.get("")
        return True


class RequestIDMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        raw = request.headers.get("X-Request-ID", "") or uuid.uuid4().hex
        rid = "".join(ch for ch in raw if ch.isalnum() or ch == "-")[:64] or uuid.uuid4().hex
        request.request_id = rid
        token = _request_id_var.set(rid)
        try:
            response = self.get_response(request)
        finally:
            _request_id_var.reset(token)
        response["X-Request-ID"] = rid
        return response


def _trusted_origins(request):
    """Origins allowed to make unsafe requests: configured CSRF/CORS origins
    plus the request's own scheme://host."""
    origins = set()
    for source in (settings.CSRF_TRUSTED_ORIGINS, settings.CORS_ALLOWED_ORIGINS):
        for entry in source or []:
            origins.add(entry.rstrip("/").lower())
    host = request.get_host()
    scheme = "https" if request.is_secure() else "http"
    origins.add(f"{scheme}://{host}".lower())
    # Both schemes of the configured host are accepted: TLS terminates at the
    # proxy, so the request may legitimately arrive as http internally.
    if "//" in host and host.split("://", 1)[0] in ("http", "https"):
        origins.add(host.rstrip("/").lower())
    return origins


class OriginCheckMiddleware:
    """Reject unsafe requests whose Origin header is not a trusted origin.

    Requests without an Origin header (curl, server-to-server, tests) pass —
    those clients are not subject to browser CSRF rules.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        origin = request.META.get("HTTP_ORIGIN", "").strip()
        if request.method in UNSAFE_METHODS and origin:
            if origin.rstrip("/").lower() not in _trusted_origins(request):
                from rest_framework.response import Response
                from rest_framework import status
                import logging
                logging.getLogger(__name__).warning(
                    "Rejected request with untrusted Origin %s for %s",
                    origin, request.path,
                )
                return Response(
                    {"detail": "Request blocked: untrusted origin."},
                    status=status.HTTP_403_FORBIDDEN,
                )
        return self.get_response(request)
