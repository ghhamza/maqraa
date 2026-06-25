// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

use std::path::Path;

use anyhow::Result;

use crate::media::{LivekitConfig, MediaBackend};

fn load_dotenv() {
    let manifest_env = Path::new(env!("CARGO_MANIFEST_DIR")).join(".env");
    if let Err(e) = dotenvy::from_path_override(&manifest_env) {
        tracing::warn!(
            path = %manifest_env.display(),
            error = %e,
            "failed to parse backend/.env — quote values that contain spaces (e.g. QF_SCOPES)"
        );
        dotenvy::dotenv().ok();
    }
}

#[derive(Debug, Clone)]
pub struct AppConfig {
    pub host: String,
    pub port: u16,
    pub database_url: String,
    pub jwt_secret: String,
    pub recordings_path: String,
    pub qf_env: String,
    pub qf_client_id: String,
    pub qf_client_secret: String,
    pub qf_redirect_uri: String,
    pub qf_scopes: String,
    pub qf_audio_cdn_base_url: String,
    /// Selector for the media backend. Currently only `Livekit` is supported.
    /// Retained for future variants (e.g. a self-hosted mediasoup sidecar).
    #[allow(dead_code)]
    pub media_backend: MediaBackend,
    pub livekit: LivekitConfig,
    pub email_provider: String,
    pub resend_api_key: String,
    pub smtp: SmtpConfig,
    pub email_from_email: String,
    pub email_from_name: String,
    pub app_base_url: String,
    /// Public-facing app URL for share links (`{public_base_url}/s/{token}`).
    pub public_base_url: String,
    /// IANA timezone for formatting session times in emails (e.g. Asia/Riyadh).
    pub app_display_tz: String,
    /// Local hour (0–23 in APP_DISPLAY_TZ) when the daily new-signup digest may send.
    pub digest_send_hour: u32,
    pub notifications_enabled: bool,
}

/// How the SMTP client negotiates transport security (matches common panel labels).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SmtpEncryption {
    /// Plain SMTP (no TLS). Use only on trusted local relays.
    None,
    /// STARTTLS on connect (typical port 587, e.g. Amazon SES submission).
    StartTls,
    /// Implicit TLS / SMTPS (typical port 465, e.g. Amazon SES with SSL/TLS).
    SslTls,
}

impl SmtpEncryption {
    pub fn parse(raw: &str) -> Result<Self, String> {
        match raw.trim().to_lowercase().as_str() {
            "none" | "plain" => Ok(Self::None),
            "starttls" | "tls" | "tls (starttls)" => Ok(Self::StartTls),
            "ssl_tls" | "ssl/tls" | "ssl" | "smtps" | "wrapper" => Ok(Self::SslTls),
            other => Err(format!(
                "unknown SMTP_ENCRYPTION \"{other}\" — use none, starttls, or ssl_tls"
            )),
        }
    }
}

#[derive(Debug, Clone)]
pub struct SmtpConfig {
    pub host: String,
    pub port: u16,
    pub username: String,
    pub password: String,
    pub encryption: SmtpEncryption,
    /// Log recipient/subject before each send (never logs credentials).
    pub debug: bool,
}

impl SmtpConfig {
    pub fn from_env() -> Self {
        let encryption = std::env::var("SMTP_ENCRYPTION")
            .unwrap_or_else(|_| "starttls".into())
            .parse()
            .unwrap_or(SmtpEncryption::StartTls);

        Self {
            host: std::env::var("SMTP_HOST").unwrap_or_default(),
            port: std::env::var("SMTP_PORT")
                .unwrap_or_else(|_| default_smtp_port(encryption).to_string())
                .parse()
                .unwrap_or_else(|_| default_smtp_port(encryption)),
            username: std::env::var("SMTP_USERNAME").unwrap_or_default(),
            password: std::env::var("SMTP_PASSWORD").unwrap_or_default(),
            encryption,
            debug: std::env::var("SMTP_DEBUG")
                .map(|v| matches!(v.to_lowercase().as_str(), "1" | "true" | "yes"))
                .unwrap_or(false),
        }
    }

    pub fn validate(&self) -> anyhow::Result<()> {
        if self.host.trim().is_empty() {
            anyhow::bail!("SMTP_HOST is required when EMAIL_PROVIDER=smtp");
        }
        if self.port == 0 {
            anyhow::bail!("SMTP_PORT must be a valid port number");
        }
        Ok(())
    }

    pub fn credentials_configured(&self) -> bool {
        !self.host.is_empty() && !self.username.is_empty()
    }
}

fn default_smtp_port(encryption: SmtpEncryption) -> u16 {
    match encryption {
        SmtpEncryption::SslTls => 465,
        SmtpEncryption::StartTls => 587,
        SmtpEncryption::None => 25,
    }
}

impl AppConfig {
    pub fn qf_auth_base_url(&self) -> String {
        if self.qf_env == "production" {
            "https://oauth2.quran.foundation".to_string()
        } else {
            "https://prelive-oauth2.quran.foundation".to_string()
        }
    }

    pub fn qf_api_base_url(&self) -> String {
        if self.qf_env == "production" {
            "https://apis.quran.foundation".to_string()
        } else {
            "https://apis-prelive.quran.foundation".to_string()
        }
    }

    pub fn load() -> Result<Self> {
        load_dotenv();

        Ok(Self {
            host: std::env::var("HOST").unwrap_or_else(|_| "0.0.0.0".into()),
            port: std::env::var("PORT").unwrap_or_else(|_| "3000".into()).parse()?,
            database_url: std::env::var("DATABASE_URL")?,
            jwt_secret: std::env::var("JWT_SECRET")?,
            recordings_path: std::env::var("RECORDINGS_PATH")
                .unwrap_or_else(|_| "./data/recordings".into()),
            qf_env: std::env::var("QF_ENV").unwrap_or_else(|_| "prelive".into()),
            qf_client_id: std::env::var("QF_CLIENT_ID").unwrap_or_default(),
            qf_client_secret: std::env::var("QF_CLIENT_SECRET").unwrap_or_default(),
            qf_redirect_uri: std::env::var("QF_REDIRECT_URI").unwrap_or_default().trim().to_string(),
            qf_scopes: std::env::var("QF_SCOPES")
                .unwrap_or_else(|_| "openid offline_access reading_session streak activity_day user".into()),
            qf_audio_cdn_base_url: std::env::var("QF_AUDIO_CDN_BASE_URL")
                .unwrap_or_else(|_| "https://audio.qurancdn.com".into()),
            media_backend: std::env::var("APP_MEDIA_BACKEND")
                .unwrap_or_else(|_| "livekit".into())
                .parse()
                .unwrap_or(MediaBackend::Livekit),
            livekit: LivekitConfig {
                url: std::env::var("APP_LIVEKIT_URL")
                    .unwrap_or_else(|_| "ws://localhost:7880".into()),
                http_url: std::env::var("APP_LIVEKIT_HTTP_URL")
                    .unwrap_or_else(|_| "http://localhost:7880".into()),
                api_key: std::env::var("APP_LIVEKIT_API_KEY")
                    .unwrap_or_else(|_| "devkey".into()),
                api_secret: std::env::var("APP_LIVEKIT_API_SECRET")
                    .unwrap_or_else(|_| "secret".into()),
            },
            email_provider: std::env::var("EMAIL_PROVIDER")
                .unwrap_or_else(|_| "resend".into()),
            resend_api_key: std::env::var("RESEND_API_KEY").unwrap_or_default(),
            smtp: SmtpConfig::from_env(),
            email_from_email: std::env::var("EMAIL_FROM_EMAIL")
                .unwrap_or_else(|_| "no-reply@maqraa.org".into()),
            email_from_name: std::env::var("EMAIL_FROM_NAME")
                .unwrap_or_else(|_| "المقرأة".into()),
            app_base_url: std::env::var("APP_BASE_URL")
                .unwrap_or_else(|_| "http://localhost:5173".into()),
            public_base_url: std::env::var("PUBLIC_BASE_URL").unwrap_or_else(|_| {
                std::env::var("APP_BASE_URL").unwrap_or_else(|_| "http://localhost:5173".into())
            }),
            app_display_tz: std::env::var("APP_DISPLAY_TZ")
                .unwrap_or_else(|_| "Asia/Riyadh".into()),
            digest_send_hour: std::env::var("DIGEST_SEND_HOUR")
                .unwrap_or_else(|_| "6".into())
                .parse()
                .unwrap_or(6)
                .min(23),
            notifications_enabled: std::env::var("NOTIFICATIONS_ENABLED")
                .map(|v| matches!(v.to_lowercase().as_str(), "1" | "true" | "yes"))
                .unwrap_or(false),
        })
    }
}

// Parse SMTP_ENCRYPTION from env (supports `none`, `starttls`, `ssl_tls`, and Odoo-style labels).
impl std::str::FromStr for SmtpEncryption {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        Self::parse(s)
    }
}

#[cfg(test)]
mod config_tests {
    use std::path::Path;

    #[test]
    fn smtp_encryption_from_env_values() {
        use super::SmtpEncryption;
        assert_eq!(
            "ssl_tls".parse::<SmtpEncryption>().unwrap(),
            SmtpEncryption::SslTls
        );
        assert_eq!(
            "starttls".parse::<SmtpEncryption>().unwrap(),
            SmtpEncryption::StartTls
        );
    }

    #[test]
    fn dotenv_loads_notifications_enabled() {
        let path = Path::new(env!("CARGO_MANIFEST_DIR")).join(".env");
        dotenvy::from_path_override(&path)
            .unwrap_or_else(|e| panic!("failed to parse {}: {e}", path.display()));
        assert_eq!(
            std::env::var("NOTIFICATIONS_ENABLED").unwrap_or_default(),
            "true"
        );
    }
}
