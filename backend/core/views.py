"""API endpoints. Function-based DRF views kept deliberately simple and flat.

Multi-tenant rule enforced everywhere: a request only ever touches rows where
`company == request.user.company`. Document reads additionally pass the
per-document ACL before metadata, downloads, or RAG retrieval are returned.

Authentication uses HttpOnly JWT cookies (see core.auth); the Authorization
header still works for scripts. Open endpoints are rate-limited (core.ratelimit).
Platform-level authority is the `is_platform_admin` flag — never an email.
"""
import io
import json
import os
import threading
import uuid

from django.contrib.auth import authenticate
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db.models import Q, Avg, Count, Sum
from django.http import StreamingHttpResponse, Http404, FileResponse, JsonResponse
from django.utils import timezone
from django.utils.text import slugify
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes, authentication_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from django.conf import settings

from . import rag
from . import providers
from . import moderation
from . import billing
from . import storage
from . import attendance as attendance_svc
from .auth import (
    set_auth_cookies, clear_auth_cookies, revoke_user_refresh_tokens,
    ACCESS_COOKIE, REFRESH_COOKIE,
)
from .ratelimit import rate_limit
from .uploads import UploadRejected, guard_zip_archive, validate_extension, validate_filename
from .models import (
    Announcement, AskLog, AuditLog, ChatConversation, ChatMessage, Company, Department,
    Document, DocumentAccess, DocumentShare, DocumentVersion, LLMConfig, Plan,
    AttendanceRecord, UserStrike, User, OneTimeToken,
)
from .permissions import IsAdmin, IsEditor, IsPlatformAdmin, is_platform_admin
from .serializers import (
    AnnouncementSerializer, AskLogSerializer, AuditSerializer, ChatConversationSerializer,
    ChatMessageSerializer, CompanyDirectorySerializer, CompanyProfileSerializer,
    DepartmentSerializer, DocumentSerializer, DocumentVersionSerializer,
    MemberDirectorySerializer, PlanSerializer, UserSerializer,
    RegisterCompanySerializer, LoginSerializer, UserCreateSerializer, AskSerializer,
    DocumentShareSerializer, LLMConfigSerializer,
    AttendanceRecordSerializer, UserStrikeSerializer,
)


def client_ip(request):
    """Caller IP for the audit log — shared trusted-proxy logic with the rate
    limiter, so a client-supplied X-Forwarded-For prefix cannot forge entries."""
    from .ratelimit import _client_ip
    return _client_ip(request)


def _password_error(password, user=None):
    """Return a human-readable policy violation, or None when the password is OK."""
    try:
        validate_password(password, user=user)
    except DjangoValidationError as exc:
        return " ".join(exc.messages)
    return None


def _upload_rejection(f):
    """A 400 Response for rejected uploads, or None when the file is acceptable.

    Cheap checks (name, extension) and the zip-bomb guard run here so a bad
    file never reaches storage; PDF page/text caps are enforced later inside
    extract_text, which is the single path every consumer goes through.
    """
    try:
        validate_filename(f.name)
        validate_extension(f.name)
        if (f.name or "").lower().endswith((".docx", ".pptx")):
            guard_zip_archive(f.read())
            f.seek(0)
    except UploadRejected as exc:
        return Response({"detail": str(exc)}, status=400)
    return None


@api_view(["GET"])
@permission_classes([AllowAny])
def health(request):
    """Liveness/readiness probe for load balancers and uptime monitors.
    DB is exercised with a real query; everything else is static info."""
    from django.db import connection
    db_ok = True
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
            cursor.fetchone()
    except Exception:
        db_ok = False
    payload = {
        "status": "ok" if db_ok else "degraded",
        "db": db_ok,
        "time": timezone.now().isoformat(),
    }
    return JsonResponse(payload, status=200 if db_ok else 503)


def audit(request, action, detail=""):
    """Write one audit-trail row for the caller's company."""
    user = request.user if getattr(request, "user", None) and request.user.is_authenticated else None
    company = getattr(user, "company", None)
    if company is None:
        return
    AuditLog.objects.create(
        company=company, user=user, action=action, detail=detail[:300], ip=client_ip(request)
    )


def _is_platform_level(user):
    """Platform-level authority: the DB flag or a Django superuser."""
    return bool(
        user and user.is_authenticated and (user.is_superuser or user.is_platform_admin)
    )


def visible_documents(user):
    """Return only documents the signed-in user is allowed to read."""
    if _is_platform_level(user):
        if getattr(user, "company_id", None):
            return Document.objects.filter(company_id=user.company_id).distinct()
        return Document.objects.all().distinct()
    if not getattr(user, "company_id", None):
        return Document.objects.none()
    dept_q = (
        Q(access_scope="department", department_id=user.department_id)
        if getattr(user, "department_id", None) else Q()
    )
    return (
        Document.objects.filter(company_id=user.company_id)
        .filter(Q(access_scope="company") | dept_q | Q(access_grants__user=user))
        .distinct()
    )


def share_target(request):
    """Resolve a registered target user from a company code + member id.

    The code is required so a caller can never probe arbitrary user ids; the
    member must belong to the company the code resolved to.
    """
    access_code = (request.data.get("access_code") or "").strip().upper()
    raw_user_id = request.data.get("user_id")
    if not access_code or raw_user_id is None:
        return None, "A company code and a member are required."
    company = Company.objects.filter(access_code__iexact=access_code).first()
    if not company:
        return None, "No registered company uses that access code."
    try:
        target = User.objects.get(pk=int(raw_user_id), is_active=True)
    except (User.DoesNotExist, TypeError, ValueError):
        return None, "That registered member could not be found."
    if target.company_id != company.id:
        return None, "That member does not belong to the selected company."
    if not target.company_id or target.role == "public":
        return None, "Only registered enterprise members can receive documents."
    return target, None


# ------------------------------------------------------------------ helpers
def _email_user(user, subject, body):
    """Send a transactional email; console backend in dev, never raises."""
    from django.core.mail import send_mail
    try:
        send_mail(subject=subject, message=body,
                  from_email=settings.DEFAULT_FROM_EMAIL, recipient_list=[user.email],
                  fail_silently=True)
        return True
    except Exception:
        return False


def _frontend_url(path=""):
    base = (settings.PUBLIC_BASE_URL or "http://localhost:3000").rstrip("/")
    return f"{base}/{path.lstrip('/')}" if path else base


def _require_email_verification(user):
    """True when the platform is set to gate login on verified email."""
    return settings.REQUIRE_EMAIL_VERIFICATION and not user.email_verified


# -------------------------------------------------------------------- auth
@api_view(["POST"])
@permission_classes([AllowAny])
@rate_limit("register", rate=5, per_seconds=600, key="ip")
def register_company(request):
    """Create a new company and its first admin. Sets auth cookies."""
    s = RegisterCompanySerializer(data=request.data)
    s.is_valid(raise_exception=True)
    d = s.validated_data
    if User.objects.filter(email__iexact=d["email"]).exists():
        return Response({"detail": "Email already registered."}, status=400)

    base = slugify(d["company_name"]) or "company"
    slug, n = base, 1
    while Company.objects.filter(slug=slug).exists():
        n += 1
        slug = f"{base}-{n}"

    from django.db import transaction
    with transaction.atomic():
        company = Company.objects.create(
            name=d["company_name"], slug=slug,
            website=d.get("website", ""), contact_email=d.get("contact_email", ""),
            phone=d.get("phone", ""), max_employees=d.get("max_employees"),
            plan=Plan.default(),
        )
        user = User.objects.create_user(
            email=d["email"], password=d["password"],
            full_name=d.get("admin_name", ""), title=d.get("admin_title", ""),
            role="admin", company=company,
        )
        AuditLog.objects.create(company=company, user=user, action="register",
                                detail=f"company {company.name}", ip=client_ip(request))

    # Email verification (no-op link when email delivery is console-backed).
    tok, raw = OneTimeToken.issue(user, "verify_email", minutes=60 * 24)
    _email_user(
        user, "Verify your OpenVault email",
        f"Welcome to OpenVault.\n\nVerify your email within 24 hours:\n"
        f"{_frontend_url('/auth/verify?token=' + raw)}\n\n"
        f"If you did not create this account you can ignore this email.",
    )
    audit(_as(request, user), "verification_email_sent")

    resp = Response({"user": UserSerializer(user).data}, status=201)
    return set_auth_cookies(resp, user)


@api_view(["POST"])
@permission_classes([AllowAny])
@rate_limit("login", rate=8, per_seconds=60, key="ip_email")
def login(request):
    """Enterprise sign-in with email + password. Sets HttpOnly auth cookies.

    Platform-level accounts (root admins) get a mandatory second step: the
    password alone never sets cookies, it returns an `mfa_required` challenge
    that must be completed via /api/auth/mfa/verify (or activated first via
    /api/auth/mfa/activate on first enrollment).
    """
    s = LoginSerializer(data=request.data)
    s.is_valid(raise_exception=True)
    user = authenticate(username=s.validated_data["email"], password=s.validated_data["password"])
    if user is None:
        return Response({"detail": "Invalid email or password."}, status=401)
    if _require_email_verification(user):
        return Response({"detail": "Please verify your email before signing in. "
                                   "Check your inbox for the verification link.",
                         "code": "email_unverified"}, status=403)
    if _is_platform_level(user):
        from . import mfa
        if not user.mfa_enabled:
            secret = mfa.generate_secret()
            return Response({
                "mfa_required": True,
                "enrollment": {
                    "secret": secret,
                    "uri": mfa.provisioning_uri(secret, user.email),
                },
                "challenge": mfa.issue_challenge(user.pk, "enroll", secret=secret),
            })
        return Response({"mfa_required": True,
                         "challenge": mfa.issue_challenge(user.pk, "login")})
    audit(_as(request, user), "login")
    resp = Response({"user": UserSerializer(user).data})
    return set_auth_cookies(resp, user)


@api_view(["POST"])
@permission_classes([AllowAny])
@rate_limit("mfa", rate=10, per_seconds=60, key="ip")
def mfa_activate(request):
    """Finish first-time TOTP enrollment: challenge (from login) + 6-digit code.

    Saving the secret only happens after the authenticator app proves it can
    produce valid codes, so a typo during setup cannot lock the admin out.
    """
    from . import mfa
    payload = mfa.read_challenge(str((request.data or {}).get("challenge") or ""), "enroll")
    code = str((request.data or {}).get("code") or "")
    if not payload:
        return Response({"detail": "This verification session expired. Sign in again."}, status=400)
    try:
        user = User.objects.get(pk=payload.get("u"), is_active=True)
    except User.DoesNotExist:
        return Response({"detail": "This verification session expired. Sign in again."}, status=400)
    if not mfa.verify_code(payload.get("s") or "", code):
        return Response({"detail": "That code did not match. Check your authenticator app."}, status=400)
    user.mfa_secret = payload["s"]
    user.mfa_enabled = True
    user.save(update_fields=["mfa_secret", "mfa_enabled"])
    audit(_as(request, user), "mfa_enrolled")
    resp = Response({"user": UserSerializer(user, context={"request": request}).data})
    return set_auth_cookies(resp, user)


@api_view(["POST"])
@permission_classes([AllowAny])
@rate_limit("mfa", rate=10, per_seconds=60, key="ip")
def mfa_verify(request):
    """Complete a platform-admin login: login challenge + TOTP code -> cookies."""
    from . import mfa
    payload = mfa.read_challenge(str((request.data or {}).get("challenge") or ""), "login")
    code = str((request.data or {}).get("code") or "")
    if not payload:
        return Response({"detail": "This verification session expired. Sign in again."}, status=400)
    try:
        user = User.objects.get(pk=payload.get("u"), is_active=True)
    except User.DoesNotExist:
        return Response({"detail": "This verification session expired. Sign in again."}, status=400)
    if not (user.mfa_enabled and mfa.verify_code(user.mfa_secret, code)):
        return Response({"detail": "That code did not match. Check your authenticator app."}, status=400)
    audit(_as(request, user), "login")
    resp = Response({"user": UserSerializer(user, context={"request": request}).data})
    return set_auth_cookies(resp, user)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def mfa_setup(request):
    """Rotate the TOTP secret for a platform admin (re-enrollment flow)."""
    if not _is_platform_level(request.user):
        return Response({"detail": "Only platform admins can manage two-factor auth."}, status=403)
    from . import mfa
    secret = mfa.generate_secret()
    return Response({
        "secret": secret,
        "uri": mfa.provisioning_uri(secret, request.user.email),
        "challenge": mfa.issue_challenge(request.user.pk, "enroll", secret=secret),
    })


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def logout(request):
    """Clear the auth cookies and revoke the refresh token server-side."""
    raw = request.COOKIES.get(REFRESH_COOKIE)
    if raw:
        from rest_framework_simplejwt.tokens import RefreshToken
        from rest_framework_simplejwt.exceptions import TokenError
        try:
            RefreshToken(raw).blacklist()
        except (TokenError, AttributeError):
            pass
    resp = Response({"ok": True})
    return clear_auth_cookies(resp)


@api_view(["POST"])
@permission_classes([AllowAny])
@rate_limit("refresh", rate=30, per_seconds=60, key="ip")
def refresh(request):
    """Rotate the refresh cookie and issue a fresh access cookie.

    The presented refresh token is blacklisted after a successful rotation, so
    replaying an old token fails. This is what makes "rotating refresh tokens"
    an actual security control rather than a new token with the old one still
    valid.
    """
    from rest_framework_simplejwt.tokens import RefreshToken
    from rest_framework_simplejwt.exceptions import TokenError
    raw = request.COOKIES.get(REFRESH_COOKIE)
    if not raw:
        return Response({"detail": "No refresh token."}, status=401)
    try:
        token = RefreshToken(raw)
        token.check_blacklist()
        user = User.objects.get(id=token["user_id"], is_active=True)
    except (TokenError, User.DoesNotExist, KeyError):
        resp = Response({"detail": "Session expired. Sign in again."}, status=401)
        return clear_auth_cookies(resp)
    resp = Response({"ok": True, "user": UserSerializer(user).data})
    set_auth_cookies(resp, user)
    # New cookies exist; retire the old refresh token.
    try:
        token.blacklist()
    except AttributeError:
        pass
    return resp


def _as(request, user):
    """Attach an authenticated user to a raw request so audit() can log it."""
    request.user = user
    return request


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def me(request):
    """Return the signed-in user's own profile (used to hydrate the frontend)."""
    return Response(UserSerializer(request.user, context={"request": request}).data)


@api_view(["PATCH"])
@permission_classes([IsAuthenticated])
def update_me(request):
    """Let a user edit their own profile: name, title, reply language, password."""
    user = request.user
    data = request.data
    for field in ("full_name", "title"):
        if field in data:
            setattr(user, field, str(data.get(field) or "").strip()[:200])
    if "language" in data:
        lang = str(data.get("language") or "en").strip().lower()
        if lang not in ("en", "ur"):
            return Response({"detail": "language must be 'en' or 'ur'."}, status=400)
        user.language = lang
    new_password = data.get("new_password")
    if new_password:
        current = data.get("current_password") or ""
        if not user.check_password(current):
            return Response({"detail": "Current password is incorrect."}, status=400)
        err = _password_error(new_password, user)
        if err:
            return Response({"detail": err}, status=400)
        user.set_password(new_password)
    user.save()
    if new_password:
        revoke_user_refresh_tokens(user)
    audit(request, "profile_update", "self")
    return Response(UserSerializer(user, context={"request": request}).data)


@api_view(["POST"])
@permission_classes([AllowAny])
@rate_limit("verify_request", rate=5, per_seconds=600, key="ip_email")
def request_verification(request):
    """(Re)send the email-verification link for an account."""
    email = str((request.data or {}).get("email") or "").strip().lower()
    user = User.objects.filter(email__iexact=email, is_active=True).first()
    if user and not user.email_verified:
        tok, raw = OneTimeToken.issue(user, "verify_email", minutes=60 * 24)
        _email_user(user, "Verify your OpenVault email",
                    f"Verify your email within 24 hours:\n"
                    f"{_frontend_url('/auth/verify?token=' + raw)}")
    # Same response either way: never reveal whether an email exists.
    return Response({"detail": "If that account exists, a verification link has been sent."})


@api_view(["POST"])
@permission_classes([AllowAny])
@rate_limit("verify_confirm", rate=10, per_seconds=600, key="ip")
def verify_email(request):
    """Consume a verification token and mark the account verified."""
    raw = str((request.data or {}).get("token") or "")
    tok = OneTimeToken.consume(raw, "verify_email")
    if not tok:
        return Response({"detail": "This verification link is invalid or has expired."}, status=400)
    tok.user.email_verified = True
    tok.user.save(update_fields=["email_verified"])
    return Response({"detail": "Email verified. You can sign in now."})


@api_view(["POST"])
@permission_classes([AllowAny])
@rate_limit("forgot", rate=5, per_seconds=600, key="ip_email")
def forgot_password(request):
    """Email a one-time password-reset link (never reveals account existence)."""
    email = str((request.data or {}).get("email") or "").strip().lower()
    user = User.objects.filter(email__iexact=email, is_active=True).first()
    if user:
        tok, raw = OneTimeToken.issue(user, "password_reset", minutes=30)
        _email_user(
            user, "Reset your OpenVault password",
            f"Reset your password within 30 minutes:\n"
            f"{_frontend_url('/auth/reset?token=' + raw)}\n\n"
            f"If you did not request this, ignore this email — your password is unchanged.",
        )
    return Response({"detail": "If that account exists, a reset link has been sent."})


@api_view(["POST"])
@permission_classes([AllowAny])
@rate_limit("reset_confirm", rate=10, per_seconds=600, key="ip")
def reset_password(request):
    """Consume a reset token and set a new password."""
    raw = str((request.data or {}).get("token") or "")
    password = str((request.data or {}).get("password") or "")
    tok = OneTimeToken.consume(raw, "password_reset")
    if not tok:
        return Response({"detail": "This reset link is invalid or has expired."}, status=400)
    err = _password_error(password, tok.user)
    if err:
        return Response({"detail": err}, status=400)
    tok.user.set_password(password)
    tok.user.email_verified = True  # a working reset link proves mailbox ownership
    tok.user.save(update_fields=["password", "email_verified"])
    revoke_user_refresh_tokens(tok.user)
    return Response({"detail": "Password updated. You can sign in now."})


# --------------------------------------------------------------- documents
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def documents(request):
    """List documents readable by this member. Paginated with ?page=&page_size="""
    # select_related matches DocumentSerializer's FK traversal (company name,
    # department name) so a 200-row page costs 1 query, not 400.
    qs = (visible_documents(request.user)
          .select_related("company", "department")
          .order_by("-created_at"))
    page_data = _paginate(request, qs)
    return Response({
        "results": DocumentSerializer(page_data["qs"], many=True).data,
        "count": page_data["count"],
        "page": page_data["page"],
        "pages": page_data["pages"],
    })


def _paginate(request, qs, default_page_size=50, max_page_size=200):
    """Minimal pagination helper shared by list endpoints."""
    try:
        page = max(1, int(request.query_params.get("page", 1)))
        page_size = min(max_page_size, max(1, int(request.query_params.get("page_size", default_page_size))))
    except (TypeError, ValueError):
        page, page_size = 1, default_page_size
    count = qs.count()
    pages = max(1, -(-count // page_size))
    return {"qs": qs[(page - 1) * page_size: page * page_size],
            "count": count, "page": page, "pages": pages}


def _plan_for(company):
    """The company's plan, guaranteed non-null for limit checks."""
    return company.plan or Plan.default()


@api_view(["POST"])
@permission_classes([IsEditor])
def upload_document(request):
    """Upload + index a file. Indexing runs in a background thread so the
    request returns immediately with indexing_status='pending'."""
    f = request.FILES.get("file")
    if not f:
        return Response({"detail": "No file provided."}, status=400)
    max_size = getattr(settings, "DATA_UPLOAD_MAX_MEMORY_SIZE", 50 * 1024 * 1024)
    if f.size > max_size:
        return Response({"detail": f"File too large. Max size is {max_size // (1024*1024)} MB."},
                        status=413)
    rejected = _upload_rejection(f)
    if rejected:
        return rejected

    is_okf = str(request.data.get("is_okf", "")).lower() in ("1", "true", "yes", "on")
    access_scope = (request.data.get("access_scope") or "company").strip().lower()
    if access_scope not in {"company", "restricted", "department"}:
        return Response({"detail": "access_scope must be company, department or restricted."},
                        status=400)
    category = request.data.get("category") or "Other"
    description = request.data.get("description") or ""
    tags = str(request.data.get("tags") or "").strip()[:300]

    company = request.user.company
    if company is None:
        return Response(
            {"detail": "Your account is not attached to a company. Platform admins must pick an "
                       "active company (use the company switcher in the sidebar) before uploading."},
            status=400,
        )

    # Plan limits: document count and storage quota (server-enforced).
    plan = _plan_for(company)
    if plan:
        if plan.max_documents is not None and company.documents.count() >= plan.max_documents:
            return Response({"detail": f"Plan limit reached ({plan.max_documents} documents). "
                                       "Upgrade your plan to upload more."}, status=402)
        if plan.storage_mb is not None:
            used = company.documents.aggregate(total=Sum("size"))["total"] or 0
            if used + f.size > plan.storage_mb * 1024 * 1024:
                return Response({"detail": "Storage quota for your plan is full. "
                                           "Upgrade to upload more."}, status=402)

    # Department scope needs a department (default: the uploader's own).
    department = None
    if access_scope == "department":
        dept_id = request.data.get("department_id")
        if dept_id:
            department = Department.objects.filter(pk=dept_id, company=company).first()
        if department is None and request.user.department_id:
            department = request.user.department
        if department is None:
            return Response({"detail": "Pick a department (or join one) to use department scope."},
                            status=400)
        if not (plan and plan.allow_departments):
            return Response({"detail": "Department scoping is not part of your current plan."},
                            status=402)

    rel_key = os.path.join(company.slug, f"{uuid.uuid4().hex}_{f.name}")
    stored = storage.save_uploaded_file(rel_key, f, base_dir=settings.DATA_DIR)

    from django.db import transaction
    with transaction.atomic():
        doc = Document.objects.create(
            company=company, filename=f.name, stored_path=stored,
            content_type=f.content_type or "", size=f.size,
            category=category, description=description, tags=tags,
            is_okf=is_okf, access_scope=access_scope, department=department,
            uploaded_by=request.user, indexing_status="pending",
        )
        DocumentAccess.objects.create(document=doc, user=request.user)
        audit(request, "upload", f"{f.name}")

    _index_in_background(doc)
    return Response(DocumentSerializer(doc).data, status=201)


@api_view(["POST"])
@permission_classes([IsEditor])
def upload_presign(request):
    """Return a presigned S3 PUT URL so the browser can upload large files (>4.5 MB)
    directly to S3 without hitting Vercel's serverless request body limit."""
    if not storage.is_s3_enabled():
        return Response({"detail": "Direct S3 upload is not enabled on this server."}, status=400)
    filename = os.path.basename(str(request.data.get("filename") or "").strip())
    if not filename:
        return Response({"detail": "filename is required."}, status=400)
    size = int(request.data.get("size") or 0)
    max_size = getattr(settings, "DATA_UPLOAD_MAX_MEMORY_SIZE", 50 * 1024 * 1024)
    if size > max_size:
        return Response({"detail": f"File too large. Max size is {max_size // (1024*1024)} MB."}, status=413)
    company = request.user.company
    if company is None:
        return Response({"detail": "Your account is not attached to a company."}, status=400)
    content_type = str(request.data.get("content_type") or "application/octet-stream")
    key = f"{company.slug}/{uuid.uuid4().hex}_{filename}"
    url = storage.generate_presigned_put(key, content_type=content_type, size=size)
    return Response({"upload_url": url, "key": key, "filename": filename})


@api_view(["POST"])
@permission_classes([IsEditor])
def upload_confirm(request):
    """Confirm a direct-to-S3 upload, create the Document row, and trigger indexing."""
    if not storage.is_s3_enabled():
        return Response({"detail": "Direct S3 upload is not enabled on this server."}, status=400)
    key = str(request.data.get("key") or "").strip().lstrip("/")
    filename = os.path.basename(str(request.data.get("filename") or "").strip())
    company = request.user.company
    if company is None or not key.startswith(f"{company.slug}/"):
        return Response({"detail": "Invalid storage key for your company."}, status=400)
    try:
        validate_filename(filename)
        validate_extension(filename)
    except UploadRejected as exc:
        return Response({"detail": str(exc)}, status=400)
    real_size = storage.object_size(key)
    if real_size is None:
        return Response({"detail": "Uploaded object not found in storage."}, status=404)
    max_size = getattr(settings, "DATA_UPLOAD_MAX_MEMORY_SIZE", 50 * 1024 * 1024)
    if real_size <= 0 or real_size > max_size:
        return Response({"detail": "Uploaded object is empty or exceeds the size limit."}, status=400)

    # The stored object is the source of truth; the browser's claimed size is
    # ignored for quotas so a client cannot dodge storage limits by under-
    # reporting. (S3 also enforces the signed ContentLength at PUT time.)
    size = real_size

    # Plan limits apply on the direct-to-S3 path exactly like normal uploads.
    plan = _plan_for(company)
    if plan:
        if plan.max_documents is not None and company.documents.count() >= plan.max_documents:
            return Response({"detail": f"Plan limit reached ({plan.max_documents} documents). "
                                       "Upgrade your plan to upload more."}, status=402)
        if plan.storage_mb is not None:
            used = company.documents.aggregate(total=Sum("size"))["total"] or 0
            if used + size > plan.storage_mb * 1024 * 1024:
                return Response({"detail": "Storage quota for your plan is full. "
                                           "Upgrade to upload more."}, status=402)

    content_type = str(request.data.get("content_type") or "")
    is_okf = str(request.data.get("is_okf", "")).lower() in ("1", "true", "yes", "on")
    access_scope = (request.data.get("access_scope") or "company").strip().lower()
    if access_scope not in {"company", "restricted", "department"}:
        return Response({"detail": "access_scope must be company, department or restricted."}, status=400)
    category = request.data.get("category") or "Other"
    description = request.data.get("description") or ""
    tags = str(request.data.get("tags") or "").strip()[:300]

    plan = _plan_for(company)
    department = None
    if access_scope == "department":
        dept_id = request.data.get("department_id")
        if dept_id:
            department = Department.objects.filter(pk=dept_id, company=company).first()
        if department is None and request.user.department_id:
            department = request.user.department
        if department is None:
            return Response({"detail": "Pick a department (or join one) to use department scope."}, status=400)
        if not (plan and plan.allow_departments):
            return Response({"detail": "Department scoping is not part of your current plan."}, status=402)

    from django.db import transaction
    with transaction.atomic():
        doc = Document.objects.create(
            company=company, filename=filename, stored_path=key,
            content_type=content_type, size=size,
            category=category, description=description, tags=tags,
            is_okf=is_okf, access_scope=access_scope, department=department,
            uploaded_by=request.user, indexing_status="pending",
        )
        DocumentAccess.objects.create(document=doc, user=request.user)
        audit(request, "upload", filename)

    _index_in_background(doc)
    return Response(DocumentSerializer(doc).data, status=201)


def _index_in_background(doc: Document):
    """Extract/chunk/embed a document. On serverless platforms (SYNC_INDEXING=True)
    this runs inline before returning; otherwise it runs on a daemon thread."""
    def run():
        from django.db import close_old_connections
        close_old_connections()
        try:
            raw = storage.read_bytes(doc.stored_path, base_dir=settings.DATA_DIR)
            n = rag.index_document(doc, raw)
            doc.indexing_status = "ready" if n >= 0 else "failed"
            doc.index_error = ""
        except Exception as exc:
            doc.indexing_status = "failed"
            doc.index_error = str(exc)[:300]
        finally:
            doc.save(update_fields=["indexing_status", "index_error"])
            if not getattr(settings, "SYNC_INDEXING", False):
                close_old_connections()

    if getattr(settings, "SYNC_INDEXING", False):
        run()
        return

    try:
        threading.Thread(target=run, daemon=True).start()
    except Exception:
        # Thread creation failed (rare): index inline so the doc is searchable.
        raw = storage.read_bytes(doc.stored_path, base_dir=settings.DATA_DIR)
        rag.index_document(doc, raw)
        doc.indexing_status = "ready"
        doc.save(update_fields=["indexing_status"])


@api_view(["POST"])
@permission_classes([IsEditor])
def document_reindex(request, pk):
    """Retry indexing for a failed/pending document."""
    doc = _get_doc(request, pk)
    if doc.indexing_status != "failed":
        return Response({"detail": "Only failed documents can be re-indexed."}, status=400)
    doc.indexing_status = "pending"
    doc.save(update_fields=["indexing_status"])
    _index_in_background(doc)
    audit(request, "reindex", doc.filename)
    return Response(DocumentSerializer(doc).data)


@api_view(["GET", "PATCH", "DELETE"])
@permission_classes([IsAuthenticated])
def document_detail(request, pk):
    """Read metadata, edit (category/description/tags/scope), or delete a doc."""
    doc = _accessible_doc(request, pk)
    if request.method == "GET":
        return Response(DocumentSerializer(doc).data)
    if request.method == "DELETE":
        if not _is_editor_request(request):
            return Response({"detail": "Viewers cannot delete documents."}, status=403)
        if not _can_manage_document(request, doc):
            return Response({"detail": "Only admins or the uploader can delete a document."},
                            status=403)
        if doc.stored_path:
            storage.delete(doc.stored_path, base_dir=settings.DATA_DIR)
        name = doc.filename
        doc.delete()
        audit(request, "delete", name)
        return Response(status=204)
    # PATCH
    if not _is_editor_request(request):
        return Response({"detail": "Viewers cannot edit documents."}, status=403)
    data = request.data
    if "access_scope" in data and not _can_manage_document(request, doc):
        return Response({"detail": "Only admins or the uploader can change who can access "
                                   "this document."}, status=403)
    if "category" in data:
        doc.category = str(data.get("category") or "Other")[:50]
    if "description" in data:
        doc.description = str(data.get("description") or "")[:2000]
    if "tags" in data:
        doc.tags = str(data.get("tags") or "").strip()[:300]
    if "access_scope" in data:
        scope = str(data.get("access_scope") or "company").lower()
        if scope not in {"company", "restricted", "department"}:
            return Response({"detail": "access_scope must be company, department or restricted."},
                            status=400)
        doc.access_scope = scope
        if scope == "department":
            dept_id = data.get("department_id")
            dept = Department.objects.filter(pk=dept_id, company=doc.company).first() if dept_id else None
            if dept is None:
                return Response({"detail": "Pick a valid department for department scope."},
                                status=400)
            doc.department = dept
    doc.save()
    audit(request, "document_update", f"{doc.filename}")
    return Response(DocumentSerializer(doc).data)


def _is_editor_request(request):
    u = request.user
    return bool(u.role in ("admin", "employee") or _is_platform_level(u))


def _can_manage_document(request, doc):
    """True for platform level, company admins, and the document's uploader.

    Changing WHO can read a document (access scope) or destroying it are
    privilege decisions, not content edits: any editor can fix a typo, but
    widening a restricted document's audience or deleting it requires this
    stronger check.
    """
    u = request.user
    return bool(_is_platform_level(u) or u.role == "admin" or doc.uploaded_by_id == u.id)


@api_view(["POST"])
@permission_classes([IsEditor])
def document_new_version(request, pk):
    """Upload a new version of a document: the old file is archived to
    DocumentVersion, the new file is indexed, and `version` increments.
    Plan-gated (allow_versions)."""
    doc = _get_doc(request, pk)
    company = doc.company
    if not (_plan_for(company) and _plan_for(company).allow_versions):
        return Response({"detail": "Version history is not part of your current plan."}, status=402)
    f = request.FILES.get("file")
    if not f:
        return Response({"detail": "No file provided."}, status=400)
    max_size = getattr(settings, "DATA_UPLOAD_MAX_MEMORY_SIZE", 50 * 1024 * 1024)
    if f.size > max_size:
        return Response({"detail": f"File too large. Max size is {max_size // (1024*1024)} MB."},
                        status=413)
    rejected = _upload_rejection(f)
    if rejected:
        return rejected

    # Archive the current file as the previous version.
    old_path, old_size = doc.stored_path, doc.size
    DocumentVersion.objects.create(
        document=doc, version_number=doc.version, stored_path=old_path,
        filename=doc.filename, size=old_size, uploaded_by=request.user,
    )
    rel_key = os.path.join(company.slug, f"{uuid.uuid4().hex}_{f.name}")
    stored = storage.save_uploaded_file(rel_key, f, base_dir=settings.DATA_DIR)
    doc.stored_path = stored
    doc.filename = f.name
    doc.content_type = f.content_type or ""
    doc.size = f.size
    doc.version += 1
    doc.indexing_status = "pending"
    doc.save()
    _index_in_background(doc)
    audit(request, "new_version", f"{doc.filename} -> v{doc.version}")
    return Response(DocumentSerializer(doc).data, status=201)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def document_versions(request, pk):
    """Version history for a document (plan-gated at upload time; viewable always)."""
    doc = _accessible_doc(request, pk)
    versions = doc.versions.all()
    return Response(DocumentVersionSerializer(versions, many=True).data)


def _get_doc(request, pk):
    """Owner-company only, or platform admin."""
    try:
        if _is_platform_level(request.user):
            return Document.objects.get(pk=pk)
        return Document.objects.get(pk=pk, company=request.user.company)
    except Document.DoesNotExist:
        raise Http404


def _accessible_doc(request, pk):
    """Resolve a document only when its ACL grants this exact user access."""
    try:
        doc = Document.objects.get(pk=pk)
    except Document.DoesNotExist:
        raise Http404
    u = request.user
    if _is_platform_level(u):
        return doc
    if getattr(u, "company_id", None) and doc.company_id == u.company_id:
        if doc.access_scope in ("company",):
            return doc
        if doc.access_scope == "department" and doc.department_id and doc.department_id == u.department_id:
            return doc
        if DocumentAccess.objects.filter(document=doc, user=u).exists():
            return doc
    if DocumentShare.objects.filter(document=doc, shared_with_user=u).exists():
        return doc
    if DocumentAccess.objects.filter(document=doc, user=u).exists():
        return doc
    raise Http404


def _can_download(request, doc):
    """Enforce download permission server-side, not just in the UI."""
    u = request.user
    if _is_platform_level(u):
        return True
    if doc.company_id == getattr(u, "company_id", None):
        if doc.access_scope in ("company", "department"):
            return True
        grant = DocumentAccess.objects.filter(document=doc, user=u).first()
        return bool(grant and grant.can_download)
    share = DocumentShare.objects.filter(document=doc, shared_with_user=u).first()
    if share:
        return share.can_download
    grant = DocumentAccess.objects.filter(document=doc, user=u).first()
    return bool(grant and grant.can_download)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def download_document(request, pk):
    doc = _accessible_doc(request, pk)
    if not _can_download(request, doc):
        return Response({"detail": "Download is disabled for this document."}, status=403)
    if not doc.stored_path or not storage.exists(doc.stored_path, base_dir=settings.DATA_DIR):
        raise Http404
    doc.downloads += 1
    doc.save(update_fields=["downloads"])
    audit(request, "download", doc.filename)
    return FileResponse(
        storage.open_stream(doc.stored_path, base_dir=settings.DATA_DIR),
        as_attachment=True,
        filename=doc.filename,
    )


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def document_preview(request, pk):
    """Return extracted plain text for in-browser preview (ACL-checked)."""
    doc = _accessible_doc(request, pk)
    if not doc.stored_path or not storage.exists(doc.stored_path, base_dir=settings.DATA_DIR):
        raise Http404
    from django.utils.text import slugify  # noqa: F401
    try:
        raw = storage.read_bytes(doc.stored_path, base_dir=settings.DATA_DIR)
        text = rag.extract_text(raw, doc.filename, doc.content_type)
    except OSError:
        raise Http404
    audit(request, "preview", doc.filename)
    return Response({
        "id": doc.id, "filename": doc.filename, "content_type": doc.content_type,
        "size": doc.size, "num_chunks": doc.num_chunks, "text": text[:200000],
        "truncated": len(text) > 200000, "version": doc.version,
    })


# ------------------------------------------------------------------- chat
@api_view(["POST"])
@permission_classes([IsAuthenticated])
@rate_limit("ask", rate=20, per_seconds=60, key="user")
def ask(request):
    """Stream an answer as NDJSON, grounded only in documents this user may see.
    Persists the conversation when conversation_id is supplied (or creates one).

    Feature 4: every incoming question is first run through the policy scanner.
    A match is recorded as a POLICY_VIOLATION_DETECTED audit row and surfaced to
    the user as a `flag` event, but it never blocks the conversation."""
    s = AskSerializer(data=request.data)
    s.is_valid(raise_exception=True)
    question = s.validated_data["question"]
    mode = s.validated_data.get("mode")
    provider = s.validated_data.get("provider")
    conversation_id = s.validated_data.get("conversation_id")

    # Provider selection is a bring-your-own-key feature: without the company's
    # own stored key a caller could steer shared platform spend at a costlier
    # provider, so the field is rejected outright for everyone else.
    if provider:
        own_cfg = LLMConfig.for_company(request.user.company) if request.user.company_id else None
        if not (own_cfg and (own_cfg.api_key or "").strip()):
            return Response(
                {"detail": "Choosing an AI provider requires your company's own AI key "
                           "(Workspace settings → AI)."},
                status=400,
            )

    # Plan quota: monthly ask limit counted over AskLog rows.
    plan = _plan_for(request.user.company) if request.user.company_id else None
    if plan and plan.monthly_ask_limit is not None:
        month_start = timezone.localtime().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        used = AskLog.objects.filter(company=request.user.company,
                                     created_at__gte=month_start).count()
        if used >= plan.monthly_ask_limit:
            return Response({"detail": f"Monthly question limit reached ({plan.monthly_ask_limit}). "
                                       "Upgrade your plan for more."}, status=402)

    # Truncate what the audit trail keeps: signal without storing full PII text.
    audit(request, "ask", f"[{mode or 'default'}] {question[:120]}")

    conversation = None
    if request.user.company_id:
        if conversation_id:
            conversation = ChatConversation.objects.filter(
                pk=conversation_id, user=request.user, company=request.user.company
            ).first()
            if conversation is None:
                return Response({"detail": "Conversation not found."}, status=404)
        else:
            conversation = ChatConversation.objects.create(
                company=request.user.company, user=request.user,
                title=question.strip()[:120],
            )
    conv_payload = ({"type": "conversation", "conversation_id": conversation.id}
                    if conversation else None)

    def stream():
        if conv_payload:
            yield json.dumps(conv_payload) + "\n"
        yield from rag.stream_answer(
            request.user, question, mode=mode, provider_override=provider,
            moderation_flags=None, conversation=conversation,
        )

    scan = moderation.scan(question)
    moderation_flags = None
    if scan.flagged:
        moderation_flags = scan.labels
        audit(request, "POLICY_VIOLATION_DETECTED",
              f"{scan.summary()} :: {question[:120]}")

    resp = StreamingHttpResponse(stream(), content_type="application/x-ndjson")
    resp["Cache-Control"] = "no-cache"
    resp["X-Accel-Buffering"] = "no"
    return resp


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def conversations(request):
    """List the caller's chat threads, or start an empty one."""
    if not request.user.company_id:
        return Response([])
    if request.method == "GET":
        qs = (ChatConversation.objects.filter(user=request.user, company=request.user.company)
              .annotate(_message_count=Count("messages")))
        page = _paginate(request, qs, default_page_size=30)
        return Response({
            "results": ChatConversationSerializer(page["qs"], many=True).data,
            "count": page["count"], "page": page["page"], "pages": page["pages"],
        })
    conv = ChatConversation.objects.create(
        company=request.user.company, user=request.user,
        title=str((request.data or {}).get("title") or "New chat")[:120],
    )
    return Response(ChatConversationSerializer(conv).data, status=201)


@api_view(["GET", "DELETE", "PATCH"])
@permission_classes([IsAuthenticated])
def conversation_detail(request, pk):
    """One thread with its messages (own threads only), or delete/rename it."""
    try:
        conv = ChatConversation.objects.get(pk=pk, user=request.user)
    except ChatConversation.DoesNotExist:
        raise Http404
    if request.method == "DELETE":
        conv.delete()
        return Response(status=204)
    if request.method == "PATCH":
        conv.title = str((request.data or {}).get("title") or conv.title)[:120]
        conv.save(update_fields=["title"])
        return Response(ChatConversationSerializer(conv).data)
    return Response({
        "conversation": ChatConversationSerializer(conv).data,
        "messages": ChatMessageSerializer(conv.messages.all(), many=True).data,
    })


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def message_rate(request, pk):
    """Thumbs up (1) / down (-1) on an assistant message (own messages only)."""
    try:
        msg = ChatMessage.objects.get(pk=pk, conversation__user=request.user, role="assistant")
    except ChatMessage.DoesNotExist:
        raise Http404
    rating = (request.data or {}).get("rating")
    if rating not in (1, -1, "1", "-1"):
        return Response({"detail": "rating must be 1 or -1."}, status=400)
    msg.rating = int(rating)
    msg.save(update_fields=["rating"])
    return Response({"ok": True, "rating": msg.rating})


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def llm_status(request):
    """Lightweight status probe for the chat model (drives the UI status dot)."""
    from .models import LLMConfig as _LLMConfig
    company = getattr(request.user, "company", None)
    prov = providers.get_chat_provider(company=company)
    local_prov = providers.get_chat_provider(mode="local")
    online_prov = providers.get_chat_provider(mode="online", company=company)
    return Response({
        "online": prov.available(),
        "provider": prov.label,
        "model": prov.chat_model,
        "company_override": _LLMConfig.for_company(company) is not None if company else False,
        "key_source": providers._resolve(company)["key_source"],
        "local": {
            "online": local_prov.available(),
            "provider": local_prov.label,
            "model": local_prov.chat_model,
        },
        "online_api": {
            "online": online_prov.available(),
            "provider": online_prov.label,
            "model": online_prov.chat_model,
            "has_key": bool(online_prov.api_key),
        },
    })


# -------------------------------------------------------- admin (company)
@api_view(["GET", "POST"])
@permission_classes([IsAdmin])
def users(request):
    """List or create users within the admin's own company only."""
    company = request.user.company
    if company is None:
        return Response({"detail": "No company context."}, status=400)
    if request.method == "GET":
        qs = User.objects.filter(company=company).order_by("email")
        return Response(UserSerializer(qs, many=True, context={"request": request}).data)

    s = UserCreateSerializer(data=request.data)
    s.is_valid(raise_exception=True)
    d = s.validated_data
    if User.objects.filter(email__iexact=d["email"]).exists():
        return Response({"detail": "Email already registered."}, status=400)

    # Seat limit: the stricter of the company's own cap and the plan's.
    plan = _plan_for(company)
    seat_caps = [c for c in (company.max_employees, plan.max_members if plan else None) if c]
    if seat_caps and company.users.count() >= min(seat_caps):
        cap = min(seat_caps)
        return Response(
            {"detail": f"Seat limit reached ({cap}). "
                       "Increase it in company settings or upgrade your plan."},
            status=400,
        )

    department = None
    if d.get("department_id"):
        department = Department.objects.filter(pk=d["department_id"], company=company).first()
        if department is None:
            return Response({"detail": "Department not found in this company."}, status=400)

    user = User.objects.create_user(
        email=d["email"], password=d["password"],
        full_name=d.get("full_name", ""), title=d.get("title", ""),
        role=d["role"], company=company, department=department,
    )
    # New members verify on first sign-in flow; send them a welcome+verify mail.
    tok, raw = OneTimeToken.issue(user, "verify_email", minutes=60 * 24 * 3)
    _email_user(user, "Welcome to OpenVault",
                f"Your workspace account is ready.\n\nVerify your email:\n"
                f"{_frontend_url('/auth/verify?token=' + raw)}\n\n"
                f"Then sign in with the email address your administrator provided.")
    audit(request, "add_user", f"{user.email} ({user.role})")
    return Response(UserSerializer(user, context={"request": request}).data, status=201)


@api_view(["PATCH", "DELETE"])
@permission_classes([IsAdmin])
def user_detail(request, pk):
    """Edit (role/department/name/title/password) or remove a company member."""
    if pk == request.user.id and request.method == "DELETE":
        return Response({"detail": "You can't remove yourself."}, status=400)
    try:
        user = User.objects.get(pk=pk, company=request.user.company)
    except User.DoesNotExist:
        raise Http404
    if request.method == "DELETE":
        email = user.email
        user.delete()
        audit(request, "remove_user", email)
        return Response(status=204)
    data = request.data
    if "role" in data:
        role = data.get("role")
        if role not in ("admin", "employee", "viewer"):
            return Response({"detail": "Invalid role."}, status=400)
        if user.id == request.user.id and role != "admin":
            return Response({"detail": "You can't demote yourself."}, status=400)
        user.role = role
    if "department_id" in data:
        dept_id = data.get("department_id")
        user.department = (Department.objects.filter(pk=dept_id, company=request.user.company).first()
                           if dept_id else None)
    if "full_name" in data:
        user.full_name = str(data.get("full_name") or "")[:200]
    if "title" in data:
        user.title = str(data.get("title") or "")[:120]
    if data.get("password"):
        err = _password_error(str(data["password"]), user)
        if err:
            return Response({"detail": err}, status=400)
        user.set_password(str(data["password"]))
    if "is_active" in data:
        user.is_active = bool(data.get("is_active"))
    user.save()
    if data.get("password") or data.get("is_active") is False:
        revoke_user_refresh_tokens(user)
    audit(request, "update_user", f"{user.email}")
    return Response(UserSerializer(user, context={"request": request}).data)


@api_view(["GET"])
@permission_classes([IsAdmin])
def audit_log(request):
    """The company's audit entries, paginated, with CSV export (?export=csv)."""
    qs = AuditLog.objects.filter(company=request.user.company).order_by("-created_at")
    if request.query_params.get("export") == "csv":
        import csv as _csv
        buf = io.StringIO()
        w = _csv.writer(buf)
        w.writerow(["created_at", "action", "detail", "ip", "user_id"])
        for row in qs[:5000]:
            w.writerow([row.created_at.isoformat(), row.action, row.detail, row.ip, row.user_id])
        resp = FileResponse(io.BytesIO(buf.getvalue().encode("utf-8")), as_attachment=True,
                            filename=f"openvault-audit-{timezone.localdate().isoformat()}.csv")
        return resp
    page = _paginate(request, qs, default_page_size=100)
    return Response({
        "results": AuditSerializer(page["qs"], many=True).data,
        "count": page["count"], "page": page["page"], "pages": page["pages"],
    })


# --------------------------------------------------------- company settings
@api_view(["GET", "PATCH"])
@permission_classes([IsAdmin])
def company_settings(request):
    """Read or update the admin's own company profile (name/contact/seat cap)."""
    company = request.user.company
    if company is None:
        return Response({"detail": "No company context."}, status=400)
    if request.method == "GET":
        return Response(CompanyProfileSerializer(company).data)
    data = request.data
    if "name" in data:
        name = str(data.get("name") or "").strip()[:200]
        if name:
            company.name = name
    for field in ("website", "contact_email", "phone"):
        if field in data:
            setattr(company, field, str(data.get(field) or "").strip()[:200])
    if "max_employees" in data:
        raw = data.get("max_employees")
        if raw in (None, ""):
            company.max_employees = None
        else:
            try:
                company.max_employees = max(1, int(raw))
            except (TypeError, ValueError):
                return Response({"detail": "max_employees must be a positive integer."}, status=400)
    company.save()
    audit(request, "company_settings_update", company.name)
    return Response(CompanyProfileSerializer(company).data)


# --------------------------------------------------------- company directory
@api_view(["GET"])
@permission_classes([IsAuthenticated])
@rate_limit("company_search", rate=20, per_seconds=60, key="ip")
def company_search(request):
    """Find a registered company by its short share code."""
    code = (request.query_params.get("code") or "").strip().upper()
    if not code:
        return Response({"detail": "Enter a company access code."}, status=400)
    company = Company.objects.filter(access_code__iexact=code).first()
    if not company:
        return Response({"detail": "No registered company uses that access code."}, status=404)
    return Response(CompanyDirectorySerializer(company).data)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
@rate_limit("company_members", rate=20, per_seconds=60, key="ip")
def company_members(request, access_code):
    """List selectable enterprise members for a company found by access code.
    Rate-limited so the directory cannot be enumerated at speed."""
    company = Company.objects.filter(access_code__iexact=access_code.strip()).first()
    if not company:
        return Response({"detail": "No registered company uses that access code."}, status=404)
    users = User.objects.filter(company=company, is_active=True).exclude(role="public").order_by("full_name", "email")
    return Response(MemberDirectorySerializer(users, many=True).data)


# ------------------------------------------------- cross-company collaboration
@api_view(["GET", "POST"])
@permission_classes([IsEditor])
def document_shares(request, pk):
    """List (GET) or grant (POST {access_code, user_id}) access to ONE document
    for ONE user. Only the owning company can manage a document's shares."""
    doc = _get_doc(request, pk)
    if request.method == "GET":
        shares = DocumentShare.objects.filter(document=doc).select_related(
            "shared_with_user", "shared_with_user__company"
        )
        return Response(DocumentShareSerializer(shares, many=True).data)

    target, error = share_target(request)
    if error:
        return Response({"detail": error}, status=400)
    can_download_raw = request.data.get("can_download", True)
    can_download = can_download_raw if isinstance(can_download_raw, bool) else str(can_download_raw).lower() in ("1", "true", "yes", "on")
    access, _ = DocumentAccess.objects.update_or_create(
        document=doc, user=target,
        defaults={"can_download": can_download},
    )
    share, _ = DocumentShare.objects.update_or_create(
        document=doc, shared_with_user=target,
        defaults={
            "shared_by": request.user,
            "can_download": access.can_download,
        },
    )
    audit(request, "share", f"{doc.filename} -> {target.email} ({target.company.name})")
    return Response(DocumentShareSerializer(share).data, status=201)


@api_view(["DELETE"])
@permission_classes([IsEditor])
def document_share_detail(request, pk, user_id):
    """Revoke one user's access to a document."""
    doc = _get_doc(request, pk)
    DocumentShare.objects.filter(document=doc, shared_with_user_id=user_id).delete()
    DocumentAccess.objects.filter(document=doc, user_id=user_id).delete()
    audit(request, "unshare", f"{doc.filename} (user {user_id})")
    return Response(status=204)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def shared_with_me(request):
    """Documents from OTHER companies that were shared with the current user."""
    shares = (
        DocumentShare.objects.filter(shared_with_user=request.user)
        .exclude(document__company=request.user.company)
        .select_related("document", "document__company", "shared_by")
        .order_by("-created_at")
    )
    out = []
    for s in shares:
        data = DocumentSerializer(s.document).data
        data["shared_by"] = s.shared_by.email if s.shared_by else None
        data["can_download"] = s.can_download
        out.append(data)
    return Response(out)


# --------------------------------------------------------- LLM provider config
@api_view(["GET", "PUT", "DELETE"])
@permission_classes([IsAuthenticated])
def llm_config(request):
    """Read or update LLM settings.

    Platform admins manage the platform-wide default row (company NULL). Company
    admins manage their OWN company's override row — plan-gated
    (allow_custom_llm) — which lets a tenant bring its own model/key while
    everyone else stays on the platform default.
    """
    from .permissions import is_platform_admin as _is_plat
    if _is_plat(request.user) and request.user.company_id is None:
        cfg = LLMConfig.load()
        is_override = False
    else:
        if request.user.company_id is None:
            return Response({"detail": "No company context."}, status=400)
        if request.method != "GET":
            plan = _plan_for(request.user.company)
            if not (plan and plan.allow_custom_llm):
                return Response({"detail": "Custom AI settings are not part of your plan."},
                                status=402)
            cfg, _created = LLMConfig.objects.get_or_create(company=request.user.company)
            is_override = True
        else:
            # Read-only: show the company's override if one exists, otherwise the
            # platform/.env default WITHOUT persisting a row that shadows .env.
            cfg = LLMConfig.for_company(request.user.company) or LLMConfig.load()
            is_override = cfg.pk is not None and cfg.company_id is not None

    if request.method == "GET":
        data = LLMConfigSerializer(cfg).data
        if not is_override:
            # Surface the EFFECTIVE platform defaults. A stale platform row must
            # not hide the shared Render Bedrock key / Claude 4.5 model.
            effective = providers._resolve(request.user.company)
            data.update({
                "provider": effective["provider"],
                "chat_model": effective["model"],
                "base_url": effective["base_url"],
                "temperature": effective["temperature"],
                "max_tokens": effective["max_tokens"],
                "key_source": effective["key_source"],
                "platform_key_in_use": effective["key_source"] == "platform_env",
                "has_api_key": effective["key_source"] in ("platform_env", "row", "company"),
            })
        return Response(data)
    if request.method == "DELETE" and is_override:
        cfg.delete()
        audit(request, "llm_config_reset", "company override removed")
        return Response(LLMConfigSerializer(LLMConfig.load()).data)
    s = LLMConfigSerializer(cfg, data=request.data, partial=True)
    s.is_valid(raise_exception=True)
    s.save()
    audit(request, "llm_config", f"{'company' if is_override else 'platform'} provider={cfg.provider} model={cfg.chat_model}")
    return Response(LLMConfigSerializer(cfg).data)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def llm_test(request):
    """Ping the currently-configured provider with a tiny prompt."""
    company = getattr(request.user, "company", None)
    prov = providers.get_chat_provider(company=company)
    if not prov.available():
        return Response({"ok": False, "provider": prov.label, "model": prov.chat_model,
                         "detail": "Not reachable / no API key set."})
    try:
        out = "".join(prov.stream_chat(
            [{"role": "system", "content": "Reply with exactly one word: pong."},
             {"role": "user", "content": "ping"}],
            temperature=0.0, max_tokens=64,
        ))
        return Response({"ok": True, "provider": prov.label, "model": prov.chat_model,
                         "sample": out.strip()[:120]})
    except Exception:
        # The raw provider error can echo internal endpoints/bodies back to the
        # browser (SSRF response disclosure); log it server-side instead.
        import logging
        logging.getLogger(__name__).exception("llm-test connectivity check failed")
        return Response({"ok": False, "provider": prov.label, "model": prov.chat_model,
                         "detail": "The AI endpoint could not be reached or rejected the "
                                   "request. Check the provider, model and key settings."})


# --------------------------------------------------------- departments
@api_view(["GET", "POST"])
@permission_classes([IsAdmin])
def departments(request):
    """List or create departments in the admin's own company (plan-gated)."""
    company = request.user.company
    if company is None:
        return Response({"detail": "No company context."}, status=400)
    plan = _plan_for(company)
    if request.method == "GET":
        depts = company.departments.annotate(_members=Count("members"))
        return Response(DepartmentSerializer(depts, many=True).data)
    if not (plan and plan.allow_departments):
        return Response({"detail": "Departments are not part of your current plan."}, status=402)
    name = str((request.data or {}).get("name") or "").strip()[:120]
    if not name:
        return Response({"detail": "Department name is required."}, status=400)
    dept, created = Department.objects.get_or_create(company=company, name=name)
    if not created:
        return Response({"detail": "That department already exists."}, status=400)
    audit(request, "department_add", name)
    return Response(DepartmentSerializer(dept).data, status=201)


@api_view(["DELETE"])
@permission_classes([IsAdmin])
def department_detail(request, pk):
    """Delete a department; members keep working, department docs become company-wide? No —
    they are re-scoped to 'restricted' to the uploader to stay safe."""
    try:
        dept = Department.objects.get(pk=pk, company=request.user.company)
    except Department.DoesNotExist:
        raise Http404
    name = dept.name
    Document.objects.filter(department=dept).update(department=None, access_scope="company")
    User.objects.filter(department=dept).update(department=None)
    dept.delete()
    audit(request, "department_remove", name)
    return Response(status=204)


# --------------------------------------------------------- announcements
@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def announcements(request):
    """Company announcements. Anyone can read; only admins create."""
    company = request.user.company
    if company is None:
        return Response([])
    if request.method == "GET":
        qs = company.announcements.all()[:50]
        return Response(AnnouncementSerializer(qs, many=True).data)
    if request.user.role != "admin" and not _is_platform_level(request.user):
        return Response({"detail": "Only admins can post announcements."}, status=403)
    title = str((request.data or {}).get("title") or "").strip()[:200]
    body = str((request.data or {}).get("body") or "").strip()
    if not title or not body:
        return Response({"detail": "Title and body are required."}, status=400)
    ann = Announcement.objects.create(company=company, title=title, body=body,
                                      created_by=request.user)
    audit(request, "announcement", title)
    return Response(AnnouncementSerializer(ann).data, status=201)


@api_view(["DELETE"])
@permission_classes([IsAdmin])
def announcement_detail(request, pk):
    try:
        ann = Announcement.objects.get(pk=pk, company=request.user.company)
    except Announcement.DoesNotExist:
        raise Http404
    ann.delete()
    audit(request, "announcement_remove", ann.title)
    return Response(status=204)


# --------------------------------------------------------- analytics (admin)
@api_view(["GET"])
@permission_classes([IsAdmin])
def analytics(request):
    """Usage analytics for the admin's company: asks by user/department,
    unanswered questions, flagged asks, ratings and top documents."""
    company = request.user.company
    if company is None:
        return Response({"detail": "No company context."}, status=400)
    logs = AskLog.objects.filter(company=company)
    days = 30
    try:
        days = min(90, max(1, int(request.query_params.get("days", 30))))
    except (TypeError, ValueError):
        pass
    since = timezone.now() - timezone.timedelta(days=days)
    recent = logs.filter(created_at__gte=since)

    by_user = list(
        recent.values("user__email", "user__full_name")
        .annotate(asks=Count("id"), unanswered=Count("id", filter=Q(chunks_found=0)))
        .order_by("-asks")[:20]
    )
    by_department = list(
        recent.exclude(department=None)
        .values("department__name")
        .annotate(asks=Count("id"), unanswered=Count("id", filter=Q(chunks_found=0)))
        .order_by("-asks")[:20]
    )
    unanswered = list(
        recent.filter(chunks_found=0).order_by("-created_at")
        .values("question", "created_at", "user__email")[:50]
    )
    ratings = {
        "up": ChatMessage.objects.filter(
            conversation__company=company, rating=1, created_at__gte=since).count(),
        "down": ChatMessage.objects.filter(
            conversation__company=company, rating=-1, created_at__gte=since).count(),
    }
    top_docs = list(
        company.documents.order_by("-downloads").values("filename", "downloads")[:10]
    )
    # Monthly ask usage vs the plan quota (for the usage meter).
    month_start = timezone.localtime().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    month_asks = logs.filter(created_at__gte=month_start).count()
    plan = _plan_for(company)
    return Response({
        "range_days": days,
        "totals": {
            "asks": recent.count(),
            "unanswered": recent.filter(chunks_found=0).count(),
            "flagged": recent.filter(flagged=True).count(),
            "avg_latency_ms": int(recent.aggregate(a=Avg("latency_ms"))["a"] or 0),
        },
        "by_user": by_user,
        "by_department": by_department,
        "unanswered_questions": unanswered,
        "ratings": ratings,
        "top_documents": top_docs,
        "usage": {"asks_this_month": month_asks,
                  "monthly_ask_limit": plan.monthly_ask_limit if plan else None},
    })


@api_view(["GET"])
@permission_classes([IsAdmin])
def usage(request):
    """Usage & plan dashboard data for the company's own admins: current
    consumption of every plan quota this month plus the upgrade catalogue."""
    company = request.user.company
    if company is None:
        return Response({"detail": "No company context."}, status=400)
    plan = _plan_for(company)

    month_start = timezone.localtime().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    asks_used = AskLog.objects.filter(company=company, created_at__gte=month_start).count()
    doc_count = company.documents.count()
    storage_bytes = company.documents.aggregate(total=Sum("size"))["total"] or 0
    member_count = company.users.count()
    department_count = company.departments.count()

    def remaining(used, cap):
        return None if cap is None else max(cap - used, 0)

    upgrades = Plan.objects.filter(is_active=True, price_usd__gt=plan.price_usd) \
                           .order_by("price_usd")
    return Response({
        "plan": PlanSerializer(plan).data,
        "usage": {
            "asks": {"used": asks_used,
                     "limit": plan.monthly_ask_limit,
                     "remaining": remaining(asks_used, plan.monthly_ask_limit)},
            "documents": {"used": doc_count,
                          "limit": plan.max_documents,
                          "remaining": remaining(doc_count, plan.max_documents)},
            "storage": {"used_bytes": storage_bytes,
                        "limit_mb": plan.storage_mb,
                        "used_mb": round(storage_bytes / (1024 * 1024), 1)},
            "members": {"used": member_count,
                        "limit": plan.max_members,
                        "remaining": remaining(member_count, plan.max_members)},
            "departments": {"used": department_count,
                            "enabled": bool(plan.allow_departments)},
        },
        "upgrades": PlanSerializer(upgrades, many=True).data,
    })


# --------------------------------------------------------- plans (public + admin)
@api_view(["GET"])
@permission_classes([AllowAny])
def plans(request):
    """Public plan catalogue (USD pricing) for the pricing page."""
    qs = Plan.objects.filter(is_active=True)
    return Response(PlanSerializer(qs, many=True).data)


@api_view(["POST"])
@permission_classes([IsPlatformAdmin])
def company_set_plan(request, pk):
    """Platform admin moves a company onto a plan (billing is offline: bank
    transfer / JazzCash / Easypaisa — record the change here)."""
    company = Company.objects.filter(pk=pk).first()
    if not company:
        return Response({"detail": "Company not found."}, status=404)
    plan_id = (request.data or {}).get("plan_id")
    plan = Plan.objects.filter(pk=plan_id, is_active=True).first() if plan_id else None
    if not plan:
        return Response({"detail": "Plan not found."}, status=404)
    company.plan = plan
    company.save(update_fields=["plan"])
    AuditLog.objects.create(company=company, user=request.user, action="plan_change",
                            detail=f"-> {plan.name} (${plan.price_usd}/{plan.billing_period})",
                            ip=client_ip(request))
    return Response({"ok": True, "company": company.name, "plan": PlanSerializer(plan).data})


# --------------------------------------------------------- Platform admin tools
@api_view(["GET"])
@permission_classes([IsPlatformAdmin])
def list_companies(request):
    """List every registered company with usage counters (platform admin only)."""
    # distinct=True on both counts avoids the cross-product of the two joins.
    companies = (Company.objects
                 .annotate(_members=Count("users", distinct=True),
                           _docs=Count("documents", distinct=True))
                 .order_by("name"))
    out = []
    for c in companies:
        out.append({
            "id": c.id, "name": c.name, "slug": c.slug, "access_code": c.access_code,
            "member_count": c._members, "doc_count": c._docs,
            "plan": PlanSerializer(c.plan).data if c.plan else None,
        })
    return Response(out)


@api_view(["POST"])
@permission_classes([IsPlatformAdmin])
def switch_company(request):
    """Switch the platform admin's active company (for support/testing)."""
    company_id = request.data.get("company_id")
    if not company_id:
        return Response({"detail": "company_id is required."}, status=400)
    company = Company.objects.filter(pk=company_id).first()
    if not company:
        return Response({"detail": "Company not found."}, status=404)
    request.user.company = company
    request.user.save(update_fields=["company"])
    audit(request, "switch_company", f"Switched to {company.name}")
    return Response(UserSerializer(request.user, context={"request": request}).data)


@api_view(["POST"])
@permission_classes([IsPlatformAdmin])
def detach_company(request):
    """Return the platform admin to no-company (all-tenant) view."""
    request.user.company = None
    request.user.department = None
    request.user.save(update_fields=["company", "department"])
    return Response(UserSerializer(request.user, context={"request": request}).data)


# ------------------------------------------------- workflow document downloads
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def workflow_form_download(request, user_id, name):
    """Serve a generated workflow document (e.g. an auto-filled leave form) to
    its owner. Path is confined to MEDIA_ROOT/forms/<user_id>/ (or S3 forms/<user_id>/)."""
    if not (_is_platform_level(request.user) or request.user.id == user_id):
        return Response({"detail": "You can only download your own forms."}, status=403)

    safe_name = os.path.basename(name)
    if safe_name != name or ".." in name:
        raise Http404

    rel_key = os.path.join("forms", str(user_id), safe_name)
    if storage.is_s3_enabled() and storage.exists(rel_key, base_dir=settings.MEDIA_ROOT):
        audit(request, "form_download", safe_name)
        return FileResponse(
            storage.open_stream(rel_key, base_dir=settings.MEDIA_ROOT),
            as_attachment=True,
            filename=safe_name,
        )

    base_dir = os.path.realpath(os.path.join(settings.MEDIA_ROOT, "forms", str(user_id)))
    requested = os.path.realpath(os.path.join(base_dir, safe_name))
    if requested != base_dir and not requested.startswith(base_dir + os.sep):
        raise Http404
    if not os.path.isfile(requested):
        raise Http404
    audit(request, "form_download", os.path.basename(requested))
    return FileResponse(
        open(requested, "rb"), as_attachment=True, filename=os.path.basename(requested)
    )


# ------------------------------------------------------------- attendance (F5)
@api_view(["POST"])
@permission_classes([IsAuthenticated])
def attendance_scan(request):
    """Mark today's attendance for the signed-in user (the QR scan target)."""
    user = request.user
    if not getattr(user, "company_id", None):
        return Response({"detail": "Your account is not linked to a company."}, status=400)

    today = timezone.localdate()
    existing = AttendanceRecord.objects.filter(user=user, date=today).first()
    if existing:
        return Response(
            {"detail": "Attendance already marked for today.",
             "record": AttendanceRecordSerializer(existing).data},
            status=409,
        )
    record = AttendanceRecord.objects.create(
        company=user.company, user=user, date=today, status="Present"
    )
    audit(request, "attendance_scan", f"Present {today.isoformat()}")
    return Response(AttendanceRecordSerializer(record).data, status=201)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def attendance_me(request):
    """The signed-in user's own attendance history and discipline counters."""
    user = request.user
    today = timezone.localdate()
    records = AttendanceRecord.objects.filter(user=user)[:120]
    strike = UserStrike.objects.filter(user=user).first()
    return Response({
        "today": today.isoformat(),
        "marked_today": AttendanceRecord.objects.filter(user=user, date=today).exists(),
        "absences_this_month": attendance_svc.absences_in_month(user, today.year, today.month),
        "records": AttendanceRecordSerializer(records, many=True).data,
        "strike": UserStrikeSerializer(strike).data if strike else None,
    })


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def attendance_qr(request):
    """Return the attendance check-in target plus an inline SVG QR when the
    optional `qrcode` library is installed."""
    base = settings.PUBLIC_BASE_URL or f"{request.scheme}://{request.get_host()}"
    target = f"{base}/workspace/attendance?scan=1"
    payload = {"target": target, "svg": None, "qr_available": False}
    try:
        import qrcode  # optional dependency
        import qrcode.image.svg

        img = qrcode.make(target, image_factory=qrcode.image.svg.SvgImage)
        buf = io.BytesIO()
        img.save(buf)
        payload["svg"] = buf.getvalue().decode("utf-8")
        payload["qr_available"] = True
    except Exception:
        pass
    return Response(payload)


@api_view(["POST"])
@permission_classes([IsAdmin])
def admin_attendance_evaluate(request):
    """Run the monthly attendance evaluation for the admin's own company."""
    company = request.user.company
    if company is None:
        return Response({"detail": "No company context for evaluation."}, status=400)

    def _flag(name, default):
        raw = request.data.get(name, default)
        return raw if isinstance(raw, bool) else str(raw).lower() in ("1", "true", "yes", "on")

    dry_run = _flag("dry_run", False)
    freeze = _flag("freeze", True)
    year, month = request.data.get("year"), request.data.get("month")
    try:
        year = int(year) if year not in (None, "") else None
        month = int(month) if month not in (None, "") else None
    except (TypeError, ValueError):
        return Response({"detail": "year and month must be integers."}, status=400)

    results = attendance_svc.evaluate_month(
        year=year, month=month, company=company, freeze=freeze, dry_run=dry_run
    )
    if not dry_run:
        struck = sum(1 for r in results if r["new_strike"])
        frozen = sum(1 for r in results if r["deactivated"])
        audit(request, "attendance_evaluate",
              f"{len(results)} users, {struck} new strike(s), {frozen} frozen")
    return Response({
        "dry_run": dry_run,
        "freeze": freeze,
        "evaluated": len(results),
        "results": results,
    })
