"""Email handoff endpoint – server-side only."""

from __future__ import annotations

import logging
import re
import time
from typing import Annotated

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, EmailStr, Field, field_validator

from backend.config import get_handoff_settings
from backend.mailer import send_mail

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api", tags=["handoff"])

# Generic message returned for any abuse-protection rejection. Intentionally
# vague so the frontend cannot distinguish rate limiting from other failures
# and no limit/window details leak to clients.
_GENERIC_REJECT_DETAIL = "request_not_accepted"

# Upper bound on an accepted session identifier (defends the in-memory maps
# against client-supplied keys of arbitrary length).
_MAX_SESSION_ID_LENGTH = 64

# In-memory submission timestamps per rate-limit key. Process-local only; for
# multi-worker deployments back this with a shared store (e.g. Redis).
_submit_history: dict[str, list[float]] = {}
# Hard cap on tracked keys so a flood of distinct IPs/sessions cannot grow the
# map without bound.
_MAX_TRACKED_KEYS = 10_000

# Matches ASCII control characters (incl. CR/LF). Stripped from the name so a
# crafted value cannot inject extra headers into the email Subject line.
_CONTROL_CHARS_RE = re.compile(r"[\x00-\x1f\x7f]")


class HandoffPayload(BaseModel):
    name: Annotated[str, Field(min_length=1, max_length=100)]
    email: Annotated[EmailStr, Field(max_length=254)]
    company: Annotated[str | None, Field(max_length=100)] = None
    question: Annotated[str, Field(min_length=1, max_length=1000)]
    pageUrl: Annotated[str | None, Field(max_length=500)] = None
    language: Annotated[str, Field(min_length=2, max_length=10)] = "nl"

    @field_validator("name", mode="after")
    @classmethod
    def _strip_control_chars(cls, value: str) -> str:
        # ``name`` is interpolated into the email Subject header; removing
        # control characters (notably CR/LF) prevents header injection.
        return _CONTROL_CHARS_RE.sub("", value)

    @field_validator("name", "question", mode="after")
    @classmethod
    def _reject_blank(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError("required")
        return stripped

    @field_validator("company", mode="after")
    @classmethod
    def _normalize_optional(cls, value: str | None) -> str | None:
        if value is None:
            return None
        stripped = value.strip()
        return stripped or None

    @field_validator("pageUrl", mode="after")
    @classmethod
    def _normalize_page_url(cls, value: str | None) -> str | None:
        if value is None:
            return None
        stripped = value.strip()
        if not stripped:
            return None
        # Only accept absolute http(s) URLs; anything else is dropped rather
        # than echoed verbatim into the handoff email.
        if not re.match(r"https?://", stripped, re.IGNORECASE):
            return None
        return stripped


def _client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    if request.client:
        return request.client.host
    return "unknown"


def _session_id(request: Request) -> str | None:
    raw = request.headers.get("x-session-id")
    if not raw:
        return None
    candidate = raw.strip()
    if not candidate or len(candidate) > _MAX_SESSION_ID_LENGTH:
        return None
    return candidate


def _rate_limit_keys(request: Request) -> list[str]:
    keys = [f"ip:{_client_ip(request)}"]
    session_id = _session_id(request)
    if session_id:
        keys.append(f"sid:{session_id}")
    return keys


def _check_rate_limit(request: Request) -> None:
    settings = get_handoff_settings()
    now = time.time()
    window = settings.rate_limit_window_seconds
    keys = _rate_limit_keys(request)

    # Evaluate every key before recording so one client cannot bypass a limit
    # by also supplying a fresh session id.
    pruned: dict[str, list[float]] = {}
    for key in keys:
        recent = [t for t in _submit_history.get(key, []) if now - t < window]
        pruned[key] = recent
        too_soon = recent and now - recent[-1] < settings.rate_limit_seconds
        too_many = len(recent) >= settings.rate_limit_max_requests
        if too_soon or too_many:
            raise HTTPException(status_code=429, detail=_GENERIC_REJECT_DETAIL)

    for key, recent in pruned.items():
        recent.append(now)
        _submit_history[key] = recent

    _prune_tracked_keys(now, window)


def _prune_tracked_keys(now: float, window: int) -> None:
    """Drop keys whose timestamps have all aged out to bound memory use."""
    if len(_submit_history) <= _MAX_TRACKED_KEYS:
        return
    stale = [
        key
        for key, stamps in _submit_history.items()
        if not any(now - t < window for t in stamps)
    ]
    for key in stale:
        _submit_history.pop(key, None)


def _build_email_body(payload: HandoffPayload) -> str:
    lines = [
        "Nieuwe chatbox-vraag via BCF Confection website",
        "",
        f"Naam: {payload.name}",
        f"E-mailadres: {payload.email}",
    ]
    if payload.company:
        lines.append(f"Bedrijf: {payload.company}")
    lines.extend(
        [
            f"Taal: {payload.language}",
            "",
            "Vraag:",
            payload.question,
        ]
    )
    if payload.pageUrl:
        lines.extend(["", f"Pagina: {payload.pageUrl}"])
    return "\n".join(lines)


def _send_email(payload: HandoffPayload) -> None:
    settings = get_handoff_settings()

    recipient = settings.active_dest_email
    if not recipient:
        # Fail safely: never fall back to another environment's recipient.
        logger.error(
            "Handoff recipient is not configured for APP_ENV=%s", settings.app_env
        )
        raise HTTPException(status_code=503, detail="handoff_unavailable")

    body = _build_email_body(payload)
    subject = f"Chatbox-vraag van {payload.name}"

    try:
        send_mail(
            settings=settings,
            to=recipient,
            reply_to=str(payload.email),
            subject=subject,
            body=body,
        )
    except HTTPException:
        raise
    except Exception:
        logger.exception("Failed to send handoff email")
        raise HTTPException(status_code=503, detail="handoff_failed") from None


@router.post("/handoff")
def submit_handoff(payload: HandoffPayload, request: Request) -> dict[str, bool]:
    _check_rate_limit(request)
    _send_email(payload)
    return {"ok": True}
