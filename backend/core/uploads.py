"""Upload validation: extension allowlist, decompression-bomb and size guards.

Every uploaded byte eventually reaches `rag.extract_text` — through indexing,
preview, or versioning — so the expensive checks (PDF page cap, extracted-text
cap, zip-bomb guard) live in the extraction path where they cannot be skipped,
and the cheap checks (extension, filename length) run in the views so a bad
file is rejected with a clean 400 before it is stored.
"""
from __future__ import annotations

import io
import zipfile

# Only these extensions may be uploaded. The list doubles as the map to
# extract_text's parsers; anything else is rejected at the API boundary.
ALLOWED_EXTENSIONS = {
    ".pdf", ".docx", ".pptx", ".txt", ".md", ".csv", ".png", ".jpg", ".jpeg",
}
MAX_FILENAME_LENGTH = 255

# Extraction caps. A 500-page scanned PDF or a 40GB-expanded DOCX must cost a
# bounded amount of CPU/RAM no matter who uploaded it.
MAX_PDF_PAGES = 500
MAX_EXTRACTED_CHARS = 2_000_000  # 2MB of text ≈ 500k tokens — far above any chunk need

# Zip-bomb guards for the OOXML formats (docx/pptx are zip archives).
MAX_UNCOMPRESSED_BYTES = 256 * 1024 * 1024
MAX_COMPRESSION_RATIO = 200


class UploadRejected(ValueError):
    """A user-facing upload rejection; views turn this into a 400 response."""


def validate_filename(filename: str) -> str:
    """Return the cleaned basename, rejecting empty/oversized names."""
    import os

    name = os.path.basename(str(filename or "").strip())
    if not name:
        raise UploadRejected("A file with a valid name is required.")
    if len(name) > MAX_FILENAME_LENGTH:
        raise UploadRejected(
            f"Filename is too long (max {MAX_FILENAME_LENGTH} characters)."
        )
    return name


def validate_extension(filename: str) -> str:
    """Return the lowercased extension when allowlisted, else raise."""
    name = (filename or "").lower()
    dot = name.rfind(".")
    ext = name[dot:] if dot >= 0 else ""
    if ext not in ALLOWED_EXTENSIONS:
        allowed = ", ".join(sorted(ALLOWED_EXTENSIONS))
        raise UploadRejected(
            f"File type '{ext or 'unknown'}' is not supported. Allowed: {allowed}."
        )
    return ext


def guard_zip_archive(raw: bytes) -> None:
    """Reject zip archives (docx/pptx) whose decompressed size is absurd.

    A small malicious .docx can expand to gigabytes and exhaust memory during
    parsing; the compressed/uncompressed sizes are declared in the zip central
    directory, so the check costs nothing and needs no decompression.
    """
    if len(raw) < 4 or raw[:2] != b"PK":
        return
    try:
        with zipfile.ZipFile(io.BytesIO(raw)) as zf:
            total = sum(info.file_size for info in zf.infolist())
    except zipfile.BadZipFile:
        raise UploadRejected("The document archive is corrupt.")
    if total > MAX_UNCOMPRESSED_BYTES:
        raise UploadRejected(
            "The document expands to more than the supported size limit."
        )
    if len(raw) > 0 and total / len(raw) > MAX_COMPRESSION_RATIO:
        raise UploadRejected("The document archive has an unsafe compression ratio.")


def truncate_text(text: str) -> str:
    """Hard cap on extracted text so no single file can flood memory/DB."""
    if text and len(text) > MAX_EXTRACTED_CHARS:
        return text[:MAX_EXTRACTED_CHARS]
    return text
