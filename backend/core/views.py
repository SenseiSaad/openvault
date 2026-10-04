"""API endpoints. Function-based DRF views kept deliberately simple and flat.

Multi-tenant rule enforced everywhere: a request only ever touches rows where
`company == request.user.company`. Document reads additionally pass the
per-document ACL before metadata, downloads, or RAG retrieval are returned.
"""
import os
import uuid

from django.contrib.auth import authenticate
from django.db.models import Q
from django.http import StreamingHttpResponse, Http404, FileResponse
from django.utils.text import slugify
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken

from django.conf import settings

from . import rag
from . import providers
from .models import (
    Company, User, Document, DocumentAccess, AuditLog, DocumentShare, LLMConfig,
)
from .permissions import IsAdmin, IsEditor
from .serializers import (
    CompanySerializer, CompanyDirectorySerializer, MemberDirectorySerializer,
    UserSerializer, DocumentSerializer, AuditSerializer,
    RegisterCompanySerializer, LoginSerializer, UserCreateSerializer, AskSerializer,
    DocumentShareSerializer, LLMConfigSerializer,
)


def client_ip(request):
    """Best-effort caller IP for the audit log (honours X-Forwarded-For)."""
    fwd = request.META.get("HTTP_X_FORWARDED_FOR")
    return (fwd.split(",")[0].strip() if fwd else request.META.get("REMOTE_ADDR", "")) or ""


def audit(request, action, detail=""):
    """Write one audit-trail row for the caller's company."""
    user = request.user if getattr(request, "user", None) and request.user.is_authenticated else None
    company = getattr(user, "company", None)
    if company is None:
        return
    AuditLog.objects.create(
        company=company, user=user, action=action, detail=detail[:300], ip=client_ip(request)
    )


def token_for(user):
    """Mint a short-lived JWT access token for this user."""
    return str(RefreshToken.for_user(user).access_token)


def visible_documents(user):
    """Return only documents the signed-in user is allowed to read."""
    if not getattr(user, "company_id", None):
        return Document.objects.none()
    return (
        Document.objects.filter(company_id=user.company_id)
        .filter(Q(access_scope="company") | Q(access_grants__user=user))
        .distinct()
    )


def share_target(request):
    """Resolve a registered target user from a company code + member id.

    The code is required for the new sharing flow. Email remains accepted as a
    backwards-compatible API path for existing integrations, but the frontend
    never needs to expose a global email directory.
    """
    access_code = (request.data.get("access_code") or "").strip().upper()
    raw_user_id = request.data.get("user_id")
    email = (request.data.get("email") or "").strip()
    company = None
    if access_code:
        company = Company.objects.filter(access_code__iexact=access_code).first()
        if not company:
            return None, "No registered company uses that access code."
    try:
        if raw_user_id is not None:
            target = User.objects.get(pk=int(raw_user_id), is_active=True)
        elif email:
            target = User.objects.get(email__iexact=email, is_active=True)
        else:
            return None, "Select a registered company member."
    except (User.DoesNotExist, TypeError, ValueError):
        return None, "That registered member could not be found."
    if company and target.company_id != company.id:
        return None, "That member does not belong to the selected company."
    if not target.company_id or target.role == "public":
        return None, "Only registered enterprise members can receive documents."
    return target, None

# -------------------------------------------------------------------- auth
@api_view(["POST"])
@permission_classes([AllowAny])
def register_company(request):
    """Create a new company and its first admin. Returns a JWT."""
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

    company = Company.objects.create(
        name=d["company_name"], slug=slug,
        website=d.get("website", ""), contact_email=d.get("contact_email", ""),
        phone=d.get("phone", ""), max_employees=d.get("max_employees"),
    )
    user = User.objects.create_user(
        email=d["email"], password=d["password"],
        full_name=d.get("admin_name", ""), title=d.get("admin_title", ""),
        role="admin", company=company,
    )
    AuditLog.objects.create(company=company, user=user, action="register",
                            detail=f"company {company.name}", ip=client_ip(request))
    return Response({"token": token_for(user), "user": UserSerializer(user).data}, status=201)


@api_view(["POST"])
@permission_classes([AllowAny])
def login(request):
    """Enterprise sign-in with email + password. Returns a JWT."""
    s = LoginSerializer(data=request.data)
    s.is_valid(raise_exception=True)
    user = authenticate(username=s.validated_data["email"], password=s.validated_data["password"])
    if user is None:
        return Response({"detail": "Invalid email or password."}, status=401)
    audit(_as(request, user), "login")
    return Response({"token": token_for(user), "user": UserSerializer(user).data})


def _as(request, user):
    """Attach an authenticated user to a raw request so audit() can log it."""
    request.user = user
    return request


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def me(request):
    """Return the signed-in user's own profile (used to hydrate the frontend)."""
    return Response(UserSerializer(request.user).data)

# --------------------------------------------------------------- documents
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def documents(request):
    """List only documents readable by this member."""
    qs = visible_documents(request.user).order_by("-created_at")
    return Response(DocumentSerializer(qs, many=True).data)


@api_view(["POST"])
@permission_classes([IsEditor])
def upload_document(request):
    """Upload + index a file. `is_okf` marks a curated always-in-context note."""
    f = request.FILES.get("file")
    if not f:
        return Response({"detail": "No file provided."}, status=400)
    is_okf = str(request.data.get("is_okf", "")).lower() in ("1", "true", "yes", "on")
    access_scope = (request.data.get("access_scope") or "company").strip().lower()
    if access_scope not in {"company", "restricted"}:
        return Response({"detail": "access_scope must be company or restricted."}, status=400)
    category = request.data.get("category") or "Other"
    description = request.data.get("description") or ""

    company = request.user.company
    folder = os.path.join(settings.DATA_DIR, company.slug)
    os.makedirs(folder, exist_ok=True)
    stored = os.path.join(folder, f"{uuid.uuid4().hex}_{f.name}")
    raw = f.read()
    with open(stored, "wb") as out:
        out.write(raw)

    doc = Document.objects.create(
        company=company, filename=f.name, stored_path=stored,
        content_type=f.content_type or "", size=len(raw),
        category=category, description=description,
        is_okf=is_okf, access_scope=access_scope,
        uploaded_by=request.user,
    )
    DocumentAccess.objects.create(document=doc, user=request.user)
    n = rag.index_document(doc, raw)
    audit(request, "upload", f"{f.name} ({n} chunks)")
    return Response(DocumentSerializer(doc).data, status=201)


@api_view(["DELETE"])
@permission_classes([IsEditor])
def document_detail(request, pk):
    doc = _get_doc(request, pk)
    if doc.stored_path and os.path.exists(doc.stored_path):
        try:
            os.remove(doc.stored_path)
        except OSError:
            pass
    name = doc.filename
    doc.delete()
    audit(request, "delete", name)
    return Response(status=204)


def _get_doc(request, pk):
    """Owner-company only. Used for edit / delete / publish / share management."""
    try:
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
    if getattr(u, "company_id", None) and doc.company_id == u.company_id:
        if doc.access_scope == "company" or DocumentAccess.objects.filter(document=doc, user=u).exists():
            return doc
    if DocumentShare.objects.filter(document=doc, shared_with_user=u).exists():
        return doc
    if DocumentAccess.objects.filter(document=doc, user=u).exists():
        return doc
    raise Http404


def _can_download(request, doc):
    """Enforce download permission server-side, not just in the UI."""
    u = request.user
    if doc.company_id == getattr(u, "company_id", None):
        if doc.access_scope == "company":
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
    if not doc.stored_path or not os.path.exists(doc.stored_path):
        raise Http404
    audit(request, "download", doc.filename)
    return FileResponse(open(doc.stored_path, "rb"), as_attachment=True, filename=doc.filename)


# ------------------------------------------------------------------- chat
@api_view(["POST"])
@permission_classes([IsAuthenticated])
def ask(request):
    """Stream an answer as NDJSON, grounded only in documents this user may see
    (their own company's documents plus any explicitly shared with them)."""
    s = AskSerializer(data=request.data)
    s.is_valid(raise_exception=True)
    question = s.validated_data["question"]
    audit(request, "ask", question)

    resp = StreamingHttpResponse(
        rag.stream_answer(request.user, question), content_type="application/x-ndjson"
    )
    resp["Cache-Control"] = "no-cache"
    resp["X-Accel-Buffering"] = "no"
    return resp


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def llm_status(request):
    """Lightweight status probe for the chat model (drives the UI status dot)."""
    prov = providers.get_chat_provider()
    return Response({"online": prov.available(), "provider": prov.label, "model": prov.chat_model})

# -------------------------------------------------------- admin (company)
@api_view(["GET", "POST"])
@permission_classes([IsAdmin])
def users(request):
    """List or create users within the admin's own company only."""
    company = request.user.company
    if request.method == "GET":
        qs = User.objects.filter(company=company).order_by("email")
        return Response(UserSerializer(qs, many=True).data)

    s = UserCreateSerializer(data=request.data)
    s.is_valid(raise_exception=True)
    d = s.validated_data
    if User.objects.filter(email__iexact=d["email"]).exists():
        return Response({"detail": "Email already registered."}, status=400)
    # Optional seat limit: only enforced when the company set a max_employees.
    if company.max_employees and company.users.count() >= company.max_employees:
        return Response(
            {"detail": f"Seat limit reached ({company.max_employees}). "
                       "Increase it in company settings to add more members."},
            status=400,
        )
    user = User.objects.create_user(
        email=d["email"], password=d["password"],
        full_name=d.get("full_name", ""), title=d.get("title", ""),
        role=d["role"], company=company,
    )
    audit(request, "add_user", f"{user.email} ({user.role})")
    return Response(UserSerializer(user).data, status=201)


@api_view(["DELETE"])
@permission_classes([IsAdmin])
def user_detail(request, pk):
    """Remove a member of the admin's own company (can't delete yourself)."""
    if pk == request.user.id:
        return Response({"detail": "You can't remove yourself."}, status=400)
    try:
        user = User.objects.get(pk=pk, company=request.user.company)
    except User.DoesNotExist:
        raise Http404
    email = user.email
    user.delete()
    audit(request, "remove_user", email)
    return Response(status=204)


@api_view(["GET"])
@permission_classes([IsAdmin])
def audit_log(request):
    """The company's 200 most recent audit entries (admin only)."""
    qs = AuditLog.objects.filter(company=request.user.company).order_by("-created_at")[:200]
    return Response(AuditSerializer(qs, many=True).data)

# --------------------------------------------------------- company directory
@api_view(["GET"])
@permission_classes([IsAuthenticated])
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
def company_members(request, access_code):
    """List selectable enterprise members for a company found by access code."""
    company = Company.objects.filter(access_code__iexact=access_code.strip()).first()
    if not company:
        return Response({"detail": "No registered company uses that access code."}, status=404)
    users = User.objects.filter(company=company, is_active=True).exclude(role="public").order_by("full_name", "email")
    return Response(MemberDirectorySerializer(users, many=True).data)


# ------------------------------------------------- cross-company collaboration
@api_view(["GET", "POST"])
@permission_classes([IsEditor])
def document_shares(request, pk):
    """List (GET) or grant (POST {email}) access to ONE document for ONE user.
    Only the owning company can manage a document's shares."""
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
@api_view(["GET", "PUT"])
@permission_classes([IsAdmin])
def llm_config(request):
    """Read or update the platform LLM settings (provider, model, API key, ...).

    Note: this is a global platform setting, not tenant-scoped — one shared model
    serves every company; isolation happens at retrieval, not at the model. In
    production restrict this to a platform operator and keep keys in .env."""
    cfg = LLMConfig.load()
    if request.method == "GET":
        return Response(LLMConfigSerializer(cfg).data)
    s = LLMConfigSerializer(cfg, data=request.data, partial=True)
    s.is_valid(raise_exception=True)
    s.save()
    audit(request, "llm_config", f"provider={cfg.provider} model={cfg.chat_model}")
    return Response(LLMConfigSerializer(cfg).data)


@api_view(["POST"])
@permission_classes([IsAdmin])
def llm_test(request):
    """Ping the currently-configured provider with a tiny prompt to prove it works."""
    prov = providers.get_chat_provider()
    if not prov.available():
        return Response({"ok": False, "provider": prov.label, "model": prov.chat_model,
                         "detail": "Not reachable / no API key set."})
    try:
        out = "".join(prov.stream_chat(
            [{"role": "system", "content": "Reply with exactly one word: pong."},
             {"role": "user", "content": "ping"}],
            temperature=0.0, max_tokens=16,
        ))
        return Response({"ok": True, "provider": prov.label, "model": prov.chat_model,
                         "sample": out.strip()[:120]})
    except Exception as e:
        return Response({"ok": False, "provider": prov.label, "model": prov.chat_model,
                         "detail": str(e)[:200]})
