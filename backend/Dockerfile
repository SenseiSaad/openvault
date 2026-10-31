# OpenVault API — Django + gunicorn. Build from the repo ROOT:
#   docker build -f backend/Dockerfile -t openvault-api .
FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_DEFAULT_TIMEOUT=120

WORKDIR /app

# System deps: libpq for PostgreSQL, curl for the container healthcheck.
# Optional OCR (pytesseract/pdf2image) needs tesseract+poppler; not installed here.
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 curl gosu \
    && rm -rf /var/lib/apt/lists/*

COPY backend/requirements.txt .
RUN --mount=type=cache,target=/root/.cache/pip \
    pip install --retries 8 --timeout 120 -r requirements.txt

COPY backend/ .
COPY backend/render-entrypoint.sh /usr/local/bin/render-entrypoint

# Data (uploaded documents) + media (generated forms) + static are volumes in compose.
RUN mkdir -p /app/data /app/media /app/staticfiles /var/data/documents /var/data/media/forms \
    && SECRET_KEY="$(python -c 'import secrets; print(secrets.token_urlsafe(48))')" python manage.py collectstatic --noinput \
    && addgroup --system --gid 10001 app \
    && adduser --system --uid 10001 --ingroup app --home /app app \
    && chown -R app:app /app /var/data \
    && chmod 0755 /usr/local/bin/render-entrypoint

# The entrypoint starts as root only long enough to ensure mounted Render or
# Compose data directories are writable, then drops privileges to the app user.
USER root
ENTRYPOINT ["/usr/local/bin/render-entrypoint"]

EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD curl -fsS -H "X-Forwarded-Proto: https" "http://localhost:${PORT:-8000}/api/health" || exit 1

# Migrations and seed_plans run at container start. The optional bootstrap
# command creates the first platform admin from Render secret env vars.
# Scale with GUNICORN_WORKERS / GUNICORN_THREADS (2 x CPU + 1 is a good default).
CMD ["sh", "-c", "python manage.py migrate --noinput && python manage.py seed_plans && python manage.py bootstrap_platform_admin && exec gunicorn config.wsgi:application --bind 0.0.0.0:${PORT:-8000} --workers ${GUNICORN_WORKERS:-2} --threads ${GUNICORN_THREADS:-4} --timeout 300 --access-logfile - --error-logfile -"]
