import hashlib
import hmac
import secrets
import threading
import time
from collections import defaultdict, deque
from datetime import UTC, datetime
from typing import Final

import httpx
from fastapi import HTTPException, Request, Response, status

from app.core.config import settings


HCAPTCHA_VERIFY_URL: Final[str] = "https://api.hcaptcha.com/siteverify"
SESSION_COOKIE_NAME: Final[str] = "rrs_demo_session"


class InMemoryRateLimiter:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._window_hits: dict[str, deque[float]] = defaultdict(deque)
        self._daily_hits: dict[str, int] = defaultdict(int)

    def check(self, key: str) -> int | None:
        now = time.time()
        cutoff = now - settings.rate_limit_window_seconds
        day_key = datetime.now(UTC).strftime("%Y-%m-%d")
        scoped_key = f"{day_key}:{key}"

        with self._lock:
            bucket = self._window_hits[scoped_key]
            while bucket and bucket[0] <= cutoff:
                bucket.popleft()

            if len(bucket) >= settings.rate_limit_requests_per_window:
                retry_after = max(1, int(settings.rate_limit_window_seconds - (now - bucket[0])))
                return retry_after

            if self._daily_hits[day_key] >= settings.daily_request_limit:
                return settings.rate_limit_window_seconds

            bucket.append(now)
            self._daily_hits[day_key] += 1
            return None


class PublicAccessService:
    def __init__(self) -> None:
        self._rate_limiter = InMemoryRateLimiter()

    @staticmethod
    def _is_production() -> bool:
        return settings.app_env.lower() == "production"

    @staticmethod
    def _get_client_ip(request: Request) -> str:
        forwarded_ip = request.headers.get("x-forwarded-for")
        if forwarded_ip:
            return forwarded_ip.split(",")[0].strip()
        if request.client and request.client.host:
            return request.client.host
        return "unknown"

    @staticmethod
    def _hash_ip(ip_address: str) -> str:
        return hashlib.sha256(ip_address.encode("utf-8")).hexdigest()[:16]

    @staticmethod
    def _sign_session(raw_session: str) -> str:
        signature = hmac.new(
            settings.session_signing_secret.encode("utf-8"),
            raw_session.encode("utf-8"),
            hashlib.sha256,
        ).hexdigest()
        return f"{raw_session}.{signature}"

    @staticmethod
    def _verify_session(signed_session: str | None) -> str | None:
        if not signed_session or "." not in signed_session:
            return None
        raw_session, signature = signed_session.rsplit(".", 1)
        expected = hmac.new(
            settings.session_signing_secret.encode("utf-8"),
            raw_session.encode("utf-8"),
            hashlib.sha256,
        ).hexdigest()
        if not hmac.compare_digest(signature, expected):
            return None
        return raw_session

    def _ensure_session(self, request: Request, response: Response) -> str:
        signed_session = request.cookies.get(SESSION_COOKIE_NAME)
        session_id = self._verify_session(signed_session)
        if session_id:
            return session_id

        session_id = secrets.token_urlsafe(24)
        response.set_cookie(
            key=SESSION_COOKIE_NAME,
            value=self._sign_session(session_id),
            httponly=True,
            secure=self._is_production(),
            samesite="lax",
            max_age=60 * 60 * 24 * 30,
        )
        return session_id

    @staticmethod
    def _extract_hcaptcha_token(request: Request, payload_token: str | None) -> str | None:
        return request.headers.get("x-hcaptcha-token") or payload_token

    @staticmethod
    def _validate_query_limits(query: str, top_k: int) -> None:
        if len(query.strip()) == 0:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Query is required.")
        if len(query) > settings.query_max_chars:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Query exceeds the {settings.query_max_chars}-character limit for the public demo.",
            )
        if top_k < 1 or top_k > settings.query_top_k_max:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"top_k must be between 1 and {settings.query_top_k_max}.",
            )

    async def _verify_hcaptcha(self, token: str, remote_ip: str) -> None:
        if not settings.hcaptcha_secret_key:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="hCaptcha protection is enabled but not configured on the server.",
            )

        async with httpx.AsyncClient(timeout=10.0) as client:
            try:
                response = await client.post(
                    HCAPTCHA_VERIFY_URL,
                    data={
                        "secret": settings.hcaptcha_secret_key,
                        "response": token,
                        "remoteip": remote_ip,
                    },
                )
                response.raise_for_status()
            except httpx.HTTPError as exc:
                raise HTTPException(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    detail="hCaptcha verification is temporarily unavailable. Please try again shortly.",
                ) from exc
        payload = response.json()
        if not payload.get("success"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="hCaptcha verification failed. Please try again.",
            )

    async def enforce_query_access(
        self,
        request: Request,
        response: Response,
        query: str,
        top_k: int,
        hcaptcha_token: str | None,
    ) -> None:
        self._validate_query_limits(query, top_k)

        session_id = self._ensure_session(request, response)
        remote_ip = self._get_client_ip(request)
        request_key = f"{self._hash_ip(remote_ip)}:{session_id}"

        retry_after = self._rate_limiter.check(request_key)
        if retry_after is not None:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="The public demo is rate limited. Please wait and try again.",
                headers={"Retry-After": str(retry_after)},
            )

        if settings.require_hcaptcha:
            token = self._extract_hcaptcha_token(request, hcaptcha_token)
            if not token:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="hCaptcha verification is required for public queries.",
                )
            await self._verify_hcaptcha(token, remote_ip)

    @staticmethod
    def enforce_ingest_access() -> None:
        if settings.public_ingest_enabled:
            return
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Public ingestion is disabled in this deployment.",
        )


public_access_service = PublicAccessService()
