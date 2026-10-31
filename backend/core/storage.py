"""Storage abstraction for OpenVault documents and generated workflow artefacts.

Supports two backends transparently:
1. Amazon S3 (configured when AWS_STORAGE_BUCKET_NAME is set in settings/env) —
   ideal for stateless serverless hosts like Vercel.
2. Local filesystem (default when AWS_STORAGE_BUCKET_NAME is blank) — used for
   local development, Docker Compose, and persistent-disk container hosts.
"""
from __future__ import annotations

import io
import os
from typing import BinaryIO

from django.conf import settings


def is_s3_enabled() -> bool:
    return bool(getattr(settings, "AWS_STORAGE_BUCKET_NAME", "").strip())


def _s3_client():
    import boto3

    kwargs: dict = {}
    region = getattr(settings, "AWS_S3_REGION_NAME", "").strip()
    if region:
        kwargs["region_name"] = region
    endpoint = getattr(settings, "AWS_S3_ENDPOINT_URL", "").strip()
    if endpoint:
        kwargs["endpoint_url"] = endpoint
    access_key = getattr(settings, "AWS_ACCESS_KEY_ID", "").strip()
    secret_key = getattr(settings, "AWS_SECRET_ACCESS_KEY", "").strip()
    if access_key and secret_key:
        kwargs["aws_access_key_id"] = access_key
        kwargs["aws_secret_access_key"] = secret_key
    return boto3.client("s3", **kwargs)


def _bucket() -> str:
    return getattr(settings, "AWS_STORAGE_BUCKET_NAME", "").strip()


def _resolve_local_path(key_or_path: str, base_dir: str | None = None) -> str:
    base = str(base_dir or settings.DATA_DIR)
    if os.path.isabs(key_or_path):
        return key_or_path
    return os.path.join(base, key_or_path)


def save_bytes(key: str, data: bytes, content_type: str = "", base_dir: str | None = None) -> str:
    """Save raw bytes under `key` (or absolute path if local) and return the stored key/path."""
    if is_s3_enabled():
        s3_key = key.lstrip("/")
        extra = {"ContentType": content_type} if content_type else {}
        _s3_client().put_object(Bucket=_bucket(), Key=s3_key, Body=data, **extra)
        return s3_key

    path = _resolve_local_path(key, base_dir=base_dir)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "wb") as out:
        out.write(data)
    return path


def save_uploaded_file(key: str, uploaded_file, base_dir: str | None = None) -> str:
    """Save a Django UploadedFile to storage and return the stored key/path."""
    if is_s3_enabled():
        chunks = b"".join(chunk for chunk in uploaded_file.chunks())
        return save_bytes(key, chunks, content_type=getattr(uploaded_file, "content_type", "") or "")

    path = _resolve_local_path(key, base_dir=base_dir)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "wb") as out:
        for chunk in uploaded_file.chunks():
            out.write(chunk)
    return path


def exists(key_or_path: str, base_dir: str | None = None) -> bool:
    if not key_or_path:
        return False
    if is_s3_enabled() and not os.path.exists(key_or_path):
        from botocore.exceptions import ClientError

        try:
            _s3_client().head_object(Bucket=_bucket(), Key=key_or_path.lstrip("/"))
            return True
        except ClientError:
            return False
    path = _resolve_local_path(key_or_path, base_dir=base_dir)
    return os.path.isfile(path)


def read_bytes(key_or_path: str, base_dir: str | None = None) -> bytes:
    if is_s3_enabled() and not os.path.exists(key_or_path):
        resp = _s3_client().get_object(Bucket=_bucket(), Key=key_or_path.lstrip("/"))
        return resp["Body"].read()
    path = _resolve_local_path(key_or_path, base_dir=base_dir)
    with open(path, "rb") as fh:
        return fh.read()


def open_stream(key_or_path: str, base_dir: str | None = None) -> BinaryIO:
    """Return a readable binary file-like object suitable for FileResponse."""
    if is_s3_enabled() and not os.path.exists(key_or_path):
        data = read_bytes(key_or_path, base_dir=base_dir)
        return io.BytesIO(data)
    path = _resolve_local_path(key_or_path, base_dir=base_dir)
    return open(path, "rb")


def delete(key_or_path: str, base_dir: str | None = None) -> None:
    if not key_or_path:
        return
    if is_s3_enabled() and not os.path.exists(key_or_path):
        try:
            _s3_client().delete_object(Bucket=_bucket(), Key=key_or_path.lstrip("/"))
        except Exception:
            pass
        return
    path = _resolve_local_path(key_or_path, base_dir=base_dir)
    if os.path.exists(path):
        try:
            os.remove(path)
        except OSError:
            pass


def object_size(key_or_path: str, base_dir: str | None = None) -> int | None:
    """The stored object's real byte size, or None when it does not exist.

    Used to verify direct-to-S3 uploads server-side instead of trusting the
    size the browser claims in /documents/confirm.
    """
    if not key_or_path:
        return None
    if is_s3_enabled() and not os.path.exists(key_or_path):
        from botocore.exceptions import ClientError

        try:
            head = _s3_client().head_object(Bucket=_bucket(), Key=key_or_path.lstrip("/"))
            return int(head.get("ContentLength") or 0)
        except ClientError:
            return None
    path = _resolve_local_path(key_or_path, base_dir=base_dir)
    if not os.path.isfile(path):
        return None
    return os.path.getsize(path)


def generate_presigned_put(key: str, content_type: str = "application/octet-stream",
                           expires_in: int = 900, size: int | None = None) -> str | None:
    """Generate a presigned S3 PUT URL for direct browser uploads (>4.5 MB on Vercel).

    When `size` is given it is signed into the request, so S3 itself rejects an
    object whose Content-Length differs from what the API approved.
    """
    if not is_s3_enabled():
        return None
    params = {"Bucket": _bucket(), "Key": key.lstrip("/")}
    if content_type:
        params["ContentType"] = content_type
    if size:
        params["ContentLength"] = int(size)
    return _s3_client().generate_presigned_url("put_object", Params=params, ExpiresIn=expires_in)
