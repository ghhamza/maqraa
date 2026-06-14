# Email providers

Al-Maqraa sends transactional email through a pluggable `EmailProvider` trait. The default build ships a single provider, **Resend**, selected via `EMAIL_PROVIDER=resend` and configured with `RESEND_API_KEY`.

**To use a different provider** (SMTP, Amazon SES, Postfix, Mailgun, your own relay): implement the `EmailProvider` trait in `provider.rs` (a `send(&OutboundEmail)` method), add a match arm for its name in `build_provider`, and set `EMAIL_PROVIDER` to that name. The queue, worker, templates, and all email copy are provider-agnostic — only `provider.rs` changes. An SMTP impl via the `lettre` crate is the obvious first community provider.
