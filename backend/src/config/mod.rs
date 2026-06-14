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
    pub email_from_email: String,
    pub email_from_name: String,
    pub app_base_url: String,
    pub notifications_enabled: bool,
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
            email_from_email: std::env::var("EMAIL_FROM_EMAIL")
                .unwrap_or_else(|_| "no-reply@maqraa.org".into()),
            email_from_name: std::env::var("EMAIL_FROM_NAME")
                .unwrap_or_else(|_| "المقرأة".into()),
            app_base_url: std::env::var("APP_BASE_URL")
                .unwrap_or_else(|_| "http://localhost:5173".into()),
            notifications_enabled: std::env::var("NOTIFICATIONS_ENABLED")
                .map(|v| matches!(v.to_lowercase().as_str(), "1" | "true" | "yes"))
                .unwrap_or(false),
        })
    }
}

#[cfg(test)]
mod config_tests {
    use std::path::Path;

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
