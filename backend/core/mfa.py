"""TOTP two-factor authentication (RFC 6238) — standard library only.

Used to add a second step to platform-admin sign-ins, both on the API
(/api/auth/login returns an mfa_required challenge; /api/auth/mfa/verify
completes it) and on Django /admin/ (core.middleware gates the admin behind a
session check backed by these helpers).

The shared secret is stored on the user row via EncryptedCharField and never
leaves the server after enrollment. Challenge tokens are Django-signed blobs
with a 5-minute life — they only confirm "this person knows the PASSWORD";
they cannot complete a login by themselves.
"""
from __future__ import annotations

import base64
import hashlib
import hmac
import secrets
import struct
import time
from urllib.parse import quote

from django.core import signing

CHALLENGE_SALT = "openvault.mfa.challenge"
CHALLENGE_MAX_AGE = 300  # seconds to finish the second step


def generate_secret() -> str:
    """A 160-bit base32 secret as accepted by every authenticator app."""
    return base64.b32encode(secrets.token_bytes(20)).decode("ascii").rstrip("=")


def provisioning_uri(secret: str, email: str, issuer: str = "OpenVault") -> str:
    """The otpauth:// URI QR codes and manual entry both consume."""
    label = quote(f"{issuer}:{email}")
    return (
        f"otpauth://totp/{label}?secret={secret}&issuer={quote(issuer)}"
        "&algorithm=SHA1&digits=6&period=30"
    )


def _code_at(secret: str, step: int) -> str:
    key = base64.b32decode(secret + "=" * ((8 - len(secret) % 8) % 8), casefold=True)
    digest = hmac.new(key, struct.pack(">Q", step), hashlib.sha1).digest()
    offset = digest[-1] & 0x0F
    value = (struct.unpack(">I", digest[offset:offset + 4])[0] & 0x7FFFFFFF) % 1_000_000
    return f"{value:06d}"


def verify_code(secret: str, code: str, window: int = 1) -> bool:
    """True when `code` matches the TOTP for the current or ±window 30s steps."""
    clean = str(code or "").replace(" ", "").strip()
    if not secret or not clean.isdigit() or len(clean) != 6:
        return False
    current = int(time.time()) // 30
    for step in range(current - window, current + window + 1):
        if hmac.compare_digest(_code_at(secret, step), clean):
            return True
    return False


def issue_challenge(user_pk: int, purpose: str, secret: str = "") -> str:
    """A short-lived signed blob tying a pending second step to one user."""
    signer = signing.TimestampSigner(salt=CHALLENGE_SALT)
    return signer.sign_object({"u": user_pk, "p": purpose, "s": secret})


def read_challenge(token: str, purpose: str) -> dict | None:
    """The challenge payload when valid, unexpired and purpose-matching."""
    try:
        signer = signing.TimestampSigner(salt=CHALLENGE_SALT)
        payload = signer.unsign_object(token, max_age=CHALLENGE_MAX_AGE)
    except (signing.BadSignature, signing.SignatureExpired):
        return None
    if not isinstance(payload, dict) or payload.get("p") != purpose:
        return None
    return payload
