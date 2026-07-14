"""Google Cloud Storage for persistent image URLs."""

from __future__ import annotations

import asyncio
import json
import logging
import mimetypes
import uuid

from app.core.config import settings

logger = logging.getLogger(__name__)

GCS_PREFIX = "gcs://"


def gcs_configured() -> bool:
    return bool(settings.GCS_BUCKET_NAME)


def _gcs_client():
    from google.cloud import storage
    from google.oauth2 import service_account

    if settings.GCS_SERVICE_ACCOUNT_JSON:
        info = json.loads(settings.GCS_SERVICE_ACCOUNT_JSON)
        creds = service_account.Credentials.from_service_account_info(
            info, scopes=["https://www.googleapis.com/auth/cloud-platform"],
        )
        return storage.Client(credentials=creds, project=info.get("project_id"))

    # Cloud Run / GCE: uses the attached service account via metadata server (no key file).
    return storage.Client()


def _ext_for_mime(mime_type: str) -> str:
    base = mime_type.split(";")[0].strip()
    mapping = {
        "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp",
        "image/gif": ".gif", "audio/ogg": ".ogg", "audio/mpeg": ".mp3", "audio/mp4": ".m4a",
    }
    return mapping.get(base, mimetypes.guess_extension(base) or "")


async def upload_to_gcs(data: bytes, mime_type: str, folder: str = "domino") -> str | None:
    if not gcs_configured():
        return None

    ext = _ext_for_mime(mime_type)
    key = f"{folder}/{uuid.uuid4().hex}{ext}"
    bucket_name = settings.GCS_BUCKET_NAME

    try:
        loop = asyncio.get_event_loop()

        def _upload():
            client = _gcs_client()
            bucket = client.bucket(bucket_name)
            blob = bucket.blob(key)
            blob.upload_from_string(data, content_type=mime_type.split(";")[0].strip())

        await loop.run_in_executor(None, _upload)
        uri = f"{GCS_PREFIX}{bucket_name}/{key}"
        logger.info("Uploaded to GCS: %s", uri)
        return uri
    except Exception as e:
        logger.warning("GCS upload failed: %s", e)
        return None


async def fetch_from_gcs(uri: str) -> tuple[bytes, str]:
    path = uri[len(GCS_PREFIX):]
    bucket_name, _, key = path.partition("/")

    loop = asyncio.get_event_loop()

    def _download():
        client = _gcs_client()
        bucket = client.bucket(bucket_name)
        blob = bucket.blob(key)
        data = blob.download_as_bytes()
        content_type = blob.content_type or "application/octet-stream"
        return data, content_type

    return await loop.run_in_executor(None, _download)


def is_gcs_uri(raw: str) -> bool:
    return raw.startswith(GCS_PREFIX)
