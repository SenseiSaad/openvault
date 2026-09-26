"""Project-level views. The root landing page served at port 8000 `/`."""
from django.http import HttpResponse

_LANDING_HTML = """<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>SecureKB</title>
<style>
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body {
    margin: 0; font-family: -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif;
    background: linear-gradient(135deg, #eef1fb 0%, #f7f8fc 100%); color: #1f2430;
    min-height: 100vh; display: grid; place-items: center; padding: 24px;
  }
  .card {
    background: #fff; border-radius: 16px; padding: 40px; max-width: 620px; width: 100%;
    box-shadow: 0 12px 40px rgba(59,91,219,.14); border: 1px solid #eceefb;
  }
  .brand { font-size: 26px; font-weight: 800; color: #3b5bdb; margin: 0 0 6px; }
  .tag { color: #6b7280; margin: 0 0 24px; line-height: 1.5; }
  ul { color: #4b5563; line-height: 1.7; padding-left: 20px; margin: 0 0 28px; }
  .btns { display: flex; gap: 12px; flex-wrap: wrap; }
  a.btn {
    display: inline-block; text-decoration: none; padding: 12px 20px; border-radius: 10px;
    font-weight: 600; font-size: 15px;
  }
  .primary { background: #3b5bdb; color: #fff; }
  .primary:hover { background: #314fc0; }
  .ghost { background: #f1f3fb; color: #3b5bdb; border: 1px solid #dfe3f7; }
  .ghost:hover { background: #e7ebfb; }
  .foot { margin-top: 26px; font-size: 13px; color: #9aa1ad; }
  code { background: #f1f3fb; padding: 2px 6px; border-radius: 6px; }
</style>
</head>
<body>
  <div class="card">
    <p class="brand">&#128272; SecureKB</p>
    <p class="tag">
      A secure, multi-tenant private knowledge platform. Companies publish open
      documents to the public site, while employees privately ask questions
      answered only from their own company&#39;s documents by a locally-run AI model.
    </p>
    <ul>
      <li>Browse &amp; search open documents &mdash; no account needed</li>
      <li>Per-company data isolation, audit logging &amp; prompt-injection defense</li>
      <li>Retrieval-augmented answers grounded in your own files</li>
    </ul>
    <div class="btns">
      <a class="btn primary" id="site" href="#">Open the public site &rarr;</a>
      <a class="btn ghost" href="/admin/">Django admin sign-in</a>
    </div>
    <p class="foot">
      This page is the API server root. The public website runs on port
      <code>3000</code>. API lives under <code>/api/</code>.
    </p>
  </div>
  <script>
    // Point at the frontend on the same host so it also works over the LAN.
    document.getElementById('site').href =
      window.location.protocol + '//' + window.location.hostname + ':3000/';
  </script>
</body>
</html>"""


def landing(request):
    return HttpResponse(_LANDING_HTML)
