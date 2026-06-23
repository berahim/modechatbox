"""FastAPI application – static assets and handoff API."""

from __future__ import annotations

from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from fastapi.staticfiles import StaticFiles

from backend.config import get_cors_allow_origins, serve_static_enabled
from backend.handoff import router as handoff_router

ROOT = Path(__file__).resolve().parent.parent

app = FastAPI(title="BCF Confection Chatbox", version="0.1.0")

# Restrict browser access to an explicit allow-list (the approved test/fake
# website origin in staging). When unset, no cross-origin request is allowed.
_cors_origins = get_cors_allow_origins()
if _cors_origins:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=_cors_origins,
        allow_credentials=False,
        allow_methods=["GET", "POST", "OPTIONS"],
        allow_headers=["Content-Type", "X-Session-Id"],
    )


@app.get("/api/health")
def health() -> dict[str, str]:
    """Lightweight liveness probe for deployment/HTTPS reachability checks."""
    return {"status": "ok"}


@app.get("/", include_in_schema=False)
def root() -> RedirectResponse:
    """Show the bundled staging demo at the deployment root."""
    return RedirectResponse(url="/demo/", status_code=307)


app.include_router(handoff_router)

# API-only deployments (staging) set SERVE_STATIC=false and ship no frontend.
if serve_static_enabled():
    app.mount("/", StaticFiles(directory=str(ROOT), html=True), name="static")
