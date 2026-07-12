"""In-memory caching engine with automatic pattern-based invalidation triggers."""
import asyncio
import time
from typing import Any, Callable


class CacheEngine:
    def __init__(self, default_ttl_seconds: int = 300):
        self._store: dict[str, tuple[Any, float]] = {}
        self._default_ttl = default_ttl_seconds
        self._lock = asyncio.Lock()

    async def get(self, key: str) -> Any | None:
        async with self._lock:
            if key in self._store:
                data, expiry = self._store[key]
                if time.time() < expiry:
                    return data
                else:
                    del self._store[key]
        return None

    async def set(self, key: str, value: Any, ttl_seconds: int | None = None) -> None:
        ttl = ttl_seconds if ttl_seconds is not None else self._default_ttl
        async with self._lock:
            self._store[key] = (value, time.time() + ttl)

    async def invalidate_pattern(self, pattern: str) -> int:
        """Clear all cache keys starting with or containing pattern."""
        async with self._lock:
            keys_to_delete = [k for k in self._store.keys() if pattern in k]
            for k in keys_to_delete:
                del self._store[k]
            return len(keys_to_delete)

    async def clear_all(self) -> None:
        async with self._lock:
            self._store.clear()


# Global singleton cache instance
cache = CacheEngine(default_ttl_seconds=600)
