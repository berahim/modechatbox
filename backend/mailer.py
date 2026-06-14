"""Provider-agnostic mail sender.

Supported providers (set via MAIL_PROVIDER env var):
  mock  — log only, no email sent (default / development)
  smtp  — generic SMTP relay (Brevo, Mailjet, AWS SES, SendGrid relay, …)
  resend — Resend HTTP API (https://resend.com)
"""

from __future__ import annotations

import logging
import smtplib
from email.message import EmailMessage

from backend.config import HandoffSettings

logger = logging.getLogger(__name__)


def send_mail(
    *,
    settings: HandoffSettings,
    to: str,
    reply_to: str,
    subject: str,
    body: str,
) -> None:
    sender = settings.mail_from or settings.smtp_user or to

    if settings.is_mock:
        logger.info(
            "MAIL mock – provider=%s to=%s subject=%s\n%s",
            settings.mail_provider,
            to,
            subject,
            body,
        )
        return

    if settings.mail_provider == "resend":
        _send_resend(
            settings=settings,
            from_addr=sender,
            to=to,
            reply_to=reply_to,
            subject=subject,
            body=body,
        )
    elif settings.mail_provider == "smtp":
        _send_smtp(
            settings=settings,
            from_addr=sender,
            to=to,
            reply_to=reply_to,
            subject=subject,
            body=body,
        )
    else:
        logger.error("Unknown MAIL_PROVIDER: %r", settings.mail_provider)
        raise RuntimeError(f"Unknown MAIL_PROVIDER: {settings.mail_provider!r}")


def _send_resend(
    *,
    settings: HandoffSettings,
    from_addr: str,
    to: str,
    reply_to: str,
    subject: str,
    body: str,
) -> None:
    if not settings.resend_api_key:
        logger.error("RESEND_API_KEY is not configured")
        raise RuntimeError("RESEND_API_KEY missing")

    try:
        import resend  # type: ignore[import-untyped]
    except ImportError as exc:
        logger.error("resend package is not installed (pip install resend)")
        raise RuntimeError("resend package missing") from exc

    resend.api_key = settings.resend_api_key
    resend.Emails.send(
        {
            "from": from_addr,
            "to": [to],
            "reply_to": reply_to,
            "subject": subject,
            "text": body,
        }
    )


def _send_smtp(
    *,
    settings: HandoffSettings,
    from_addr: str,
    to: str,
    reply_to: str,
    subject: str,
    body: str,
) -> None:
    if not settings.smtp_host:
        logger.error("SMTP_HOST is not configured")
        raise RuntimeError("SMTP_HOST missing")

    message = EmailMessage()
    message["Subject"] = subject
    message["From"] = from_addr
    message["To"] = to
    message["Reply-To"] = reply_to
    message.set_content(body)

    with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=15) as smtp:
        if settings.smtp_use_tls:
            smtp.starttls()
        if settings.smtp_user and settings.smtp_password:
            smtp.login(settings.smtp_user, settings.smtp_password)
        smtp.send_message(message)
