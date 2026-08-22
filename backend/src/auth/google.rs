// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

use std::sync::Arc;
use std::time::{Duration, Instant};

use anyhow::{anyhow, Context, Result};
use jsonwebtoken::{decode, decode_header, Algorithm, DecodingKey, Validation};
use serde::Deserialize;
use tokio::sync::RwLock;

const JWKS_URL: &str = "https://www.googleapis.com/oauth2/v3/certs";
const DEFAULT_TTL: Duration = Duration::from_secs(3600);

#[derive(Debug, Clone)]
pub struct GoogleIdentity {
    pub sub: String,
    pub email: String,
    pub name: String,
}

#[derive(Clone)]
pub struct GoogleVerifier {
    client_id: String,
    http: reqwest::Client,
    cache: Arc<RwLock<JwksCache>>,
}

struct JwksCache {
    keys: Vec<Jwk>,
    expires_at: Instant,
}

#[derive(Debug, Clone, Deserialize)]
struct JwksResponse {
    keys: Vec<Jwk>,
}

#[derive(Debug, Clone, Deserialize)]
struct Jwk {
    kid: String,
    n: String,
    e: String,
    #[serde(default)]
    alg: Option<String>,
    #[serde(default)]
    kty: Option<String>,
}

#[derive(Debug, Deserialize)]
struct GoogleClaims {
    sub: String,
    email: String,
    #[serde(deserialize_with = "deserialize_boolish")]
    email_verified: bool,
    name: Option<String>,
}

fn deserialize_boolish<'de, D>(deserializer: D) -> Result<bool, D::Error>
where
    D: serde::Deserializer<'de>,
{
    #[derive(Deserialize)]
    #[serde(untagged)]
    enum Boolish {
        Bool(bool),
        String(String),
    }
    match Boolish::deserialize(deserializer)? {
        Boolish::Bool(b) => Ok(b),
        Boolish::String(s) => Ok(matches!(s.to_ascii_lowercase().as_str(), "true" | "1")),
    }
}

impl GoogleVerifier {
    pub fn new(client_id: String) -> Self {
        Self {
            client_id,
            http: reqwest::Client::new(),
            cache: Arc::new(RwLock::new(JwksCache {
                keys: Vec::new(),
                expires_at: Instant::now(),
            })),
        }
    }

    pub async fn verify_id_token(&self, credential: &str) -> Result<GoogleIdentity> {
        let header = decode_header(credential).context("invalid google token header")?;
        let kid = header
            .kid
            .ok_or_else(|| anyhow!("google token missing kid"))?;

        let key = self.decoding_key_for_kid(&kid, false).await?;
        match self.decode_with_key(credential, &key) {
            Ok(identity) => Ok(identity),
            Err(first_err) => {
                // Unknown kid (or rotated keys): force one JWKS refetch then retry once.
                let key = self.decoding_key_for_kid(&kid, true).await?;
                self.decode_with_key(credential, &key).map_err(|_| first_err)
            }
        }
    }

    fn decode_with_key(&self, credential: &str, key: &DecodingKey) -> Result<GoogleIdentity> {
        let mut validation = Validation::new(Algorithm::RS256);
        validation.set_audience(&[self.client_id.clone()]);
        validation.set_issuer(&["https://accounts.google.com", "accounts.google.com"]);
        validation.validate_exp = true;

        let token = decode::<GoogleClaims>(credential, key, &validation)
            .context("google token verification failed")?;
        let claims = token.claims;
        if !claims.email_verified {
            return Err(anyhow!("google email not verified"));
        }
        let email = claims.email.trim().to_lowercase();
        if email.is_empty() || claims.sub.trim().is_empty() {
            return Err(anyhow!("google token missing email or sub"));
        }
        let name = claims
            .name
            .map(|n| n.trim().to_string())
            .filter(|n| !n.is_empty())
            .unwrap_or_else(|| {
                email
                    .split('@')
                    .next()
                    .unwrap_or("user")
                    .to_string()
            });
        Ok(GoogleIdentity {
            sub: claims.sub,
            email,
            name,
        })
    }

    async fn decoding_key_for_kid(&self, kid: &str, force_refresh: bool) -> Result<DecodingKey> {
        if !force_refresh {
            let guard = self.cache.read().await;
            if Instant::now() < guard.expires_at {
                if let Some(jwk) = guard.keys.iter().find(|k| k.kid == kid) {
                    return DecodingKey::from_rsa_components(&jwk.n, &jwk.e)
                        .context("invalid jwk rsa components");
                }
            }
        }

        self.refresh_jwks().await?;

        let guard = self.cache.read().await;
        let jwk = guard
            .keys
            .iter()
            .find(|k| k.kid == kid)
            .ok_or_else(|| anyhow!("google jwks missing kid {kid}"))?;
        DecodingKey::from_rsa_components(&jwk.n, &jwk.e).context("invalid jwk rsa components")
    }

    async fn refresh_jwks(&self) -> Result<()> {
        let resp = self
            .http
            .get(JWKS_URL)
            .send()
            .await
            .context("google jwks request failed")?;
        let status = resp.status();
        if !status.is_success() {
            return Err(anyhow!("google jwks http {status}"));
        }

        let ttl = parse_max_age(resp.headers().get(reqwest::header::CACHE_CONTROL))
            .unwrap_or(DEFAULT_TTL);
        let body: JwksResponse = resp.json().await.context("google jwks json parse failed")?;
        let keys: Vec<Jwk> = body
            .keys
            .into_iter()
            .filter(|k| {
                k.kty.as_deref().unwrap_or("RSA") == "RSA"
                    && k.alg.as_deref().unwrap_or("RS256") == "RS256"
            })
            .collect();
        if keys.is_empty() {
            return Err(anyhow!("google jwks empty"));
        }

        let mut guard = self.cache.write().await;
        guard.keys = keys;
        guard.expires_at = Instant::now() + ttl;
        tracing::debug!(ttl_secs = ttl.as_secs(), "google jwks refreshed");
        Ok(())
    }
}

fn parse_max_age(header: Option<&reqwest::header::HeaderValue>) -> Option<Duration> {
    let value = header?.to_str().ok()?;
    for part in value.split(',') {
        let part = part.trim();
        if let Some(rest) = part.strip_prefix("max-age=") {
            if let Ok(secs) = rest.trim().parse::<u64>() {
                return Some(Duration::from_secs(secs.max(60)));
            }
        }
    }
    None
}
