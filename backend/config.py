"""Server-side configuration from environment variables."""

from __future__ import annotations

import os
from dataclasses import dataclass

from dotenv import load_dotenv

load_dotenv()


@dataclass(frozen=True)
class HandoffSettings:
    # Deployment environment: "production" routes to the live recipient;
    # anything else (development/staging/…) routes to the test recipient.
    app_env: str
    # Live recipient (CHATBOX_HANDOFF_TO) – used only in production.
    dest_email: str | None
    # Test recipient (CHATBOX_HANDOFF_TEST_TO) – used outside production.
    test_dest_email: str | None
    mail_from: str | None
    # Provider: "mock" | "smtp" | "resend"
    mail_provider: str
    smtp_host: str | None
    smtp_port: int
    smtp_user: str | None
    smtp_password: str | None
    smtp_use_tls: bool
    resend_api_key: str | None
    # Minimum seconds between two submissions from the same client.
    rate_limit_seconds: int
    # Sliding-window cap: at most `rate_limit_max_requests` submissions per
    # `rate_limit_window_seconds`.
    rate_limit_max_requests: int
    rate_limit_window_seconds: int

    @property
    def is_mock(self) -> bool:
        return self.mail_provider == "mock"

    @property
    def is_production(self) -> bool:
        return self.app_env == "production"

    @property
    def active_dest_email(self) -> str | None:
        """Recipient for the current environment.

        Production uses the live address; every other environment uses the
        test address. Returns ``None`` when the relevant address is unset so
        callers can fail safely.
        """
        return self.dest_email if self.is_production else self.test_dest_email


def get_handoff_settings() -> HandoffSettings:
    # Legacy HANDOFF_DRY_RUN=true maps to provider "mock"
    legacy_dry_run = os.getenv("HANDOFF_DRY_RUN", "true").lower() == "true"
    raw_provider = os.getenv("MAIL_PROVIDER", "mock" if legacy_dry_run else "smtp")
    mail_provider = raw_provider.strip().lower()

    app_env = os.getenv("APP_ENV", "development").strip().lower()

    return HandoffSettings(
        app_env=app_env,
        dest_email=os.getenv("CHATBOX_HANDOFF_TO"),
        test_dest_email=os.getenv("CHATBOX_HANDOFF_TEST_TO"),
        mail_from=os.getenv("CHATBOX_MAIL_FROM"),
        mail_provider=mail_provider,
        smtp_host=os.getenv("SMTP_HOST"),
        smtp_port=int(os.getenv("SMTP_PORT", "587")),
        smtp_user=os.getenv("SMTP_USER"),
        smtp_password=os.getenv("SMTP_PASSWORD"),
        smtp_use_tls=os.getenv("SMTP_USE_TLS", "true").lower() == "true",
        resend_api_key=os.getenv("RESEND_API_KEY"),
        rate_limit_seconds=int(os.getenv("HANDOFF_RATE_LIMIT_SECONDS", "30")),
        rate_limit_max_requests=int(os.getenv("HANDOFF_RATE_LIMIT_MAX_REQUESTS", "5")),
        rate_limit_window_seconds=int(
            os.getenv("HANDOFF_RATE_LIMIT_WINDOW_SECONDS", "3600")
        ),
    )


def get_cors_allow_origins() -> list[str]:
    """Explicit allow-list of browser origins permitted to call the API.

    Read from ``CORS_ALLOW_ORIGINS`` as a comma-separated list. Empty/unset
    means no cross-origin browser request is allowed (same-origin only). We
    never return ``"*"`` implicitly: cross-origin access must be opt-in so a
    staging API only answers the approved test/fake website origin.
    """
    raw = os.getenv("CORS_ALLOW_ORIGINS", "")
    return [origin.strip() for origin in raw.split(",") if origin.strip()]


def serve_static_enabled() -> bool:
    """Whether to mount the bundled frontend assets.

    Defaults to ``True`` for local development. Set ``SERVE_STATIC=false`` for
    an API-only backend deployment (staging deploys only ``/api/*``).
    """
    return os.getenv("SERVE_STATIC", "true").strip().lower() != "false"
