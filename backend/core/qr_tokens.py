"""Signed, short-lived tokens for the attendance QR code.

The QR is just a URL; without a signature anybody who sees (or guesses) the
URL could mark attendance from anywhere. The token binds the QR to ONE company
for a short window (default 10 minutes), so a scan only counts when the
employee's account belongs to the company that displayed the QR, and only
while the code is fresh. Old broadcast QR images die automatically.
"""
from django.conf import settings
from django.core import signing

SALT = "openvault.attendance.qr"


def default_ttl() -> int:
    return int(getattr(settings, "ATTENDANCE_QR_TOKEN_TTL", 600))


def issue(company_id: int) -> str:
    signer = signing.TimestampSigner(salt=SALT)
    return signer.sign_object({"c": company_id})


def verify(token: str, company_id: int) -> bool:
    """True when the token is fresh, untampered and belongs to this company."""
    try:
        payload = signing.TimestampSigner(salt=SALT).unsign_object(
            str(token or ""), max_age=default_ttl())
    except (signing.BadSignature, signing.SignatureExpired):
        return False
    return isinstance(payload, dict) and payload.get("c") == company_id
