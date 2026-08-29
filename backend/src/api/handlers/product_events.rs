// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

use axum::{extract::State, http::StatusCode, Json};
use serde::Deserialize;

use crate::api::extractors::AuthenticatedUser;
use crate::api::handlers::auth::ApiMessage;
use crate::api::AppState;
use crate::services::product_events;

#[derive(Deserialize)]
pub struct TrackProductEventRequest {
    pub event_name: String,
}

fn is_whitelisted(name: &str) -> bool {
    matches!(
        name,
        "demo_started" | "demo_completed" | "reminder_whatsapp_opened"
    )
}

/// Authenticated client-side funnel events (strict whitelist).
pub async fn track_client_event(
    State(state): State<AppState>,
    auth: AuthenticatedUser,
    Json(req): Json<TrackProductEventRequest>,
) -> Result<StatusCode, (StatusCode, Json<ApiMessage>)> {
    let name = req.event_name.trim();
    if !is_whitelisted(name) {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(ApiMessage {
                message: "event_name not allowed",
                code: "invalid_event_name",
            }),
        ));
    }

    product_events::track(
        &state.db,
        name,
        Some(auth.id),
        Some(auth.role.as_str()),
        serde_json::json!({}),
    )
    .await;

    Ok(StatusCode::NO_CONTENT)
}
