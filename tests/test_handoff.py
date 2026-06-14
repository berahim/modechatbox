"""End-to-end tests for the chatbox email handoff endpoint.

These exercise ``POST /api/handoff`` through FastAPI's TestClient with the
actual mail sender mocked out, so no real email is ever sent and no personal
data is logged.
"""

from __future__ import annotations

import pytest

from conftest import RESEND_KEY_SENTINEL, SMTP_PASSWORD_SENTINEL

ENDPOINT = "/api/handoff"

# Synthetic, non-personal sample data.
VALID_PAYLOAD = {
    "name": "Testgebruiker",
    "email": "testgebruiker@example.com",
    "question": "Wat is de levertijd van een maatpak?",
    "company": "Voorbeeld BV",
    "language": "nl",
}


def _body_text(response) -> str:
    return response.text or ""


def test_valid_submission_returns_success(client, mock_send):
    response = client.post(ENDPOINT, json=VALID_PAYLOAD)

    assert response.status_code == 200
    assert response.json() == {"ok": True}

    # Email was handed to the sender exactly once, with content preserved.
    assert mock_send.call_count == 1
    kwargs = mock_send.call_args.kwargs
    assert kwargs["to"] == "dest@example.com"
    assert kwargs["reply_to"] == VALID_PAYLOAD["email"]
    assert VALID_PAYLOAD["name"] in kwargs["subject"]
    assert VALID_PAYLOAD["question"] in kwargs["body"]


@pytest.mark.parametrize("missing_field", ["name", "email", "question"])
def test_missing_required_field_is_rejected(client, mock_send, missing_field):
    payload = {k: v for k, v in VALID_PAYLOAD.items() if k != missing_field}

    response = client.post(ENDPOINT, json=payload)

    assert response.status_code == 422
    mock_send.assert_not_called()


@pytest.mark.parametrize("blank", ["", "   ", "\t\n"])
def test_blank_required_field_is_rejected(client, mock_send, blank):
    payload = {**VALID_PAYLOAD, "name": blank}

    response = client.post(ENDPOINT, json=payload)

    assert response.status_code == 422
    mock_send.assert_not_called()


@pytest.mark.parametrize(
    "bad_email",
    ["not-an-email", "missing@domain", "@example.com", "spaces in@example.com"],
)
def test_invalid_email_is_rejected(client, mock_send, bad_email):
    payload = {**VALID_PAYLOAD, "email": bad_email}

    response = client.post(ENDPOINT, json=payload)

    assert response.status_code == 422
    mock_send.assert_not_called()


@pytest.mark.parametrize(
    ("field", "value"),
    [
        ("name", "x" * 101),
        ("company", "x" * 101),
        ("question", "x" * 1001),
        ("email", "a" * 250 + "@example.com"),
        ("pageUrl", "https://example.com/" + "p" * 600),
        ("language", "x" * 11),
    ],
)
def test_overly_long_field_is_rejected(client, mock_send, field, value):
    payload = {**VALID_PAYLOAD, field: value}

    response = client.post(ENDPOINT, json=payload)

    assert response.status_code == 422
    mock_send.assert_not_called()


def test_rate_limited_submissions_return_generic_rejection(
    client, mock_send, monkeypatch
):
    monkeypatch.setenv("HANDOFF_RATE_LIMIT_SECONDS", "0")
    monkeypatch.setenv("HANDOFF_RATE_LIMIT_MAX_REQUESTS", "2")
    monkeypatch.setenv("HANDOFF_RATE_LIMIT_WINDOW_SECONDS", "3600")

    headers = {"X-Session-Id": "test-session"}
    assert client.post(ENDPOINT, json=VALID_PAYLOAD, headers=headers).status_code == 200
    assert client.post(ENDPOINT, json=VALID_PAYLOAD, headers=headers).status_code == 200

    blocked = client.post(ENDPOINT, json=VALID_PAYLOAD, headers=headers)

    assert blocked.status_code == 429
    assert blocked.json() == {"detail": "request_not_accepted"}
    # Only the two accepted submissions reached the sender.
    assert mock_send.call_count == 2

    # No rate-limit internals are exposed to the client.
    body = _body_text(blocked).lower()
    for leak in ("retry", "window", "limit", "remaining", "seconds", "max"):
        assert leak not in body
    assert "retry-after" not in {k.lower() for k in blocked.headers}


def test_missing_mail_configuration_fails_safely(client, mock_send, monkeypatch):
    monkeypatch.delenv("CHATBOX_HANDOFF_TO", raising=False)

    response = client.post(ENDPOINT, json=VALID_PAYLOAD)

    assert response.status_code == 503
    mock_send.assert_not_called()
    # Generic failure detail, nothing about why configuration is missing.
    assert response.json() == {"detail": "handoff_unavailable"}


def test_production_sends_to_production_recipient(client, mock_send, monkeypatch):
    monkeypatch.setenv("APP_ENV", "production")

    response = client.post(ENDPOINT, json=VALID_PAYLOAD)

    assert response.status_code == 200
    assert mock_send.call_args.kwargs["to"] == "dest@example.com"


@pytest.mark.parametrize("env", ["development", "staging"])
def test_non_production_sends_to_test_recipient(client, mock_send, monkeypatch, env):
    monkeypatch.setenv("APP_ENV", env)

    response = client.post(ENDPOINT, json=VALID_PAYLOAD)

    assert response.status_code == 200
    # Live recipient is never used outside production.
    assert mock_send.call_args.kwargs["to"] == "test-dest@example.com"


def test_unknown_env_defaults_to_test_recipient(client, mock_send, monkeypatch):
    monkeypatch.setenv("APP_ENV", "qa-sandbox")

    response = client.post(ENDPOINT, json=VALID_PAYLOAD)

    assert response.status_code == 200
    assert mock_send.call_args.kwargs["to"] == "test-dest@example.com"


def test_production_missing_live_recipient_fails_safely(client, mock_send, monkeypatch):
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.delenv("CHATBOX_HANDOFF_TO", raising=False)

    response = client.post(ENDPOINT, json=VALID_PAYLOAD)

    assert response.status_code == 503
    assert response.json() == {"detail": "handoff_unavailable"}
    mock_send.assert_not_called()


@pytest.mark.parametrize("env", ["development", "staging"])
def test_non_production_missing_test_recipient_fails_safely(
    client, mock_send, monkeypatch, env
):
    monkeypatch.setenv("APP_ENV", env)
    monkeypatch.delenv("CHATBOX_HANDOFF_TEST_TO", raising=False)

    response = client.post(ENDPOINT, json=VALID_PAYLOAD)

    assert response.status_code == 503
    assert response.json() == {"detail": "handoff_unavailable"}
    mock_send.assert_not_called()


def test_production_does_not_use_test_recipient(client, mock_send, monkeypatch):
    # Even if the live recipient is missing, production must never silently
    # fall back to the test recipient.
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.delenv("CHATBOX_HANDOFF_TO", raising=False)
    monkeypatch.setenv("CHATBOX_HANDOFF_TEST_TO", "test-dest@example.com")

    response = client.post(ENDPOINT, json=VALID_PAYLOAD)

    assert response.status_code == 503
    mock_send.assert_not_called()


def test_send_failure_does_not_leak_secrets_or_traces(client, mock_send):
    # Simulate a provider error whose message embeds a credential.
    mock_send.side_effect = Exception(
        f"SMTP 535 auth failed user=smtp-user pass={SMTP_PASSWORD_SENTINEL}"
    )

    response = client.post(ENDPOINT, json=VALID_PAYLOAD)

    assert response.status_code == 503
    assert response.json() == {"detail": "handoff_failed"}

    body = _body_text(response)
    assert SMTP_PASSWORD_SENTINEL not in body
    assert RESEND_KEY_SENTINEL not in body
    # No stack traces or provider/internal details.
    for leak in ("Traceback", 'File "', "smtplib", "resend", "SMTP", "535"):
        assert leak not in body


def test_successful_response_exposes_no_extra_fields(client, mock_send):
    response = client.post(ENDPOINT, json=VALID_PAYLOAD)

    assert response.status_code == 200
    # Response is strictly the success flag; no provider/config echoes.
    assert response.json() == {"ok": True}
    body = _body_text(response)
    for leak in (SMTP_PASSWORD_SENTINEL, RESEND_KEY_SENTINEL, "dest@example.com"):
        assert leak not in body
