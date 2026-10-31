"""Celery application for OpenVault background work (indexing, requeues,
retention). Inactive unless CELERY_BROKER_URL is configured — without a broker
the app falls back to in-process threads so local/dev keeps working.
"""
import os

from celery import Celery

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

app = Celery("openvault")
app.config_from_object("django.conf:settings", namespace="CELERY")
app.autodiscover_tasks()
