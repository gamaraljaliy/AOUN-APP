from contextlib import contextmanager
from threading import Lock
from time import monotonic

from fastapi import HTTPException


class PhotoSigningLimits:
    def __init__(self, *, per_client=20, total=120, inflight=6, client_inflight=3, window=60, clock=monotonic):
        self.per_client, self.total = per_client, total
        self.inflight, self.client_inflight = inflight, client_inflight
        self.window, self.clock = window, clock
        self.lock = Lock()
        self.reset_at = clock() + window
        self.hits = {}
        self.request_count = 0
        self.active = {}
        self.active_count = 0

    @contextmanager
    def admit(self, client: str):
        with self.lock:
            now = self.clock()
            if now >= self.reset_at:
                self.hits.clear()
                self.request_count = 0
                self.reset_at = now + self.window
            hits = self.hits.get(client, 0)
            if hits >= self.per_client or self.request_count >= self.total:
                raise HTTPException(429, "Too many photo requests", headers={
                    "Retry-After": str(max(1, int(self.reset_at - now + 0.999))),
                })
            if self.active_count >= self.inflight or self.active.get(client, 0) >= self.client_inflight:
                raise HTTPException(429, "Photo signing is busy", headers={"Retry-After": "1"})
            self.hits[client] = hits + 1
            self.request_count += 1
            self.active[client] = self.active.get(client, 0) + 1
            self.active_count += 1
        try:
            yield
        finally:
            with self.lock:
                self.active_count -= 1
                self.active[client] -= 1
                if self.active[client] == 0:
                    del self.active[client]
