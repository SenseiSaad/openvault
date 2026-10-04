"""Project-level API landing page."""
from django.http import HttpResponse

_LANDING_HTML = """<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>OpenVault API</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px;background:#f7f6f2;color:#20211f;font-family:Inter,system-ui,sans-serif}.card{max-width:680px;padding:44px;border:1px solid #dedbd3;border-radius:28px;background:#fffdfa;box-shadow:0 18px 60px #20211f12}.brand{font-size:28px;font-weight:700;letter-spacing:-.05em}.muted{color:#77746c;line-height:1.65}.links{display:flex;gap:12px;flex-wrap:wrap;margin-top:28px}a{padding:12px 18px;border-radius:999px;text-decoration:none;font-size:14px;font-weight:600;background:#20211f;color:white}a.alt{background:#f0ede5;color:#20211f}</style></head>
<body><main class="card"><div class="brand">OpenVault</div><h1>Private knowledge infrastructure for registered companies.</h1><p class="muted">This is the Django API service. The product landing page is served by the frontend. OpenVault keeps employer documents private, supports permission-aware AI answers, and records controlled cross-company sharing.</p><div class="links"><a id="site" href="#">Open product landing page →</a><a class="alt" href="/admin/">Django admin</a></div><p class="muted"><small>API endpoints live under <code>/api/</code>. Public browsing and free-user accounts are not enabled.</small></p></main><script>document.getElementById('site').href=window.location.protocol+'//'+window.location.hostname+':3000/';</script></body></html>"""


def landing(request):
    return HttpResponse(_LANDING_HTML)
