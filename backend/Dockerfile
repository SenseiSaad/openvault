# OpenVault API — Django + gunicorn. Build from the repo ROOT:
#   docker build -f backend/Dockerfile -t openvault-api .
FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

WORKDIR /app

# System deps: libpq for psycopg2 if used; tesseract+poppler enable optional OCR.
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 curl \
    && rm -rf /var/lib/apt/lists/*

COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ .

# Data (uploaded documents) + media (generated forms) are volumes in compose.
RUN mkdir -p /app/data /app/media

EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s \
  CMD curl -fsS http://localhost:8000/api/health || exit 1

# migrate runs at container start (idempotent); seed_plans ensures tiers exist.
CMD ["sh", "-c", "python manage.py migrate --noinput && python manage.py seed_plans && gunicorn config.wsgi:application --bind 0.0.0.0:8000 --workers 3 --threads 2 --timeout 300"]
