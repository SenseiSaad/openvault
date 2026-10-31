"""Feature 4 — lightweight policy-violation detection for chat messages.

This is a defensive scanner: it looks at an incoming question for a few
well-known risky patterns (attempts to exfiltrate secrets or confidential data,
requests to share credentials, abusive/toxic language, and clear policy-bypass
phrasing). It never blocks the conversation on its own; the caller decides what
to do with the result (we log an AuditLog row and surface a flag to the user).

Kept deliberately simple and dependency-free: case-insensitive regexes with word
boundaries to keep false positives low. The goal is useful signal, not a perfect
classifier.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field

# Each category maps to a list of compiled patterns. Word boundaries (\b) keep
# "class" from matching "classified", etc.
_RAW_PATTERNS: dict[str, list[str]] = {
    "data_leak": [
        r"\bconfidential\b.{0,30}\b(share|send|leak|forward|post|upload)\b",
        r"\b(share|send|leak|forward|post|upload)\b.{0,30}\bconfidential\b",
        r"\bleak(ed|ing)?\b",
        r"\bexfiltrat",
        r"\bdump\b.{0,20}\b(database|db|data|table)\b",
    ],
    "credential_exposure": [
        r"\b(api[\s_-]?key|secret[\s_-]?key|access[\s_-]?token|private[\s_-]?key)\b",
        r"\b(password|passwd|credentials?)\b.{0,20}\b(share|send|give|tell|reveal|show)\b",
        r"\b(share|send|give|tell|reveal|show)\b.{0,20}\b(password|passwd|credentials?)\b",
        r"\bssh[\s_-]?key\b",
    ],
    "pii_exposure": [
        # US SSN-style and generic 16-digit card numbers.
        r"\b\d{3}-\d{2}-\d{4}\b",
        r"\b(?:\d[ -]?){16}\b",
        # Pakistani identifiers: CNIC (XXXXX-XXXXXXX-X) and PK-format IBAN
        # (PK + 2 check digits + 22 chars) — the formats this product's users
        # are actually likely to paste.
        r"\b\d{5}-\d{7}-\d\b",
        r"\bPK\d{2}[A-Z0-9]{4}[A-Z0-9]{18}\b",
    ],
    "policy_bypass": [
        r"\b(bypass|circumvent|get around|override)\b.{0,25}\b(policy|policies|rule|rules|security|control)\b",
        r"\bignore\b.{0,25}\b(policy|policies|rule|rules|compliance)\b",
        r"\b(delete|wipe|erase|clear)\b.{0,20}\b(audit|logs?|records?)\b",
        r"\bdisable\b.{0,20}\b(audit|logging|security)\b",
    ],
    "toxic_language": [
        r"\b(idiot|stupid|moron|dumbass|shut up)\b",
        r"\bf[\*u]ck\b",
        r"\bb[\*i]tch\b",
        r"\basshole\b",
    ],
}

_COMPILED: dict[str, list[re.Pattern]] = {
    cat: [re.compile(p, re.IGNORECASE) for p in pats] for cat, pats in _RAW_PATTERNS.items()
}

# Human-readable labels for the categories, used in audit details and the UI flag.
_LABELS = {
    "data_leak": "possible confidential-data leak",
    "credential_exposure": "credential / secret sharing",
    "pii_exposure": "personal data (PII) exposure",
    "policy_bypass": "attempt to bypass policy or controls",
    "toxic_language": "abusive or toxic language",
}


@dataclass
class ModerationResult:
    flagged: bool = False
    categories: list[str] = field(default_factory=list)
    matches: list[str] = field(default_factory=list)

    @property
    def labels(self) -> list[str]:
        return [_LABELS.get(c, c) for c in self.categories]

    def summary(self) -> str:
        """Short, audit-friendly one-liner."""
        if not self.flagged:
            return ""
        return "; ".join(self.labels)


def scan(text: str) -> ModerationResult:
    """Scan a chat message and return which policy categories it tripped (if any)."""
    result = ModerationResult()
    if not text:
        return result
    for category, patterns in _COMPILED.items():
        for pattern in patterns:
            m = pattern.search(text)
            if m:
                result.categories.append(category)
                snippet = m.group(0).strip()
                # Keep audit snippets short and never store a full card/SSN value.
                if category == "pii_exposure":
                    snippet = "<redacted>"
                result.matches.append(snippet[:60])
                break  # one hit per category is enough
    result.flagged = bool(result.categories)
    return result
