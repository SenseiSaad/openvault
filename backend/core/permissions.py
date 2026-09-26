from rest_framework.permissions import BasePermission


class IsAdmin(BasePermission):
    """Company admins only."""

    def has_permission(self, request, view):
        return bool(
            request.user and request.user.is_authenticated and request.user.role == "admin"
        )


class IsEditor(BasePermission):
    """Admins and employees may change documents; viewers cannot."""

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.role in ("admin", "employee")
        )
