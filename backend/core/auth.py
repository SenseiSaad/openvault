"""Authentication helpers: HttpOnly cookie sessions on top of SimpleJWT.

The JWT access token lives in an HttpOnly, SameSite=Lax cookie so XSS in the
frontend can no longer exfiltrate it, and a separate refresh-token cookie plus
/api/auth/refresh lets sessions renew without re-login. The Authorization
header still works for scripts/tests. SameSite=Lax also blocks CSRF: browsers
do not attach the cookie to cross-site POSTs.
"""
from django.conf import settings
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.tokens import RefreshToken

ACCESS_COOKIE = "openvault_access"
REFRESH_COOKIE = "openvault_refresh"


def _cookie_kwargs(max_age):
    secure = getattr(settings, "SESSION_COOKIE_SECURE", False)
    return dict(
        max_age=max_age,
        httponly=True,
        samesite="Lax",
        secure=secure,
        path="/",
    )


def set_auth_cookies(response, user):
    """Attach access + refresh JWT cookies to a DRF Response."""
    refresh = RefreshToken.for_user(user)
    access_minutes = int(settings.SIMPLE_JWT.get("ACCESS_TOKEN_LIFETIME").total_seconds() // 60)
    response.set_cookie(ACCESS_COOKIE, str(refresh.access_token), **_cookie_kwargs(access_minutes * 60))
    # Refresh token outlives the access token (SimpleJWT default 1 day).
    refresh_days = int(settings.SIMPLE_JWT.get("REFRESH_TOKEN_LIFETIME").total_seconds() // 86400) or 1
    response.set_cookie(REFRESH_COOKIE, str(refresh), **_cookie_kwargs(refresh_days * 86400))
    return response


def clear_auth_cookies(response):
    for name in (ACCESS_COOKIE, REFRESH_COOKIE):
        response.delete_cookie(name, path="/")
    return response


class CookieJWTAuthentication(JWTAuthentication):
    """Read the JWT from the HttpOnly cookie first, then the header."""

    def authenticate(self, request):
        raw = request.COOKIES.get(ACCESS_COOKIE)
        if raw:
            validated = self.get_validated_token(raw)
            return self.get_user(validated), validated
        return super().authenticate(request)
