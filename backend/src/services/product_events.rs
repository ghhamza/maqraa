// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

use sqlx::PgPool;
use uuid::Uuid;

/// Fire-and-forget product event insert. Never fails the caller.
pub async fn track(
    pool: &PgPool,
    event_name: &str,
    user_id: Option<Uuid>,
    user_role: Option<&str>,
    metadata: serde_json::Value,
) {
    let result = sqlx::query(
        "INSERT INTO product_events (event_name, user_id, user_role, metadata) \
         VALUES ($1, $2, $3, $4)",
    )
    .bind(event_name)
    .bind(user_id)
    .bind(user_role)
    .bind(metadata)
    .execute(pool)
    .await;

    if let Err(e) = result {
        tracing::warn!(
            error = %e,
            event_name,
            user_id = ?user_id,
            "product_events insert failed"
        );
    }
}
