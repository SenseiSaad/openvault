"""Vercel Python serverless entrypoint for the OpenVault Django API."""
import os
import sys
from pathlib import Path

# Ensure the backend root is on sys.path when invoked from api/index.py.
BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

from django.core.wsgi import get_wsgi_application  # noqa: E402

app = get_wsgi_application()
application = app
