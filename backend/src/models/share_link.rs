// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[allow(dead_code)]
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct ShareLink {
    pub id: Uuid,
    pub token: String,
    pub target_type: String,
    pub target_id: Option<Uuid>,
    pub created_by: Uuid,
    pub auto_approve: bool,
    pub email_bound: Option<String>,
    pub expires_at: Option<DateTime<Utc>>,
    pub max_uses: Option<i32>,
    pub use_count: i32,
    pub join_count: i32,
    pub revoked_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
}
