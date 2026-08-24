// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

//! Live-session freehand strokes (`session_strokes`).

use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    Json,
};
use serde::Deserialize;
use serde_json::Value;
use sqlx::Postgres;
use uuid::Uuid;

use crate::api::extractors::AuthenticatedUser;
use crate::api::handlers::sessions::{can_access_room, fetch_session_public};
use crate::api::types::SessionStrokePublic;
use crate::api::AppState;

const MAX_POINTS: usize = 2000;
const ALLOWED_COLORS: &[&str] = &["#EF5350", "#185fa5", "#D4A843"];
const MIN_WIDTH: f32 = 0.001;
const MAX_WIDTH: f32 = 0.08;

#[derive(Deserialize)]
pub struct ListStrokesQuery {
    /// Filter surface:
    /// - omit → all strokes for the session
    /// - `board` → board surface (`page IS NULL`)
    /// - integer `1`–`604` → mushaf page
    pub page: Option<String>,
}

/// GET `/api/sessions/:id/strokes?page=`
///
/// `page` filter: omitted = all; `board` = board surface; numeric = mushaf page.
pub async fn list_session_strokes(
    State(state): State<AppState>,
    auth: AuthenticatedUser,
    Path(session_id): Path<Uuid>,
    Query(query): Query<ListStrokesQuery>,
) -> Result<Json<Vec<SessionStrokePublic>>, StatusCode> {
    let session = fetch_session_public(&state.db, session_id)
        .await?
        .ok_or(StatusCode::NOT_FOUND)?;
    if !can_access_room(&state.db, &auth, session.room_id).await? {
        return Err(StatusCode::FORBIDDEN);
    }

    let page_filter = parse_page_filter(query.page.as_deref())?;

    let strokes = match page_filter {
        PageFilter::All => {
            sqlx::query_as::<Postgres, SessionStrokePublic>(
                "SELECT id, session_id, page, points, color, width, created_by, created_at \
                 FROM session_strokes WHERE session_id = $1 \
                 ORDER BY created_at ASC, id ASC",
            )
            .bind(session_id)
            .fetch_all(&state.db)
            .await
        }
        PageFilter::Board => {
            sqlx::query_as::<Postgres, SessionStrokePublic>(
                "SELECT id, session_id, page, points, color, width, created_by, created_at \
                 FROM session_strokes WHERE session_id = $1 AND page IS NULL \
                 ORDER BY created_at ASC, id ASC",
            )
            .bind(session_id)
            .fetch_all(&state.db)
            .await
        }
        PageFilter::Page(n) => {
            sqlx::query_as::<Postgres, SessionStrokePublic>(
                "SELECT id, session_id, page, points, color, width, created_by, created_at \
                 FROM session_strokes WHERE session_id = $1 AND page = $2 \
                 ORDER BY created_at ASC, id ASC",
            )
            .bind(session_id)
            .bind(n)
            .fetch_all(&state.db)
            .await
        }
    }
    .map_err(|e| {
        tracing::error!(error = %e, %session_id, "list session_strokes failed");
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    Ok(Json(strokes))
}

enum PageFilter {
    All,
    Board,
    Page(i32),
}

fn parse_page_filter(raw: Option<&str>) -> Result<PageFilter, StatusCode> {
    let Some(s) = raw.map(str::trim).filter(|s| !s.is_empty()) else {
        return Ok(PageFilter::All);
    };
    if s.eq_ignore_ascii_case("board") {
        return Ok(PageFilter::Board);
    }
    let n: i32 = s.parse().map_err(|_| StatusCode::BAD_REQUEST)?;
    if !(1..=604).contains(&n) {
        return Err(StatusCode::BAD_REQUEST);
    }
    Ok(PageFilter::Page(n))
}

/// Validate and normalize stroke payload for WS insert.
pub fn validate_stroke_payload(
    page: Option<i32>,
    points: &Value,
    color: &str,
    width: f32,
) -> Result<Value, &'static str> {
    if let Some(p) = page {
        if !(1..=604).contains(&p) {
            return Err("invalid_page");
        }
    }
    if !ALLOWED_COLORS.iter().any(|c| c.eq_ignore_ascii_case(color)) {
        return Err("invalid_color");
    }
    if !(MIN_WIDTH..=MAX_WIDTH).contains(&width) || !width.is_finite() {
        return Err("invalid_width");
    }
    let arr = points.as_array().ok_or("invalid_points")?;
    if arr.is_empty() || arr.len() > MAX_POINTS {
        return Err("invalid_points");
    }
    let mut normalized = Vec::with_capacity(arr.len());
    for pt in arr {
        let coords = pt.as_array().ok_or("invalid_points")?;
        if coords.len() < 2 || coords.len() > 3 {
            return Err("invalid_points");
        }
        let x = coords[0].as_f64().ok_or("invalid_points")?;
        let y = coords[1].as_f64().ok_or("invalid_points")?;
        let pressure = coords
            .get(2)
            .and_then(|v| v.as_f64())
            .unwrap_or(0.5);
        if !(0.0..=1.0).contains(&x)
            || !(0.0..=1.0).contains(&y)
            || !(0.0..=1.0).contains(&pressure)
            || !x.is_finite()
            || !y.is_finite()
            || !pressure.is_finite()
        {
            return Err("invalid_points");
        }
        normalized.push(serde_json::json!([x, y, pressure]));
    }
    Ok(Value::Array(normalized))
}

pub async fn insert_stroke(
    pool: &sqlx::PgPool,
    session_id: Uuid,
    page: Option<i32>,
    points: Value,
    color: &str,
    width: f32,
    created_by: Uuid,
) -> Result<SessionStrokePublic, sqlx::Error> {
    // Canonicalize allowed color casing.
    let color_canon = ALLOWED_COLORS
        .iter()
        .find(|c| c.eq_ignore_ascii_case(color))
        .copied()
        .unwrap_or(color);
    sqlx::query_as::<Postgres, SessionStrokePublic>(
        "INSERT INTO session_strokes (session_id, page, points, color, width, created_by) \
         VALUES ($1, $2, $3, $4, $5, $6) \
         RETURNING id, session_id, page, points, color, width, created_by, created_at",
    )
    .bind(session_id)
    .bind(page)
    .bind(points)
    .bind(color_canon)
    .bind(width)
    .bind(created_by)
    .fetch_one(pool)
    .await
}

pub async fn delete_last_teacher_stroke(
    pool: &sqlx::PgPool,
    session_id: Uuid,
    page: Option<i32>,
    teacher_id: Uuid,
) -> Result<Option<Uuid>, sqlx::Error> {
    let id: Option<Uuid> = if page.is_none() {
        sqlx::query_scalar(
            "DELETE FROM session_strokes \
             WHERE id = ( \
               SELECT id FROM session_strokes \
               WHERE session_id = $1 AND page IS NULL AND created_by = $2 \
               ORDER BY created_at DESC, id DESC \
               LIMIT 1 \
             ) \
             RETURNING id",
        )
        .bind(session_id)
        .bind(teacher_id)
        .fetch_optional(pool)
        .await?
    } else {
        sqlx::query_scalar(
            "DELETE FROM session_strokes \
             WHERE id = ( \
               SELECT id FROM session_strokes \
               WHERE session_id = $1 AND page = $2 AND created_by = $3 \
               ORDER BY created_at DESC, id DESC \
               LIMIT 1 \
             ) \
             RETURNING id",
        )
        .bind(session_id)
        .bind(page)
        .bind(teacher_id)
        .fetch_optional(pool)
        .await?
    };
    Ok(id)
}

pub async fn clear_strokes_for_surface(
    pool: &sqlx::PgPool,
    session_id: Uuid,
    page: Option<i32>,
) -> Result<u64, sqlx::Error> {
    let result = if page.is_none() {
        sqlx::query("DELETE FROM session_strokes WHERE session_id = $1 AND page IS NULL")
            .bind(session_id)
            .execute(pool)
            .await?
    } else {
        sqlx::query("DELETE FROM session_strokes WHERE session_id = $1 AND page = $2")
            .bind(session_id)
            .bind(page)
            .execute(pool)
            .await?
    };
    Ok(result.rows_affected())
}
