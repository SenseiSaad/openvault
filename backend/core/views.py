"""API endpoints. Function-based DRF views kept deliberately simple and flat.

Multi-tenant rule enforced everywhere: a request only ever touches rows where
`company == request.user.company`. Public endpoints expose only is_public docs.
"""
import os
import uuid

from django.contrib.auth import authenticate
from django.db.models import F, Q
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
from .models import Company, User, Document, Chunk, AuditLog, Favorite, DocumentShare, LLMConfig
from .permissions import IsAdmin, IsEditor
from .serializers import (
    CompanySerializer, UserSerializer, DocumentSerializer, AuditSerializer,
    RegisterCompanySerializer, LoginSerializer, UserCreateSerializer, AskSerializer,
    PublicRegisterSerializer, PublicLoginSerializer,
    DocumentShareSerializer, LLMConfigSerializer,
)


def client_ip(request):
    """Best-effort caller IP for the audit log (honours X-Forwarded-For)."""
    fwd = request.META.get("HTTP_X_FORWARDED_FOR")
    return (fwd.split(",")[0].strip() if fwd else request.META.get("REMOTE_ADDR", "")) or ""


def audit(request, action, detail=""):
    """Write one audit-trail row for the caller's company (no-op for public users)."""
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

# ------------------------------------------------------- consumer (public) auth
@api_view(["POST"])
@permission_classes([AllowAny])
def public_register(request):
    """Create a consumer account (username + email + password, no company)."""
    s = PublicRegisterSerializer(data=request.data)
    s.is_valid(raise_exception=True)
    d = s.validated_data
    if User.objects.filter(username__iexact=d["username"]).exists():
        return Response({"detail": "Username already taken."}, status=400)
    if User.objects.filter(email__iexact=d["email"]).exists():
        return Response({"detail": "Email already registered."}, status=400)
    user = User.objects.create_user(
        email=d["email"], password=d["password"],
        username=d["username"], role="public", company=None,
    )
    return Response({"token": token_for(user), "user": UserSerializer(user).data}, status=201)


@api_view(["POST"])
@permission_classes([AllowAny])
def public_login(request):
    """Consumers sign in with username + password (manual lookup)."""
    s = PublicLoginSerializer(data=request.data)
    s.is_valid(raise_exception=True)
    d = s.validated_data
    try:
        user = User.objects.get(username__iexact=d["username"], role="public")
    except User.DoesNotExist:
        return Response({"detail": "Invalid username or password."}, status=401)
    if not user.is_active or not user.check_password(d["password"]):
        return Response({"detail": "Invalid username or password."}, status=401)
    return Response({"token": token_for(user), "user": UserSerializer(user).data})

# --------------------------------------------------------------- documents
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def documents(request):
    """List this company's documents (tenant-scoped)."""
    qs = Document.objects.filter(company=request.user.company).order_by("-created_at")
    return Response(DocumentSerializer(qs, many=True).data)


@api_view(["POST"])
@permission_classes([IsEditor])
def upload_document(request):
    """Upload + index a file. `is_okf` marks a curated always-in-context note."""
    f = request.FILES.get("file")
    if not f:
        return Response({"detail": "No file provided."}, status=400)
    is_okf = str(request.data.get("is_okf", "")).lower() in ("1", "true", "yes", "on")
    is_public = str(request.data.get("is_public", "")).lower() in ("1", "true", "yes", "on")
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
        is_public=is_public, is_okf=is_okf, uploaded_by=request.user,
    )
    n = rag.index_document(doc, raw)
    audit(request, "upload", f"{f.name} ({n} chunks)")
    return Response(DocumentSerializer(doc).data, status=201)


@api_view(["POST", "DELETE"])
@permission_classes([IsEditor])
def document_detail(request, pk):
    doc = _get_doc(request, pk)
    if request.method == "DELETE":
        if doc.stored_path and os.path.exists(doc.stored_path):
            try:
                os.remove(doc.stored_path)
            except OSError:
                pass
        name = doc.filename
        doc.delete()
        audit(request, "delete", name)
        return Response(status=204)
    # POST toggles the public flag
    doc.is_public = not doc.is_public
    doc.save(update_fields=["is_public"])
    audit(request, "publish", f"{doc.filename} -> public={doc.is_public}")
    return Response(DocumentSerializer(doc).data)


def _get_doc(request, pk):
    """Owner-company only. Used for edit / delete / publish / share management."""
    try:
        return Document.objects.get(pk=pk, company=request.user.company)
    except Document.DoesNotExist:
        raise Http404


def _accessible_doc(request, pk):
    """Owner-company OR a document explicitly shared with this user.
    Used for read + download so cross-company collaborators can reach one file."""
    try:
        doc = Document.objects.get(pk=pk)
    except Document.DoesNotExist:
        raise Http404
    u = request.user
    if getattr(u, "company_id", None) and doc.company_id == u.company_id:
        return doc
    if DocumentShare.objects.filter(document=doc, shared_with_user=u).exists():
        return doc
    raise Http404


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def download_document(request, pk):
    doc = _accessible_doc(request, pk)
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

# ------------------------------------------------------- public portal (open)
def _preview(doc, limit=280):
    """First chunk's text as a short snippet (reuses already-indexed chunks)."""
    c = Chunk.objects.filter(document=doc).order_by("ord").first()
    if not c:
        return ""
    text = " ".join(c.text.split())
    return text[:limit] + ("…" if len(text) > limit else "")


def _public_card(doc, preview=False):
    """Shape a document into the trimmed public-portal card (no private fields)."""
    data = {
        "id": doc.id, "filename": doc.filename, "size": doc.size,
        "category": doc.category, "description": doc.description,
        "downloads": doc.downloads, "company": doc.company.name,
        "company_slug": doc.company.slug, "created_at": doc.created_at,
    }
    if preview:
        data["preview"] = _preview(doc)
    return data


@api_view(["GET"])
@permission_classes([AllowAny])
def public_companies(request):
    """Companies that have published at least one public document."""
    ids = Document.objects.filter(is_public=True).values_list("company_id", flat=True).distinct()
    qs = Company.objects.filter(id__in=list(ids)).order_by("name")
    return Response(CompanySerializer(qs, many=True).data)


@api_view(["GET"])
@permission_classes([AllowAny])
def public_categories(request):
    """Distinct categories among public documents, with counts."""
    from django.db.models import Count
    rows = (
        Document.objects.filter(is_public=True)
        .values("category").annotate(count=Count("id")).order_by("-count")
    )
    return Response([{"name": r["category"], "count": r["count"]} for r in rows])


@api_view(["GET"])
@permission_classes([AllowAny])
def public_documents(request):
    """Public documents with search + filters. No sign-in required.

    Query params: ?q= (filename/description/company), ?company=<slug>,
    ?category=<name>, ?sort=recent|popular.
    """
    qs = Document.objects.filter(is_public=True).select_related("company")

    q = (request.query_params.get("q") or "").strip()
    if q:
        qs = qs.filter(
            Q(filename__icontains=q) | Q(description__icontains=q)
            | Q(company__name__icontains=q) | Q(category__icontains=q)
        )
    slug = request.query_params.get("company")
    if slug:
        qs = qs.filter(company__slug=slug)
    category = request.query_params.get("category")
    if category:
        qs = qs.filter(category=category)

    sort = request.query_params.get("sort")
    qs = qs.order_by("-downloads", "-created_at") if sort == "popular" else qs.order_by("-created_at")

    return Response([_public_card(d, preview=True) for d in qs])


@api_view(["GET"])
@permission_classes([AllowAny])
def public_document_detail(request, pk):
    """Single public document: metadata + a text preview."""
    try:
        doc = Document.objects.select_related("company").get(pk=pk, is_public=True)
    except Document.DoesNotExist:
        raise Http404
    data = _public_card(doc, preview=True)
    data["preview"] = _preview(doc, limit=2000)
    if request.user and request.user.is_authenticated:
        data["favorited"] = Favorite.objects.filter(user=request.user, document=doc).exists()
    return Response(data)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def public_download(request, pk):
    """Download a public document. Requires an account; bumps the popularity counter."""
    try:
        doc = Document.objects.get(pk=pk, is_public=True)
    except Document.DoesNotExist:
        raise Http404
    if not doc.stored_path or not os.path.exists(doc.stored_path):
        raise Http404
    Document.objects.filter(pk=doc.pk).update(downloads=F("downloads") + 1)
    return FileResponse(open(doc.stored_path, "rb"), as_attachment=True, filename=doc.filename)


# ---------------------------------------------------------------- favourites
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def favorites(request):
    """The current user's saved public documents."""
    qs = (
        Favorite.objects.filter(user=request.user)
        .select_related("document", "document__company").order_by("-created_at")
    )
    return Response([_public_card(f.document, preview=True) for f in qs])


@api_view(["POST", "DELETE"])
@permission_classes([IsAuthenticated])
def favorite_detail(request, pk):
    """Add (POST) or remove (DELETE) a public document from favourites."""
    try:
        doc = Document.objects.get(pk=pk, is_public=True)
    except Document.DoesNotExist:
        raise Http404
    if request.method == "DELETE":
        Favorite.objects.filter(user=request.user, document=doc).delete()
        return Response(status=204)
    Favorite.objects.get_or_create(user=request.user, document=doc)
    return Response({"favorited": True}, status=201)


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

    email = (request.data.get("email") or "").strip()
    if not email:
        return Response({"detail": "Email is required."}, status=400)
    try:
        target = User.objects.get(email__iexact=email)
    except User.DoesNotExist:
        return Response({"detail": "No user with that email."}, status=404)
    if getattr(target, "company_id", None) and target.company_id == doc.company_id:
        return Response({"detail": "That user is already in this company."}, status=400)
    share, _ = DocumentShare.objects.get_or_create(
        document=doc, shared_with_user=target,
        defaults={"shared_by": request.user, "can_download": True},
    )
    audit(request, "share", f"{doc.filename} -> {target.email}")
    return Response(DocumentShareSerializer(share).data, status=201)


@api_view(["DELETE"])
@permission_classes([IsEditor])
def document_share_detail(request, pk, user_id):
    """Revoke one user's access to a document."""
    doc = _get_doc(request, pk)
    DocumentShare.objects.filter(document=doc, shared_with_user_id=user_id).delete()
    audit(request, "unshare", f"{doc.filename} (user {user_id})")
    return Response(status=204)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def shared_with_me(request):
    """Documents from OTHER companies that were shared with the current user."""
    shares = (
        DocumentShare.objects.filter(shared_with_user=request.user)
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
