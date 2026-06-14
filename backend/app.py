"""FastAPI application – static assets and handoff API."""

from __future__ import annotations

from pathlib import Path

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from backend.handoff import router as handoff_router

ROOT = Path(__file__).resolve().parent.parent

app = FastAPI(title="BCF Confection Chatbox", version="0.1.0")
app.include_router(handoff_router)
app.mount("/", StaticFiles(directory=str(ROOT), html=True), name="static")
