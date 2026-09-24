import smtplib
from email.message import EmailMessage
from email.utils import formatdate, make_msgid

from app.config import settings


class EmailDeliveryError(Exception):
    pass


def send_invitation_email(*, recipient: str, temporary_password: str, role_name: str) -> None:
    if not settings.SMTP_HOST:
        raise EmailDeliveryError("Email delivery is not configured")

    message = EmailMessage()
    message["Subject"] = "Your Project Ops invitation"
    message["From"] = settings.SMTP_FROM
    message["To"] = recipient
    message["Date"] = formatdate(localtime=True)
    message["Message-ID"] = make_msgid()
    message["Reply-To"] = settings.SMTP_FROM
    message.set_content(
        "You have been invited to Project Ops.\n\n"
        f"Role: {role_name}\n"
        f"Email: {recipient}\n"
        f"Permanent password: {temporary_password}\n\n"
        "Sign in with this temporary password and complete your profile. "
        "Your profile details can only be changed by an administrator afterward."
    )

    try:
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=15) as server:
            if settings.SMTP_USE_TLS:
                server.starttls()
            if settings.SMTP_USERNAME:
                server.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD or "")
            server.send_message(message)
    except (OSError, smtplib.SMTPException) as exc:
        raise EmailDeliveryError("Could not send invitation email") from exc
