// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

//! Server-rendered shareable halaqah card PNG (`GET /s/{token}/card.png`).

mod data;
mod qr;
mod render;

pub use data::{
    arabic_riwaya_label, arabic_type_label, format_rhythm_ar, format_session_ar,
    resolve_public_halaqah, seats_available, PublicHalaqah, ShareCardError,
};
pub use render::{render_card_png, CardFormat};

use axum::{
    extract::{Path, Query, State},
    http::{
        header::{CACHE_CONTROL, CONTENT_TYPE, ETAG, IF_NONE_MATCH},
        HeaderMap, HeaderValue, StatusCode,
    },
    response::{IntoResponse, Response},
};
use serde::Deserialize;
use sha2::{Digest, Sha256};

use crate::api::AppState;

#[derive(Deserialize)]
pub struct CardQuery {
    pub format: Option<String>,
}

pub async fn share_card_png(
    State(state): State<AppState>,
    Path(token): Path<String>,
    Query(query): Query<CardQuery>,
    headers: HeaderMap,
) -> Response {
    let format = CardFormat::parse(query.format.as_deref());
    let halaqah = match resolve_public_halaqah(&state, &token).await {
        Ok(h) => h,
        Err(ShareCardError::NotFound) => return StatusCode::NOT_FOUND.into_response(),
        Err(ShareCardError::Db(e)) => {
            tracing::error!(error = %e, "share card resolve failed");
            return StatusCode::INTERNAL_SERVER_ERROR.into_response();
        }
    };

    let etag = card_etag(&halaqah, format);
    if let Some(inm) = headers.get(IF_NONE_MATCH).and_then(|v| v.to_str().ok()) {
        if inm.trim() == etag || inm.trim() == format!("\"{etag}\"") {
            return StatusCode::NOT_MODIFIED.into_response();
        }
    }

    let base = state.config.public_base_url.trim_end_matches('/');
    let png = match render_card_png(&halaqah, format, base) {
        Ok(bytes) => bytes,
        Err(e) => {
            tracing::error!(error = %e, "share card render failed");
            return StatusCode::INTERNAL_SERVER_ERROR.into_response();
        }
    };

    let mut res = Response::new(png.into());
    *res.status_mut() = StatusCode::OK;
    let h = res.headers_mut();
    h.insert(CONTENT_TYPE, HeaderValue::from_static("image/png"));
    // Short TTL + versioned ETag so template/logo changes are not stuck for an hour.
    h.insert(
        CACHE_CONTROL,
        HeaderValue::from_static("public, max-age=60, must-revalidate"),
    );
    if let Ok(v) = HeaderValue::from_str(&format!("\"{etag}\"")) {
        h.insert(ETAG, v);
    }
    res
}

/// Bump when SVG templates / brand lockup / layout change so ETags invalidate.
const CARD_RENDER_VERSION: &str = "v5-title-gap";

fn card_etag(h: &PublicHalaqah, format: CardFormat) -> String {
    let mut hasher = Sha256::new();
    hasher.update(CARD_RENDER_VERSION.as_bytes());
    hasher.update(h.token.as_bytes());
    hasher.update(format.as_str().as_bytes());
    hasher.update(h.name.as_bytes());
    hasher.update(h.teacher_name.as_bytes());
    hasher.update(h.enrolled_count.to_le_bytes());
    hasher.update(h.max_students.to_le_bytes());
    if let Some(at) = h.first_session_at {
        hasher.update(at.timestamp().to_le_bytes());
    }
    hasher.update(h.created_at.timestamp().to_le_bytes());
    let digest = hasher.finalize();
    digest.iter().take(8).map(|b| format!("{b:02x}")).collect()
}
