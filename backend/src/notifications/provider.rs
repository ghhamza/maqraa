// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

use std::sync::Arc;

use crate::config::AppConfig;

#[derive(Debug, thiserror::Error)]
pub enum EmailError {
    #[error("email send failed: {0}")]
    SendFailed(String),
}

#[derive(Debug, Clone)]
pub struct EmailAttachment {
    pub filename: String,
    pub content: Vec<u8>,
    pub content_type: String,
}

#[derive(Debug, Clone)]
pub struct OutboundEmail {
    pub to: String,
    pub subject: String,
    pub html: String,
    pub text: String,
    pub attachments: Vec<EmailAttachment>,
}

#[async_trait::async_trait]
pub trait EmailProvider: Send + Sync {
    async fn send(&self, email: &OutboundEmail) -> Result<(), EmailError>;
}

pub struct ResendProvider {
    client: resend_rs::Resend,
    from: String,
}

impl ResendProvider {
    pub fn new(api_key: &str, from_name: &str, from_email: &str) -> Self {
        Self {
            client: resend_rs::Resend::new(api_key),
            from: format!("{from_name} <{from_email}>"),
        }
    }
}

#[async_trait::async_trait]
impl EmailProvider for ResendProvider {
    async fn send(&self, email: &OutboundEmail) -> Result<(), EmailError> {
        use resend_rs::types::{CreateAttachment, CreateEmailBaseOptions};

        let mut opts = CreateEmailBaseOptions::new(&self.from, [&email.to], &email.subject)
            .with_html(&email.html)
            .with_text(&email.text);

        for att in &email.attachments {
            let attachment = CreateAttachment::from_content(att.content.clone())
                .with_filename(&att.filename)
                .with_content_type(&att.content_type);
            opts = opts.with_attachment(attachment);
        }

        self.client
            .emails
            .send(opts)
            .await
            .map(|_| ())
            .map_err(|e| EmailError::SendFailed(e.to_string()))
    }
}

pub fn build_provider(config: &AppConfig) -> anyhow::Result<Arc<dyn EmailProvider>> {
    match config.email_provider.as_str() {
        "resend" => {
            if config.resend_api_key.is_empty() {
                anyhow::bail!("RESEND_API_KEY is required when EMAIL_PROVIDER=resend");
            }
            Ok(Arc::new(ResendProvider::new(
                &config.resend_api_key,
                &config.email_from_name,
                &config.email_from_email,
            )))
        }
        other => anyhow::bail!(
            "unsupported EMAIL_PROVIDER \"{other}\" — supported providers: resend"
        ),
    }
}
