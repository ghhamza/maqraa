// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

use axum::{
    extract::{Path, Query, State},
    http::{header::CACHE_CONTROL, HeaderMap, HeaderValue, StatusCode},
    Json,
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::{FromRow, QueryBuilder};
use uuid::Uuid;

use crate::api::extractors::AuthenticatedUser;
use crate::api::AppState;

#[derive(Deserialize)]
pub struct ListPublicHalaqatQuery {
    pub limit: Option<i64>,
    pub halaqah_type: Option<String>,
}

#[derive(Serialize)]
pub struct PublicHalaqatResponse {
    pub items: Vec<PublicHalaqahItem>,
    pub total: i64,
    pub generated_at: DateTime<Utc>,
}

#[derive(Serialize)]
pub struct PublicHalaqahItem {
    pub id: Uuid,
    pub name: String,
    pub teacher_name: String,
    pub halaqah_type: String,
    pub riwaya: String,
    pub description: Option<String>,
    pub max_students: i32,
    pub enrolled_count: i64,
    pub seats_left: i64,
    pub can_enroll: bool,
    pub requires_approval: bool,
    pub enrollment_deadline_at: Option<DateTime<Utc>>,
    pub timezone: String,
    pub next_session: Option<PublicNextSession>,
    pub is_live: bool,
    pub join_url: String,
}

#[derive(Serialize)]
pub struct PublicNextSession {
    pub scheduled_at: DateTime<Utc>,
    pub duration_minutes: i32,
}

#[derive(FromRow)]
struct PublicHalaqahRow {
    id: Uuid,
    name: String,
    teacher_name: String,
    halaqah_type: String,
    riwaya: String,
    description: Option<String>,
    max_students: i32,
    enrolled_count: i64,
    enrollment_open: bool,
    requires_approval: bool,
    enrollment_deadline_at: Option<DateTime<Utc>>,
    timezone: String,
    next_scheduled_at: Option<DateTime<Utc>>,
    next_duration_minutes: Option<i32>,
    is_live: bool,
}

#[derive(Deserialize)]
pub struct SetWebsiteListingRequest {
    pub website_listed: bool,
}

#[derive(Serialize)]
pub struct WebsiteListingResponse {
    pub id: Uuid,
    pub website_listed: bool,
}

const LISTING_WHERE: &str = " r.is_public = true AND r.is_active = true \
     AND r.website_listed = true AND r.setup_completed_at IS NOT NULL";

fn parse_halaqah_type(s: &str) -> Result<&str, StatusCode> {
    match s {
        "hifz" | "tilawa" | "muraja" | "tajweed" => Ok(s),
        _ => Err(StatusCode::BAD_REQUEST),
    }
}

fn apply_listing_filters<'a>(
    qb: &mut QueryBuilder<'a, sqlx::Postgres>,
    halaqah_type: Option<&'a str>,
) {
    qb.push(" WHERE");
    qb.push(LISTING_WHERE);
    if let Some(ht) = halaqah_type {
        qb.push(" AND r.halaqah_type::text = ");
        qb.push_bind(ht);
    }
}

pub async fn list_public_halaqat(
    State(state): State<AppState>,
    Query(params): Query<ListPublicHalaqatQuery>,
) -> Result<(HeaderMap, Json<PublicHalaqatResponse>), StatusCode> {
    let limit = params.limit.unwrap_or(50).clamp(1, 100);
    let halaqah_type = match params.halaqah_type.as_deref().map(str::trim) {
        Some("") | None => None,
        Some(raw) => Some(parse_halaqah_type(raw)?),
    };

    let mut qb_count = QueryBuilder::new(
        "SELECT COUNT(r.id)::bigint FROM rooms r INNER JOIN users u ON u.id = r.teacher_id",
    );
    apply_listing_filters(&mut qb_count, halaqah_type);
    let total: i64 = qb_count
        .build_query_scalar()
        .fetch_one(&state.db)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let mut qb = QueryBuilder::new(
        "SELECT r.id, r.name, u.name AS teacher_name, \
         r.halaqah_type::text AS halaqah_type, r.riwaya::text AS riwaya, \
         r.description, r.max_students, \
         COALESCE((SELECT COUNT(*)::bigint FROM enrollments e WHERE e.room_id = r.id AND e.status = 'approved'), 0) AS enrolled_count, \
         r.enrollment_open, r.requires_approval, r.enrollment_deadline_at, r.timezone, \
         ns.scheduled_at AS next_scheduled_at, ns.duration_minutes AS next_duration_minutes, \
         EXISTS (SELECT 1 FROM sessions s WHERE s.room_id = r.id AND s.status = 'in_progress') AS is_live \
         FROM rooms r \
         INNER JOIN users u ON u.id = r.teacher_id \
         LEFT JOIN LATERAL ( \
             SELECT scheduled_at, duration_minutes \
             FROM sessions \
             WHERE room_id = r.id AND status = 'scheduled' AND scheduled_at >= NOW() \
             ORDER BY scheduled_at LIMIT 1 \
         ) ns ON true",
    );
    apply_listing_filters(&mut qb, halaqah_type);
    qb.push(
        " ORDER BY is_live DESC, r.enrollment_open DESC, ns.scheduled_at ASC NULLS LAST, r.created_at DESC",
    );
    qb.push(" LIMIT ");
    qb.push_bind(limit);

    let rows = qb
        .build_query_as::<PublicHalaqahRow>()
        .fetch_all(&state.db)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let now = Utc::now();
    let base = state.config.app_base_url.trim_end_matches('/');
    let items = rows
        .into_iter()
        .map(|row| {
            let seats_left = (row.max_students as i64 - row.enrolled_count).max(0);
            let deadline_ok = row
                .enrollment_deadline_at
                .map(|d| d > now)
                .unwrap_or(true);
            let can_enroll = row.enrollment_open && deadline_ok && seats_left > 0;
            let next_session = match (row.next_scheduled_at, row.next_duration_minutes) {
                (Some(scheduled_at), Some(duration_minutes)) => Some(PublicNextSession {
                    scheduled_at,
                    duration_minutes,
                }),
                _ => None,
            };
            PublicHalaqahItem {
                join_url: format!("{base}/register?next=%2Frooms%2F{}", row.id),
                id: row.id,
                name: row.name,
                teacher_name: row.teacher_name,
                halaqah_type: row.halaqah_type,
                riwaya: row.riwaya,
                description: row.description,
                max_students: row.max_students,
                enrolled_count: row.enrolled_count,
                seats_left,
                can_enroll,
                requires_approval: row.requires_approval,
                enrollment_deadline_at: row.enrollment_deadline_at,
                timezone: row.timezone,
                next_session,
                is_live: row.is_live,
            }
        })
        .collect();

    let mut headers = HeaderMap::new();
    headers.insert(
        CACHE_CONTROL,
        HeaderValue::from_static("public, max-age=120, s-maxage=300"),
    );
    Ok((
        headers,
        Json(PublicHalaqatResponse {
            items,
            total,
            generated_at: now,
        }),
    ))
}

pub async fn set_website_listing(
    State(state): State<AppState>,
    auth: AuthenticatedUser,
    Path(id): Path<Uuid>,
    Json(req): Json<SetWebsiteListingRequest>,
) -> Result<Json<WebsiteListingResponse>, StatusCode> {
    if auth.role != "admin" {
        return Err(StatusCode::FORBIDDEN);
    }

    let website_listed: bool = sqlx::query_scalar(
        "UPDATE rooms SET website_listed = $1 WHERE id = $2 RETURNING website_listed",
    )
    .bind(req.website_listed)
    .bind(id)
    .fetch_optional(&state.db)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
    .ok_or(StatusCode::NOT_FOUND)?;

    tracing::info!(
        room_id = %id,
        admin_id = %auth.id,
        website_listed,
        "updated room website listing"
    );

    Ok(Json(WebsiteListingResponse {
        id,
        website_listed,
    }))
}
