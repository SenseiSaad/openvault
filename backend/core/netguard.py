"""Outbound URL validation for tenant-supplied endpoints (SSRF defence).

A company admin with a BYO-key plan can set `LLMConfig.base_url`. Without
validation that URL is fetched by the server, which makes it a pivot into the
internal network and cloud metadata (169.254.169.254). Rules:

* https only (http is tolerated only when the caller explicitly allows it —
  platform operators' env defaults, never tenant input in production),
* the hostname must resolve, and EVERY resolved IP must be public,
* loopback / private / link-local / reserved / multicast ranges are rejected,
  which covers 127.0.0.1, 10.x, 172.16-31.x, 192.168.x, 169.254.x (metadata),
  ::1, fc00::/7 and fe80::/10.
"""
from __future__ import annotations

import ipaddress
import socket
from urllib.parse import urlparse


class UnsafeURLError(ValueError):
    """Raised when a URL must not be fetched by the server."""


def _ip_allowed(ip: str) -> bool:
    try:
        addr = ipaddress.ip_address(ip)
    except ValueError:
        return False
    return not (
        addr.is_private or addr.is_loopback or addr.is_link_local
        or addr.is_reserved or addr.is_multicast or addr.is_unspecified
    )


def validate_public_url(url: str, allow_http: bool = False) -> str:
    """Return the validated URL string, or raise UnsafeURLError."""
    raw = str(url or "").strip()
    if not raw:
        raise UnsafeURLError("A URL is required.")
    parsed = urlparse(raw)
    if parsed.scheme == "http" and allow_http:
        pass
    elif parsed.scheme != "https":
        raise UnsafeURLError("Only https:// endpoints are allowed.")
    host = parsed.hostname
    if not host:
        raise UnsafeURLError("The URL has no hostname.")
    if host.lower() in ("localhost", "metadata.google.internal"):
        raise UnsafeURLError("This host is not allowed.")
    try:
        infos = socket.getaddrinfo(host, parsed.port or (443 if parsed.scheme == "https" else 80),
                                   proto=socket.IPPROTO_TCP)
    except OSError:
        raise UnsafeURLError("The endpoint hostname could not be resolved.")
    ips = {info[4][0] for info in infos}
    if not ips:
        raise UnsafeURLError("The endpoint hostname could not be resolved.")
    bad = sorted(ip for ip in ips if not _ip_allowed(ip))
    if bad:
        raise UnsafeURLError("The endpoint must be a public internet host.")
    return raw
