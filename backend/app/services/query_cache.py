import threading
import time

from app.core.config import settings
from app.models import QueryResponse


class QueryCache:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._entries: dict[str, tuple[float, QueryResponse]] = {}

    @staticmethod
    def _make_key(query: str, top_k: int) -> str:
        return f"{query.strip().lower()}::{top_k}"

    def get(self, query: str, top_k: int) -> QueryResponse | None:
        key = self._make_key(query, top_k)
        now = time.time()
        with self._lock:
            entry = self._entries.get(key)
            if entry is None:
                return None
            expires_at, payload = entry
            if expires_at <= now:
                self._entries.pop(key, None)
                return None
            return payload.model_copy(deep=True)

    def set(self, query: str, top_k: int, payload: QueryResponse) -> None:
        key = self._make_key(query, top_k)
        expires_at = time.time() + settings.cache_ttl_seconds
        with self._lock:
            self._entries[key] = (expires_at, payload.model_copy(deep=True))


query_cache = QueryCache()
