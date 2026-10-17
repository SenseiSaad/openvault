from rest_framework.permissions import BasePermission


def is_platform_admin(user):
    """True for a platform root admin. This is an explicit database flag set by
    the `create_platform_admin` management command — never an email address."""
    return bool(user and user.is_authenticated and user.is_platform_admin)


class IsAdmin(BasePermission):
    """Company admins, platform admins, and superusers."""

    def has_permission(self, request, view):
        u = request.user
        return bool(
            u and u.is_authenticated and (u.role == "admin" or u.is_superuser or u.is_platform_admin)
        )


class IsPlatformAdmin(BasePermission):
    """Platform root admins only (full authority across tenants)."""

    def has_permission(self, request, view):
        u = request.user
        return bool(u and u.is_authenticated and (u.is_platform_admin or u.is_superuser))


class IsEditor(BasePermission):
    """Admins, employees (and platform admins) may change documents; viewers cannot."""

    def has_permission(self, request, view):
        u = request.user
        return bool(
            u and u.is_authenticated
            and (u.role in ("admin", "employee") or u.is_superuser or u.is_platform_admin)
        )
