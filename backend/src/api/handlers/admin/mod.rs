// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

mod funnel;
mod queries;
mod types;

use axum::{
    extract::{Query, State},
    http::StatusCode,
    Json,
};
use chrono::Utc;
use serde::Deserialize;

use crate::api::extractors::AuthenticatedUser;
use crate::api::AppState;

pub use funnel::funnel;
pub use types::AdminDashboard;

use queries::{
    load_activity, load_demographics, load_halaqat, load_teaching, load_timeseries, load_totals,
};

#[derive(Deserialize)]
pub struct DashboardQuery {
    pub days: Option<i32>,
}

fn require_admin(auth: &AuthenticatedUser) -> Result<(), StatusCode> {
    if auth.role != "admin" {
        return Err(StatusCode::FORBIDDEN);
    }
    Ok(())
}

fn parse_range_days(raw: Option<i32>) -> i32 {
    match raw {
        Some(0) | Some(30) | Some(90) | Some(365) => raw.unwrap(),
        _ => 0,
    }
}

pub async fn dashboard(
    State(state): State<AppState>,
    auth: AuthenticatedUser,
    Query(q): Query<DashboardQuery>,
) -> Result<Json<AdminDashboard>, StatusCode> {
    require_admin(&auth)?;
    let range_days = parse_range_days(q.days);
    let db = &state.db;

    let (totals, activity, demographics, halaqat, teaching, timeseries) = tokio::try_join!(
        load_totals(db),
        load_activity(db),
        load_demographics(db),
        load_halaqat(db),
        load_teaching(db),
        load_timeseries(db, range_days),
    )?;

    Ok(Json(AdminDashboard {
        generated_at: Utc::now(),
        range_days,
        totals,
        activity,
        demographics,
        halaqat,
        teaching,
        timeseries,
    }))
}
