"""Sending email through Brevo's HTTPS API.

Render's free tier blocks outbound SMTP ports (25, 465, 587), so a normal SMTP library
would time out there. An HTTPS API works everywhere. Without BREVO_API_KEY, emails are
printed to the server log instead, which is enough for local development.
"""
import logging

import httpx

from app.config import settings

log = logging.getLogger("nirmaan.email")
BREVO_URL = "https://api.brevo.com/v3/smtp/email"


def send_email(to: str, subject: str, text: str, html: str) -> bool:
    if not settings.brevo_api_key or not settings.email_from:
        log.warning("Email not configured. Would send to %s: %s\n%s", to, subject, text)
        print(f"\n[email] To: {to}\n[email] Subject: {subject}\n{text}\n", flush=True)
        return False
    try:
        r = httpx.post(
            BREVO_URL,
            headers={"api-key": settings.brevo_api_key, "accept": "application/json"},
            json={
                "sender": {"name": settings.email_from_name, "email": settings.email_from},
                "to": [{"email": to}],
                "subject": subject,
                "textContent": text,
                "htmlContent": html,
            },
            timeout=20,
        )
        if r.status_code >= 400:
            log.error("Brevo rejected the email (%s): %s", r.status_code, r.text[:300])
            return False
        return True
    except httpx.HTTPError as e:
        log.error("Couldn't reach Brevo: %s", e)
        return False


def send_password_reset(to: str, name: str, link: str, minutes: int) -> bool:
    text = (
        f"Hi {name},\n\nSomeone asked to reset your Nirmaan password. Open this link to choose a new one:\n\n"
        f"{link}\n\nThe link works once and expires in {minutes} minutes. "
        "If you didn't ask for this, you can ignore this email; your password won't change."
    )
    html = f"""<div style="font-family:Arial,sans-serif;max-width:520px;color:#15212c">
<h2 style="color:#16324f">Reset your Nirmaan password</h2>
<p>Hi {name},</p>
<p>Someone asked to reset your Nirmaan password. Click the button to choose a new one.</p>
<p><a href="{link}" style="background:#e09a24;color:#241600;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:bold;display:inline-block">Choose a new password</a></p>
<p style="color:#5b6b78;font-size:14px">The link works once and expires in {minutes} minutes. If you didn't ask for this, ignore this email; your password won't change.</p>
</div>"""
    return send_email(to, "Reset your Nirmaan password", text, html)
