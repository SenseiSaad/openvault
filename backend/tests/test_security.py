"""Security helpers: spoof-resistant client IP extraction."""
from core.ratelimit import _client_ip
from core.views import client_ip


def _request(rf, xff=None, remote="10.0.0.1"):
    extra = {"REMOTE_ADDR": remote}
    if xff is not None:
        extra["HTTP_X_FORWARDED_FOR"] = xff
    return rf.post("/api/auth/login", **extra)


def test_client_ip_uses_last_forwarded_value(rf):
    # A client-supplied prefix must not win; the proxy appends the real IP last.
    req = _request(rf, "1.2.3.4, 203.0.113.9")
    assert client_ip(req) == "203.0.113.9"
    assert _client_ip(req) == "203.0.113.9"


def test_client_ip_falls_back_to_remote_addr(rf):
    req = _request(rf, None, remote="192.0.2.7")
    assert client_ip(req) == "192.0.2.7"
    assert _client_ip(req) == "192.0.2.7"


def test_client_ip_ignores_empty_forwarded_header(rf):
    req = _request(rf, " , ")
    assert client_ip(req) == "10.0.0.1"
