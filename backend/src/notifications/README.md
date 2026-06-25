# Email providers

Al-Maqraa sends transactional email through a pluggable `EmailProvider` trait. The queue, worker, templates, and all email copy are provider-agnostic — only the provider module changes.

## Built-in providers

| `EMAIL_PROVIDER` | Use case | Required env |
|------------------|----------|--------------|
| `resend` (default) | [Resend](https://resend.com) HTTP API | `RESEND_API_KEY` |
| `smtp` | Any SMTP relay — **Amazon SES**, Postfix, Mailgun SMTP, etc. | `SMTP_HOST`, `SMTP_USERNAME`, `SMTP_PASSWORD` |

Shared for all providers: `EMAIL_FROM_EMAIL`, `EMAIL_FROM_NAME`, `NOTIFICATIONS_ENABLED=true`.

### SMTP options

Matches typical admin panels (e.g. Odoo outgoing mail):

| Variable | Description | Example (Amazon SES) |
|----------|-------------|----------------------|
| `SMTP_HOST` | SMTP server hostname | `email-smtp.eu-west-1.amazonaws.com` |
| `SMTP_PORT` | Port (defaults by encryption if omitted) | `465` (ssl_tls) or `587` (starttls) |
| `SMTP_ENCRYPTION` | `none`, `starttls`, or `ssl_tls` | `ssl_tls` |
| `SMTP_USERNAME` | SMTP login (SES SMTP credentials) | IAM SMTP username |
| `SMTP_PASSWORD` | SMTP password | SES SMTP password |
| `SMTP_DEBUG` | Log recipient/subject before send | `false` |

**Encryption modes:**

- `none` — plain SMTP (local/trusted relays only)
- `starttls` — STARTTLS after connect (port 587)
- `ssl_tls` — implicit TLS / SMTPS (port 465; Odoo “SSL/TLS”)

### Example: Amazon SES (SSL/TLS, port 465)

```env
EMAIL_PROVIDER=smtp
SMTP_HOST=email-smtp.eu-west-1.amazonaws.com
SMTP_PORT=465
SMTP_ENCRYPTION=ssl_tls
SMTP_USERNAME=AKIA...
SMTP_PASSWORD=...
EMAIL_FROM_EMAIL=no-reply@maqraa.org
EMAIL_FROM_NAME="المقرأة"
NOTIFICATIONS_ENABLED=true
```

Verify the sender domain/address in SES and leave the sandbox before sending to arbitrary recipients.

## Adding another provider

Implement `EmailProvider` in `provider.rs` (a `send(&OutboundEmail)` method), add a match arm in `build_provider`, and set `EMAIL_PROVIDER` to its name.
