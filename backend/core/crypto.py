"""Encryption at rest for provider secrets (LLM API keys).

Ciphertext is prefixed with ``enc:v1:`` so existing plaintext rows keep working
and are transparently encrypted the next time they are saved. The key is derived
from ``LLM_KEY_ENCRYPTION_KEY`` when set, otherwise from ``SECRET_KEY``.

Rotating the encryption key invalidates stored ciphertext: rotate deliberately,
re-enter the provider keys once, and keep a backup of the key material.
"""
import base64
import hashlib

from cryptography.fernet import Fernet, InvalidToken
from django.conf import settings

PREFIX = "enc:v1:"


def _fernet() -> Fernet:
    material = getattr(settings, "LLM_KEY_ENCRYPTION_KEY", "") or settings.SECRET_KEY
    digest = hashlib.sha256(f"{material}:openvault-llm-key".encode()).digest()
    return Fernet(base64.urlsafe_b64encode(digest))


def encrypt_secret(raw: str) -> str:
    """Encrypt a secret for storage. Empty/invalid input stays empty."""
    if not raw:
        return ""
    if raw.startswith(PREFIX):
        return raw  # already encrypted (idempotent)
    return PREFIX + _fernet().encrypt(raw.encode("utf-8")).decode("ascii")


def decrypt_secret(stored: str) -> str:
    """Decrypt a stored secret; legacy plaintext values are returned unchanged.

    A key rotation or corrupted value must not crash every request, so an
    undecryptable value is treated as "not configured".
    """
    if not stored:
        return ""
    if not stored.startswith(PREFIX):
        return stored
    try:
        return _fernet().decrypt(stored[len(PREFIX):].encode("ascii")).decode("utf-8")
    except (InvalidToken, ValueError):
        return ""
