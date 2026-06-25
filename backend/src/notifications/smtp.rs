// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

use lettre::message::header::ContentType;
use lettre::message::{MultiPart, SinglePart};
use lettre::transport::smtp::authentication::Credentials;
use lettre::transport::smtp::client::{Tls, TlsParameters};
use lettre::{AsyncSmtpTransport, AsyncTransport, Message, Tokio1Executor};

use crate::config::SmtpConfig;

use super::provider::{EmailError, EmailProvider, OutboundEmail};

pub struct SmtpProvider {
    mailer: AsyncSmtpTransport<Tokio1Executor>,
    from: String,
    debug: bool,
}

impl SmtpProvider {
    pub fn new(config: &SmtpConfig, from_name: &str, from_email: &str) -> Result<Self, EmailError> {
        config
            .validate()
            .map_err(|e| EmailError::SendFailed(e.to_string()))?;

        let mailer = build_mailer(config).map_err(|e| EmailError::SendFailed(e.to_string()))?;

        Ok(Self {
            mailer,
            from: format!("{from_name} <{from_email}>"),
            debug: config.debug,
        })
    }
}

fn build_mailer(config: &SmtpConfig) -> anyhow::Result<AsyncSmtpTransport<Tokio1Executor>> {
    let host = config.host.as_str();
    let creds = Credentials::new(config.username.clone(), config.password.clone());
    let use_auth = !config.username.is_empty();

    let mailer = match config.encryption {
        crate::config::SmtpEncryption::None => {
            let mut builder =
                AsyncSmtpTransport::<Tokio1Executor>::builder_dangerous(host).port(config.port);
            if use_auth {
                builder = builder.credentials(creds);
            }
            builder.build()
        }
        crate::config::SmtpEncryption::StartTls => {
            let mut transport = AsyncSmtpTransport::<Tokio1Executor>::relay(host)?;
            if config.port != 587 {
                transport = transport.port(config.port);
            }
            if use_auth {
                transport = transport.credentials(creds);
            }
            transport.build()
        }
        crate::config::SmtpEncryption::SslTls => {
            let tls = TlsParameters::new(host.to_string())?;
            let mut builder = AsyncSmtpTransport::<Tokio1Executor>::builder_dangerous(host)
                .port(config.port)
                .tls(Tls::Wrapper(tls));
            if use_auth {
                builder = builder.credentials(creds);
            }
            builder.build()
        }
    };

    Ok(mailer)
}

#[async_trait::async_trait]
impl EmailProvider for SmtpProvider {
    async fn send(&self, email: &OutboundEmail) -> Result<(), EmailError> {
        if self.debug {
            tracing::debug!(
                to = %email.to,
                subject = %email.subject,
                "smtp: sending message"
            );
        }

        let message = Message::builder()
            .from(
                self.from
                    .parse()
                    .map_err(|e| EmailError::SendFailed(format!("invalid from address: {e}")))?,
            )
            .to(email
                .to
                .parse()
                .map_err(|e| EmailError::SendFailed(format!("invalid to address: {e}")))?)
            .subject(&email.subject)
            .multipart(
                MultiPart::alternative()
                    .singlepart(
                        SinglePart::builder()
                            .header(ContentType::TEXT_PLAIN)
                            .body(email.text.clone()),
                    )
                    .singlepart(
                        SinglePart::builder()
                            .header(ContentType::TEXT_HTML)
                            .body(email.html.clone()),
                    ),
            )
            .map_err(|e| EmailError::SendFailed(format!("failed to build message: {e}")))?;

        self.mailer
            .send(message)
            .await
            .map(|_| ())
            .map_err(|e| EmailError::SendFailed(e.to_string()))
    }
}

#[cfg(test)]
mod smtp_tests {
    use crate::config::SmtpEncryption;

    #[test]
    fn smtp_encryption_parses_odoo_style_values() {
        assert_eq!(
            SmtpEncryption::parse("ssl_tls").unwrap(),
            SmtpEncryption::SslTls
        );
        assert_eq!(
            SmtpEncryption::parse("SSL/TLS").unwrap(),
            SmtpEncryption::SslTls
        );
        assert_eq!(
            SmtpEncryption::parse("starttls").unwrap(),
            SmtpEncryption::StartTls
        );
        assert_eq!(
            SmtpEncryption::parse("TLS (STARTTLS)").unwrap(),
            SmtpEncryption::StartTls
        );
        assert_eq!(SmtpEncryption::parse("none").unwrap(), SmtpEncryption::None);
    }
}
