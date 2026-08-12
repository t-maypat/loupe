"""Lazy, optional Pinecone accessor.

Pinecone is genuinely optional: without an API key (or with a missing/unreachable
index) :func:`get_pinecone_index` returns ``None`` and retrieval degrades to
BM25-only. Nothing happens at import time, and indexes are never created on the
request path — provision and populate them out of band. Availability is decided
once per process; restart after provisioning Pinecone to pick it up.
"""

import logging
from typing import Any

from app.core.config import settings

logger = logging.getLogger("loupe.pinecone")

_index: Any = None
_initialized = False


def get_pinecone_index() -> Any:
    """Return the Pinecone index, or ``None`` when dense retrieval is unavailable."""
    global _index, _initialized
    if _initialized:
        return _index
    _initialized = True

    if not settings.pinecone_api_key:
        logger.warning("PINECONE_API_KEY not set — dense retrieval disabled (BM25-only).")
        return None

    try:
        from pinecone import Pinecone

        pc = Pinecone(api_key=settings.pinecone_api_key)
        if settings.pinecone_index not in pc.list_indexes().names():
            logger.warning(
                "Pinecone index %r not found — dense retrieval disabled (BM25-only). "
                "Provision and populate it out of band, then restart.",
                settings.pinecone_index,
            )
            return None
        _index = pc.Index(settings.pinecone_index)
    except Exception:  # noqa: BLE001 — degrade to BM25-only rather than fail requests
        logger.exception("Pinecone unavailable — dense retrieval disabled (BM25-only).")
        _index = None
    return _index
