"""Request-ID propagation and structured observability middleware."""

from __future__ import annotations

import logging
import time
import uuid
from collections import defaultdict
from threading import Lock
from typing import Any

from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import Response

logger = logging.getLogger("dhanova.http")

REQUEST_ID_HEADER = "X-Request-ID"


# ---------------------------------------------------------------------------
# In-process metrics counters — lightweight, no external dependency.
# Production deployments should scrape /metrics or export to Prometheus.
# ---------------------------------------------------------------------------

class _Counters:
    """Thread-safe request/latency counters."""

    def __init__(self) -> None:
        self._lock = Lock()
        self.requests: dict[str, int] = defaultdict(int)
        self.errors: dict[str, int] = defaultdict(int)
        self.latency_sum: dict[str, float] = defaultdict(float)
        self.gemini_fallbacks: int = 0
        self.scoring_count: int = 0
        self.scoring_latency_sum: float = 0.0

    def record_request(self, method: str, path: str, status: int, duration: float) -> None:
        key = f"{method} {path}"
        with self._lock:
            self.requests[key] += 1
            self.latency_sum[key] += duration
            if status >= 500:
                self.errors[key] += 1

    def record_gemini_fallback(self) -> None:
        with self._lock:
            self.gemini_fallbacks += 1

    def record_scoring(self, duration: float) -> None:
        with self._lock:
            self.scoring_count += 1
            self.scoring_latency_sum += duration

    def snapshot(self) -> dict[str, Any]:
        with self._lock:
            total_requests = sum(self.requests.values())
            total_errors = sum(self.errors.values())
            return {
                "http_requests_total": total_requests,
                "http_errors_total": total_errors,
                "http_by_endpoint": dict(self.requests),
                "http_latency_sum_by_endpoint": {
                    k: round(v, 4) for k, v in self.latency_sum.items()
                },
                "gemini_fallback_total": self.gemini_fallbacks,
                "scoring_requests_total": self.scoring_count,
                "scoring_latency_sum_seconds": round(self.scoring_latency_sum, 4),
            }


counters = _Counters()


# ---------------------------------------------------------------------------
# Middleware
# ---------------------------------------------------------------------------

class ObservabilityMiddleware(BaseHTTPMiddleware):
    """Adds X-Request-ID, structured access logs, and latency counters."""

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        # Propagate or generate request ID
        request_id = request.headers.get(REQUEST_ID_HEADER) or str(uuid.uuid4())
        request.state.request_id = request_id

        start = time.monotonic()
        response: Response = await call_next(request)
        duration = time.monotonic() - start

        response.headers[REQUEST_ID_HEADER] = request_id

        # Structured access log — never log bearer tokens or full payloads
        path = request.url.path
        logger.info(
            "request_completed",
            extra={
                "request_id": request_id,
                "method": request.method,
                "path": path,
                "status": response.status_code,
                "duration_ms": round(duration * 1000, 1),
            },
        )

        counters.record_request(request.method, path, response.status_code, duration)

        return response
