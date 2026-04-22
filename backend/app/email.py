"""Email sender. Tries Resend if RESEND_API_KEY is configured; otherwise logs
the message to the console (useful for local dev and tests).

We keep the API tiny: call `send_password_reset_email(to, reset_url)` and
forget about it. Failures are swallowed and logged, never propagated to the
caller, because password-reset email delivery must never leak "this email
exists" to the client.
"""

from __future__ import annotations

import logging

import requests

from app.config import settings

log = logging.getLogger("savedai.email")

_RESEND_ENDPOINT = "https://api.resend.com/emails"


def _build_reset_email_html(reset_url: str) -> str:
    return f"""
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #0f172a; background: #f8fafc; padding: 32px;">
      <div style="max-width: 480px; margin: 0 auto; background: #ffffff; border-radius: 16px; padding: 32px; border: 1px solid #e2e8f0;">
        <h1 style="margin: 0 0 12px 0; font-size: 20px; color: #0f172a;">Reset your SavedAI password</h1>
        <p style="margin: 0 0 20px 0; font-size: 14px; color: #475569; line-height: 1.5;">
          We got a request to reset your password. Click the button below to set a new one.
          This link will expire in {settings.PASSWORD_RESET_EXPIRE_MINUTES} minutes.
        </p>
        <p style="margin: 0 0 24px 0;">
          <a href="{reset_url}" style="display: inline-block; padding: 12px 20px; background: #0ea5e9; color: #ffffff; font-weight: 600; border-radius: 10px; text-decoration: none; font-size: 14px;">
            Reset password
          </a>
        </p>
        <p style="margin: 0 0 8px 0; font-size: 12px; color: #94a3b8;">
          Or paste this link into your browser:
        </p>
        <p style="margin: 0 0 24px 0; font-size: 12px; color: #64748b; word-break: break-all;">
          {reset_url}
        </p>
        <p style="margin: 0; font-size: 12px; color: #94a3b8; line-height: 1.5;">
          If you didn't request this, you can safely ignore this email. Your password will stay the same.
        </p>
      </div>
      <p style="text-align: center; margin: 16px 0 0 0; font-size: 11px; color: #cbd5e1;">
        SavedAI, save smarter with AI
      </p>
    </div>
    """


def _build_reset_email_text(reset_url: str) -> str:
    return (
        "Reset your SavedAI password\n\n"
        "We got a request to reset your password. Use this link to set a new one:\n\n"
        f"{reset_url}\n\n"
        f"This link will expire in {settings.PASSWORD_RESET_EXPIRE_MINUTES} minutes.\n"
        "If you didn't request this, you can safely ignore this email."
    )


def send_password_reset_email(to_email: str, reset_url: str) -> bool:
    """Send a password-reset email. Returns True on success, False otherwise.
    Callers should ignore the return value for user-facing flows to keep
    account-enumeration tight."""
    subject = "Reset your SavedAI password"
    html = _build_reset_email_html(reset_url)
    text = _build_reset_email_text(reset_url)

    if not settings.RESEND_API_KEY:
        log.warning(
            "RESEND_API_KEY is not set. Password reset email to %s would be:\n%s",
            to_email,
            text,
        )
        # Returning True here so local dev flows don't spuriously surface
        # failures. The link is visible in the backend logs.
        return True

    try:
        resp = requests.post(
            _RESEND_ENDPOINT,
            json={
                "from": settings.RESEND_FROM_EMAIL,
                "to": [to_email],
                "subject": subject,
                "html": html,
                "text": text,
            },
            headers={
                "Authorization": f"Bearer {settings.RESEND_API_KEY}",
                "Content-Type": "application/json",
            },
            timeout=10,
        )
        if resp.status_code >= 400:
            log.error("Resend send failed (%s): %s", resp.status_code, resp.text[:300])
            return False
        return True
    except Exception as e:
        log.exception("Resend send crashed: %s", e)
        return False
