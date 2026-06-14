"""Shared pytest fixtures for the backend test suite.

Living at the repo root so the ``backend`` package is importable and the
in-memory rate-limiter state can be reset between tests.
"""

from __future__ import annotations

from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient

import backend.handoff as handoff
from backend.app import app

# Secret-looking values seeded into the environment so tests can assert they
# never appear in any HTTP response body. Not real credentials.
SMTP_PASSWORD_SENTINEL = "smtp-pw-do-not-leak-123"
RESEND_KEY_SENTINEL = "re_do_not_leak_456"


@pytest.fixture(autouse=True)
def reset_rate_limiter():
    """Isolate the process-local rate-limiter state per test."""
    handoff._submit_history.clear()
    yield
    handoff._submit_history.clear()


@pytest.fixture
def base_env(monkeypatch):
    """Deterministic, mock-only mail config with generous rate limits.

    Individual tests tighten limits or drop config as needed.
    """
    monkeypatch.setenv("MAIL_PROVIDER", "mock")
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.setenv("CHATBOX_HANDOFF_TO", "dest@example.com")
    monkeypatch.setenv("CHATBOX_HANDOFF_TEST_TO", "test-dest@example.com")
    monkeypatch.setenv("CHATBOX_MAIL_FROM", "noreply@example.com")
    monkeypatch.setenv("HANDOFF_RATE_LIMIT_SECONDS", "0")
    monkeypatch.setenv("HANDOFF_RATE_LIMIT_MAX_REQUESTS", "1000")
    monkeypatch.setenv("HANDOFF_RATE_LIMIT_WINDOW_SECONDS", "3600")
    # Seed secret-looking values to prove they never leak to clients, and make
    # sure no real credentials from a local .env bleed into tests.
    monkeypatch.setenv("SMTP_HOST", "smtp.example.com")
    monkeypatch.setenv("SMTP_USER", "smtp-user@example.com")
    monkeypatch.setenv("SMTP_PASSWORD", SMTP_PASSWORD_SENTINEL)
    monkeypatch.setenv("RESEND_API_KEY", RESEND_KEY_SENTINEL)


@pytest.fixture
def mock_send(monkeypatch):
    """Replace the real mail sender so no email is sent and nothing is logged."""
    sender = MagicMock(name="send_mail")
    monkeypatch.setattr(handoff, "send_mail", sender)
    return sender


@pytest.fixture
def client(base_env, mock_send):
    with TestClient(app) as test_client:
        yield test_client
