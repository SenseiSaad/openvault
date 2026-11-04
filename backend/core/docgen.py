"""Deterministic template document generation.

Why deterministic (and NOT an LLM): filling a form or drafting an email from a
template is a substitution problem. An LLM would invent dates, names and policy
facts — exactly what this product must never do. This module:

* reads a rough template (the root `leave_request_form.txt` or an uploaded
  `is_template` document) WHOLE, never as retrieval chunks,
* replaces sample values and `[Field name]` placeholders with the signed-in
  user's / company's real (non-empty) profile fields,
* leaves unknown placeholders untouched and reports them in ONE line,
* emits structured JSON for forms/tables with a Markdown fallback,
* never logs profile data or document contents,
* makes NO model calls at all — no Bedrock, no keys, no network, no errors.

Request routing (`classify`) is rule-based so a policy question gets ONLY the
grounded RAG answer, a form request gets ONLY the finished document, and a
mixed request ("policy text + the form + an email") gets exactly those outputs.
"""
from __future__ import annotations

import json
import os
import re
from dataclasses import dataclass, field

from django.conf import settings
from django.utils import timezone

# ------------------------------------------------------------------ fields
# Canonical field -> keywords found inside bracket placeholders / tokens.
FIELD_ALIASES: dict[str, tuple[str, ...]] = {
    "full_name": ("full name", "employee name", "your name", "naam"),
    "email": ("email", "e-mail", "mail address"),
    "title": ("job title", "designation", "position", "your title", "title"),
    "role": ("role", "employment role"),
    "department": ("department", "team", "unit", "shoba", "engineering backend"),
    "manager": ("manager", "supervisor", "reporting manager", "boss"),
    "employee_id": ("employee id", "employee number", "emp id", "staff id", "id number", "emp"),
    "join_date": ("join date", "joining date", "start date", "date of joining"),
    "company_name": ("company", "organization", "organisation", "firm"),
    "hr_email": ("hr email", "hr address", "human resources email"),
    "signature": ("signature", "sign off", "signed"),
    "tone": ("tone", "style"),
    "phone": ("phone", "mobile", "contact number", "phone number"),
    "date": ("date", "today", "yyyy-mm-dd", "aaj", "tareekh"),
    "reason": ("brief reason", "reason for leave", "reason", "wajah"),
    "coverage": ("colleague", "coverage", "handover", "backup"),
}

# Literal example values baked into the rough draft. These are replaced with
# the CURRENT user's real data so a rough template becomes a real document.
SAMPLE_VALUES: dict[str, str] = {
    "Saad Waseem": "full_name",
    "obsks23@gmail.com": "email",
    "XYZ COMPANY": "company_name",
    "add_user_name_here": "full_name",
    "add_user_email_here": "email",
    "add_company_name_here": "company_name",
}

# Placeholders that must stay as checkboxes, never substituted.
_CHECKBOX = re.compile(r"^\[[ xX]?\]$")
_BRACKET = re.compile(r"\[([^\[\]\n]{2,120})\]")
_BRACES = re.compile(r"\{\{\s*([A-Za-z0-9_.]+)\s*\}\}")
_TOKEN = re.compile(r"\b(?:add|insert|put)_([a-z0-9_]+)_here\b", re.IGNORECASE)


@dataclass
class FillResult:
    text: str
    missing: list[str] = field(default_factory=list)
    filled: list[str] = field(default_factory=list)


def resolve_fields(user, overrides: dict | None = None) -> dict[str, str]:
    """Non-empty profile/company values available for substitution.

    Only non-empty fields are returned — nothing blank is ever injected into a
    prompt or a generated document. `overrides` are values the caller supplied
    in the request (dates, reasons, recipients), never invented here.
    """
    company = getattr(user, "company", None)
    dept = getattr(user, "department", None)
    today = timezone.localdate()
    raw: dict[str, str] = {
        "full_name": (getattr(user, "full_name", "") or "").strip(),
        "email": (getattr(user, "email", "") or "").strip(),
        "title": (getattr(user, "title", "") or "").strip(),
        "role": (getattr(user, "role", "") or "").strip(),
        "department": (getattr(dept, "name", "") or "").strip(),
        "manager": (getattr(user, "manager", "") or "").strip(),
        "employee_id": (getattr(user, "employee_id", "") or "").strip(),
        "join_date": str(getattr(user, "join_date", "") or ""),
        "company_name": (getattr(company, "name", "") or "").strip(),
        "hr_email": (getattr(company, "hr_email", "") or "").strip(),
        "signature": (getattr(company, "signature", "") or "").strip(),
        "tone": (getattr(company, "tone", "") or "").strip(),
        "phone": (getattr(company, "phone", "") or "").strip(),
        "date": today.isoformat(),
        "day": today.strftime("%A, %d %B %Y"),
    }
    fields = {k: v for k, v in raw.items() if v}
    for key, value in (overrides or {}).items():
        key = str(key).strip().lower()
        value = str(value or "").strip()
        if value:
            fields[key] = value[:300]
    return fields


def canonical_field(label: str) -> str | None:
    """Map a placeholder label to a canonical field key, or None if unknown.

    The LONGEST matching alias wins, so "manager's name" resolves to manager
    (not the generic "name" -> full_name).
    """
    low = re.sub(r"[^a-z0-9 ]+", " ", label.lower())
    low = re.sub(r"\s+", " ", low).strip()
    low = re.sub(r"^(e g|eg|your|the|a|brief|specify)\s+", "", low)
    best: tuple[int, str] | None = None
    for key, aliases in FIELD_ALIASES.items():
        for alias in aliases:
            if alias in low and (best is None or len(alias) > best[0]):
                best = (len(alias), key)
    return best[1] if best else None


def _clean_label(label: str) -> str:
    label = re.sub(r"^(e\.g\.,?\s*|your\s+|brief\s+|specify\s*)", "", label.strip(),
                   flags=re.IGNORECASE)
    return f"[{label}]" if label else "[Unknown field]"


def fill_template(text: str, fields: dict[str, str]) -> FillResult:
    """Substitute every known placeholder; keep unknown ones. One-line list of
    missing fields is appended at the end of the finished document."""
    result = FillResult(text="")
    missing: list[str] = []

    def substitute(label: str) -> str:
        key = canonical_field(label)
        if key and fields.get(key):
            if key not in result.filled:
                result.filled.append(key)
            return fields[key]
        missing.append(_clean_label(label))
        return f"[{label}]"

    def bracket_repl(match: re.Match) -> str:
        inner = match.group(1)
        if _CHECKBOX.match(match.group(0)):
            return match.group(0)
        return substitute(inner)

    filled = text

    # 1. Literal sample values already present in the rough draft.
    for sample, key in SAMPLE_VALUES.items():
        if fields.get(key):
            filled = filled.replace(sample, fields[key])
    # 2. `{{ field }}` tokens.
    def braces_repl(m: re.Match) -> str:
        key = m.group(1).strip().lower()
        if fields.get(key):
            result.filled.append(key)
            return fields[key]
        return substitute(key.replace("_", " "))
    filled = _BRACES.sub(braces_repl, filled)
    # 3. `add_user_name_here` style tokens not covered by the sample map.
    def token_repl(m: re.Match) -> str:
        return substitute(m.group(1).replace("_", " "))
    filled = _TOKEN.sub(token_repl, filled)
    # 4. Bracket placeholders (checkboxes preserved).
    filled = _BRACKET.sub(bracket_repl, filled)

    result.missing = list(dict.fromkeys(missing))
    if result.missing:
        filled = filled.rstrip() + "\n\nMissing fields (fill before sending): " + ", ".join(result.missing)
    result.text = filled
    return result


# --------------------------------------------------------------- templates
@dataclass
class TemplateDoc:
    kind: str
    title: str
    text: str
    source: str            # "builtin" or "uploaded:<id>"
    document_id: int | None = None


_SEPARATOR = re.compile(r"^\s*={10,}\s*$", re.MULTILINE)


def _kind_for(header: str, body: str) -> str:
    low = (header + " " + body[:200]).lower()
    if "email" in header.lower() or "subject:" in body[:300].lower():
        return "email"
    if "table" in header.lower() or "tabular" in low:
        return "table"
    if "policy" in header.lower():
        return "policy"
    if "form" in header.lower() or "request" in header.lower() or "application" in header.lower():
        return "form"
    return "form" if "leave" in low or "employee" in low else "other"


def split_sections(text: str) -> list[TemplateDoc]:
    """Split a rough template file into sections. A title line sandwiched
    between ===== separator lines labels the body block that follows it."""
    blocks = [b.strip() for b in _SEPARATOR.split(text)]
    blocks = [b for b in blocks if b]
    sections: list[TemplateDoc] = []
    pending_title = ""
    for block in blocks:
        is_title = "\n" not in block and len(block) < 160 and not block.startswith("*")
        if is_title and not pending_title:
            pending_title = block
            continue
        title = pending_title or (block.splitlines()[0][:160] if is_title else "Document")
        pending_title = ""
        sections.append(TemplateDoc(kind=_kind_for(title, block), title=title,
                                    text=block.strip(), source="builtin"))
    if pending_title and sections:
        sections[-1].title = pending_title
    if not sections and text.strip():
        sections.append(TemplateDoc(
            kind="email" if "subject:" in text[:400].lower() else "form",
            title="Document", text=text.strip(), source="builtin"))
    return sections


def template_root() -> str:
    return os.getenv("DOCGEN_TEMPLATE_DIR") or str(settings.BASE_DIR.parent)


def load_builtin_templates() -> list[TemplateDoc]:
    """Read rough template files from the repo root / a templates directory.

    Only known template-like files are considered (name contains template,
    form, email, leave, or is explicitly configured). Never arbitrary files.
    """
    root = template_root()
    names: list[str] = []
    env_names = os.getenv("DOCGEN_TEMPLATE_FILES", "leave_request_form.txt")
    names.extend(n.strip() for n in env_names.split(",") if n.strip())
    for folder in (root, os.path.join(root, "templates")):
        if not os.path.isdir(folder):
            continue
        for fname in sorted(os.listdir(folder)):
            if fname in names:
                continue
            low = fname.lower()
            if low.endswith((".txt", ".md")) and any(
                    w in low for w in ("template", "form", "email", "leave")):
                names.append(fname)

    out: list[TemplateDoc] = []
    for name in names:
        for folder in (root, os.path.join(root, "templates")):
            path = os.path.join(folder, os.path.basename(name))
            if not os.path.isfile(path):
                continue
            try:
                with open(path, "r", encoding="utf-8") as fh:
                    text = fh.read(2_000_000)
            except OSError:
                continue
            for sec in split_sections(text):
                sec.title = sec.title or name
                out.append(sec)
            break
    return out


def whole_template_text(doc) -> str:
    """Return the WHOLE template document (not chunks). Uses the cached
    extraction from indexing, falling back to a direct file read."""
    cached = (getattr(doc, "preview_text", "") or "").strip()
    if cached:
        return cached
    from . import storage, rag
    try:
        raw = storage.read_bytes(doc.stored_path, base_dir=settings.DATA_DIR)
        return rag.extract_text(raw, doc.filename, doc.content_type) or ""
    except Exception:
        return ""


def collect_uploaded_templates(user, kinds: list[str]) -> list[TemplateDoc]:
    """Company-owned templates the user is allowed to see. Isolation is the
    same ACL used by document retrieval — never another company's templates."""
    from .models import Document
    from .rag import accessible_doc_ids

    allowed = accessible_doc_ids(user)
    if not allowed:
        return []
    qs = Document.objects.filter(id__in=allowed, is_template=True)
    if kinds and "other" not in kinds:
        qs = qs.filter(template_type__in=kinds)
    out: list[TemplateDoc] = []
    for doc in qs[:20]:
        text = whole_template_text(doc)
        if text.strip():
            out.append(TemplateDoc(
                kind=doc.template_type or "other",
                title=doc.filename, text=text,
                source=f"uploaded:{doc.id}", document_id=doc.id,
            ))
    return out


# ------------------------------------------------------------- request plan
FORM_WORDS = ("form", "farms", "application form", "blank form", "leave form",
              "application", "form bhar", "form bana", "form chahiye")
EMAIL_WORDS = ("email", "e-mail", "mail", "draft", "message to", "subject",
               "email likh", "mail likh", "email bhej", "email chahiye")
TABLE_WORDS = ("table", "tabular", "rows and columns", "table bana")
GENERATE_WORDS = ("draft", "generate", "fill", "create", "make", "prepare",
                  "ready", "bana", "likh", "bhar", "chahiye", "do", "kar do",
                  "send", "download", "copy")
TEXT_WORDS = ("what is", "what are", "explain", "tell me", "summar", "policy",
              "rules", "guidelines", "plain text", "text only", "answer",
              "kya hai", "batao", "batana", "maloom", "policy batao")
BOTH_WORDS = (" and ", " also ", " plus ", "dono", "aur ", "saath", "with the", "+" )
QUESTION_MARKS = ("?", "؟", "kya", "kaise", "how", "why", "when")

VALID_OUTPUTS = ("text", "form", "email", "policy", "table")


@dataclass
class RequestPlan:
    outputs: list[str]
    text_requested: bool
    artifacts: list[str]

    @property
    def artifacts_only(self) -> bool:
        return bool(self.artifacts) and not self.text_requested


def classify(question: str, outputs: list[str] | None = None) -> RequestPlan:
    """Decide which outputs the user actually asked for. Rule-based so it works
    without an LLM and is fully testable (including Roman Urdu cues)."""
    if outputs:
        clean = [o for o in outputs if o in VALID_OUTPUTS]
        text = "text" in clean
        arts = [o for o in clean if o != "text"]
        if not clean:
            return RequestPlan(outputs=["text"], text_requested=True, artifacts=[])
        return RequestPlan(outputs=clean, text_requested=text, artifacts=arts)

    low = (question or "").lower()
    wants_form = any(w in low for w in FORM_WORDS)
    wants_email = any(w in low for w in EMAIL_WORDS)
    wants_table = any(w in low for w in TABLE_WORDS)
    generates = any(w in low for w in GENERATE_WORDS)
    asks_policy = any(w in low for w in ("policy", "rules", "guidelines", "policy text"))
    asks_text = any(w in low for w in TEXT_WORDS)
    looks_like_question = any(m in low for m in QUESTION_MARKS)
    multiple = any(w in low for w in BOTH_WORDS)

    artifacts: list[str] = []
    if wants_form:
        artifacts.append("form")
    if wants_email:
        artifacts.append("email")
    if wants_table:
        artifacts.append("table")
    if asks_policy and generates and not wants_form and not wants_email:
        artifacts.append("policy")

    if artifacts:
        # A form/email request is an artifact request. Text is added only when
        # the user also asks for policy/plain text, or explicitly asks a
        # question alongside ("and also tell me the policy").
        text_requested = bool(
            (asks_text or looks_like_question or "text" in low or "policy" in low)
            and (multiple or "text" in low or asks_text)
        )
    else:
        text_requested = True  # backwards-compatible default: RAG answer

    return RequestPlan(outputs=(["text"] if text_requested else []) + artifacts,
                       text_requested=text_requested, artifacts=artifacts)


# ---------------------------------------------------------------- rendering
def _parse_structured(kind: str, title: str, text: str) -> dict:
    """Structured JSON for forms/tables; every artifact also carries Markdown
    so the frontend can always fall back to rendering text."""
    sections: list[dict] = []
    current: dict | None = None
    subject = ""
    table_rows: list[list[str]] = []
    for raw in text.splitlines():
        line = raw.strip()
        if not line or set(line) <= set("=-"):
            continue
        subj = re.match(r"^subject:\s*(.+)$", line, re.IGNORECASE)
        if subj:
            subject = subj.group(1).strip()
            continue
        head = re.match(r"^(\d+\.|[A-Z][A-Z /&-]{3,})\s*(.*)$", line)
        if head and not line.startswith("*") and not line.startswith("[") and "|" not in line:
            label = line.rstrip("-").strip()
            current = {"heading": label, "fields": [], "checkboxes": []}
            sections.append(current)
            continue
        if "|" in line and line.count("|") >= 2:
            cells = [c.strip() for c in line.strip("|").split("|")]
            if not all(set(c) <= set("-: ") for c in cells):
                table_rows.append(cells)
            continue
        if current is None:
            current = {"heading": "Document", "fields": [], "checkboxes": []}
            sections.append(current)
        cb = re.match(r"^[*\-]?\s*\[([ xX]?)\]\s*(.+)$", line)
        if cb:
            current["checkboxes"].append({"checked": cb.group(1).strip().lower() == "x",
                                          "label": cb.group(2).strip()})
            continue
        fld = re.match(r"^[*\-]\s*([^:]+):\s*(.*)$", line)
        if fld and "[" not in fld.group(1):
            value = fld.group(2).strip()
            current["fields"].append({
                "label": fld.group(1).strip(),
                "value": value,
                "placeholder": bool(_BRACKET.search(value)),
            })
            continue
        current.setdefault("lines", []).append(line)

    md_lines: list[str] = []
    if subject:
        md_lines.append(f"**Subject:** {subject}")
        md_lines.append("")
    for sec in sections:
        md_lines.append(f"**{sec['heading']}**")
        for f in sec["fields"]:
            md_lines.append(f"- **{f['label']}:** {f['value']}")
        for cb in sec["checkboxes"]:
            md_lines.append(f"- [ ] {cb['label']}")
        for extra in sec.get("lines", []):
            md_lines.append(extra)
        md_lines.append("")
    if table_rows:
        md_lines.append("")
        header = table_rows[0]
        md_lines.append("| " + " | ".join(header) + " |")
        md_lines.append("| " + " | ".join(["---"] * len(header)) + " |")
        for row in table_rows[1:]:
            md_lines.append("| " + " | ".join(row) + " |")
    missing_line = next((l for l in text.splitlines()
                         if l.startswith("Missing fields (fill before sending):")), "")
    if kind in ("email", "text"):
        # Emails must stay copy/paste/send ready: keep the author's exact line
        # order instead of regrouping fields into a list.
        ordered: list[str] = []
        for raw in text.splitlines():
            line = raw.rstrip()
            if not line.strip():
                ordered.append("")
                continue
            if re.match(r"^subject:\s*", line, re.IGNORECASE):
                ordered.append("**" + line + "**")
            elif re.match(r"^[-*]\s+", line.strip()) or "|" in line:
                ordered.append(line)
            else:
                ordered.append(line)
        markdown = "\n".join(ordered).strip()
    else:
        markdown = "\n".join(md_lines).strip() or text
    if missing_line:
        markdown += f"\n\n_{missing_line}_"

    return {
        "kind": kind,
        "title": title,
        "subject": subject,
        "sections": sections,
        "table": table_rows or None,
        "markdown": markdown,
        "missing_fields": [m.strip() for m in
                           missing_line.split(":", 1)[1].split(",")] if missing_line else [],
    }


def render_artifact(template: TemplateDoc, fields: dict[str, str],
                    overrides: dict | None = None) -> dict:
    filled = fill_template(template.text, fields)
    title = fill_template(template.title, fields).text.strip()
    structured = _parse_structured(template.kind, title, filled.text)
    return {
        "kind": template.kind,
        "title": title,
        "subject": structured.get("subject", ""),
        "content_md": structured["markdown"],
        "raw_text": filled.text,
        "structured": structured,
        "missing_fields": filled.missing,
        "filled_fields": sorted(set(filled.filled)),
        "source": template.source,
        "source_template_id": template.document_id,
    }


def build_artifacts(user, question: str, plan: RequestPlan,
                    overrides: dict | None = None) -> list[dict]:
    """Pick templates (uploaded company templates first, then the rough root
    file), fill them, and return the finished documents. No model calls."""
    fields = resolve_fields(user, overrides)
    wanted = plan.artifacts or ["form", "email"]
    templates: list[TemplateDoc] = collect_uploaded_templates(user, wanted)
    builtin = load_builtin_templates()

    out: list[dict] = []
    for kind in wanted:
        candidates = [t for t in templates if t.kind == kind]
        if not candidates:
            candidates = [t for t in builtin if t.kind == kind]
        if not candidates and kind == "policy":
            candidates = [t for t in builtin if t.kind in ("policy", "form")]
        if not candidates:
            # Last resort: a generic builtin section, never an invented doc.
            candidates = builtin[:1]
        for tpl in candidates[:1]:
            out.append(render_artifact(tpl, fields, overrides))
    return out


# --------------------------------------------------------------- prompt rules
TEMPLATE_SYSTEM_RULES = (
    "DOCUMENT GENERATION MODE. A template document has been supplied in the "
    "context. Follow these rules exactly:\n"
    "1. Fill only fields whose values are given in the profile data below.\n"
    "2. Leave unknown fields as [Field name] placeholders — never guess.\n"
    "3. List all missing fields on ONE line at the end.\n"
    "4. Output ONLY the finished document. No commentary, no preamble, no "
    "explanation of what you did.\n"
    "5. Never invent facts, dates, names, numbers or policy details.\n"
    "6. Keep the template's structure, headings, order and wording intact."
)


def profile_prompt_block(fields: dict[str, str]) -> str:
    """Only non-empty profile fields ever enter a prompt. Values are never
    logged; this block is prompt-only."""
    if not fields:
        return ""
    lines = ["PROFILE DATA (use only these values):"]
    for key in ("full_name", "title", "role", "department", "manager",
                "employee_id", "join_date", "company_name", "hr_email",
                "signature", "tone", "email", "phone", "date"):
        if fields.get(key):
            lines.append(f"- {key}: {fields[key]}")
    return "\n".join(lines)


def template_context(user, plan: RequestPlan) -> str:
    """Whole template text for the prompt (never chunks). Empty when no
    template was requested."""
    if not plan.artifacts:
        return ""
    texts = [t.text for t in (collect_uploaded_templates(user, plan.artifacts)
                              or load_builtin_templates())]
    return "\n\n---\n\n".join(texts[:3])[:50_000]


# ------------------------------------------------------------------ storage
def save_artifact(user, rendered: dict) -> "GeneratedArtifact":
    from .models import GeneratedArtifact
    return GeneratedArtifact.objects.create(
        company=getattr(user, "company", None),
        user=user,
        kind=rendered["kind"] if rendered["kind"] in dict(GeneratedArtifact.KINDS) else "text",
        title=rendered.get("title", "")[:200],
        subject=rendered.get("subject", "")[:300],
        content_md=rendered.get("content_md", ""),
        structured=json.dumps(rendered.get("structured", {}), ensure_ascii=False),
        missing_fields=json.dumps(rendered.get("missing_fields", []), ensure_ascii=False),
        source_template_id=rendered.get("source_template_id"),
    )


def artifact_download_bytes(artifact, fmt: str) -> tuple[bytes, str, str]:
    """Render an artifact as md / txt / docx / pdf / html. Raises ValueError
    for an unsupported format — callers turn that into a clean 400."""
    md = artifact.content_md or ""
    title = artifact.title or "OpenVault document"
    if fmt == "md":
        return md.encode("utf-8"), "text/markdown; charset=utf-8", f"{title}.md"
    if fmt == "txt":
        plain = _markdown_to_plain(md)
        return plain.encode("utf-8"), "text/plain; charset=utf-8", f"{title}.txt"
    if fmt == "html":
        return _markdown_to_html(md, title).encode("utf-8"), "text/html; charset=utf-8", f"{title}.html"
    if fmt == "json":
        return (artifact.structured or "{}").encode("utf-8"), "application/json", f"{title}.json"
    if fmt == "docx":
        return _to_docx(md, title), (
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document"), f"{title}.docx"
    if fmt == "pdf":
        return _to_pdf(md, title), "application/pdf", f"{title}.pdf"
    raise ValueError(f"unsupported format: {fmt}")


def _markdown_to_plain(md: str) -> str:
    text = re.sub(r"\*\*([^*]+)\*\*", r"\1", md)
    text = re.sub(r"^#{1,6}\s+", "", text, flags=re.MULTILINE)
    text = re.sub(r"^\s*[-*]\s+", "- ", text, flags=re.MULTILINE)
    text = re.sub(r"\|", "  ", text)
    text = re.sub(r"^_{1,2}(.*?)_{1,2}$", r"\1", text, flags=re.MULTILINE)
    return text.strip()


def _markdown_to_html(md: str, title: str) -> str:
    """Small allowlist HTML renderer (no raw HTML from the template can pass)."""
    import html as _html
    lines = []
    in_ul = False
    for raw in md.splitlines():
        line = raw.rstrip()
        if not line.strip():
            if in_ul:
                lines.append("</ul>")
                in_ul = False
            lines.append("<br>")
            continue
        item = re.match(r"^[-*]\s+(.*)$", line.strip())
        if item:
            if not in_ul:
                lines.append("<ul>")
                in_ul = True
            lines.append("<li>" + _html.escape(item.group(1)) + "</li>")
            continue
        if in_ul:
            lines.append("</ul>")
            in_ul = False
        safe = _html.escape(line)
        safe = re.sub(r"\*\*([^*]+)\*\*", r"<strong>\1</strong>", safe)
        lines.append("<p>" + safe + "</p>")
    if in_ul:
        lines.append("</ul>")
    body = "\n".join(lines)
    return ("<!doctype html><html><head><meta charset='utf-8'><title>"
            + _html.escape(title) + "</title></head><body>" + body + "</body></html>")


def _to_docx(md: str, title: str) -> bytes:
    from docx import Document as Docx
    import io as _io
    doc = Docx()
    doc.add_heading(title, level=1)
    if md.startswith("**Subject:**"):
        first, _, rest = md.partition("\n")
        doc.add_paragraph(first.replace("**", ""), style="Subtitle")
        md = rest
    for line in md.splitlines():
        clean = _markdown_to_plain(line)
        if not clean:
            continue
        item = re.match(r"^[-*]\s+(.*)$", line.strip())
        if item:
            doc.add_paragraph(_markdown_to_plain(item.group(1)), style="List Bullet")
        elif line.strip().startswith("**") and line.strip().endswith("**"):
            doc.add_paragraph(clean, style="Heading 2")
        else:
            doc.add_paragraph(clean)
    buf = _io.BytesIO()
    doc.save(buf)
    return buf.getvalue()


def _to_pdf(md: str, title: str) -> bytes:
    from fpdf import FPDF
    pdf = FPDF()
    pdf.set_auto_page_break(auto=True, margin=15)
    pdf.add_page()
    pdf.set_font("Helvetica", "B", 14)
    pdf.multi_cell(0, 8, title)
    pdf.ln(3)
    pdf.set_font("Helvetica", "", 10)
    for line in md.splitlines():
        clean = _markdown_to_plain(line)
        if not clean:
            pdf.ln(2)
            continue
        # latin-1 safe: replace characters FPDF's core fonts can't encode.
        clean = clean.encode("latin-1", "replace").decode("latin-1")
        pdf.set_x(pdf.l_margin)
        # explicit width + cursor reset: multi_cell(0, ...) leaves x at the
        # right margin and the next line would have no horizontal space.
        pdf.multi_cell(pdf.epw, 6, clean, new_x="LMARGIN", new_y="NEXT")
    return bytes(pdf.output())
