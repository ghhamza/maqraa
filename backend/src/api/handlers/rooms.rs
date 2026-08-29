// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    Json,
};
use chrono::{DateTime, Duration, Utc};
use serde::{Deserialize, Deserializer, Serialize};
use sqlx::{FromRow, QueryBuilder};
use uuid::Uuid;

use crate::api::extractors::AuthenticatedUser;
use crate::api::types::{Paginated, RoomFirstSession, RoomPublic, RoomStatsResponse, TeacherOption};
use crate::api::AppState;
use crate::entitlements::EntitlementContext;
use crate::riwaya::parse_riwaya;
use crate::timezone::{default_timezone, validate_iana_timezone};

/// Next upcoming scheduled session, else most recent scheduled — same rule as share card.
pub async fn fetch_first_session(
    db: &sqlx::PgPool,
    room_id: Uuid,
) -> Result<Option<RoomFirstSession>, sqlx::Error> {
    #[derive(sqlx::FromRow)]
    struct Row {
        id: Uuid,
        scheduled_at: DateTime<Utc>,
        duration_minutes: i32,
        status: String,
    }

    let upcoming: Option<Row> = sqlx::query_as(
        "SELECT id, scheduled_at, duration_minutes, status::text AS status FROM sessions \
         WHERE room_id = $1 AND status = 'scheduled' AND scheduled_at >= NOW() \
         ORDER BY scheduled_at ASC LIMIT 1",
    )
    .bind(room_id)
    .fetch_optional(db)
    .await?;

    let row = match upcoming {
        Some(r) => Some(r),
        None => {
            sqlx::query_as(
                "SELECT id, scheduled_at, duration_minutes, status::text AS status FROM sessions \
                 WHERE room_id = $1 AND status = 'scheduled' \
                 ORDER BY scheduled_at DESC LIMIT 1",
            )
            .bind(room_id)
            .fetch_optional(db)
            .await?
        }
    };

    Ok(row.map(|r| RoomFirstSession {
        id: r.id,
        scheduled_at: r.scheduled_at,
        duration_minutes: r.duration_minutes,
        status: r.status,
    }))
}

async fn fetch_primary_share_token(
    db: &sqlx::PgPool,
    room_id: Uuid,
) -> Result<Option<String>, sqlx::Error> {
    sqlx::query_scalar(
        "SELECT token FROM share_links \
         WHERE target_id = $1 AND target_type IN ('halaqah', 'invite') \
         AND revoked_at IS NULL \
         AND (expires_at IS NULL OR expires_at > NOW()) \
         AND (max_uses IS NULL OR use_count < max_uses) \
         ORDER BY created_at ASC LIMIT 1",
    )
    .bind(room_id)
    .fetch_optional(db)
    .await
}

async fn enrich_room_detail(db: &sqlx::PgPool, mut room: RoomPublic) -> Result<RoomPublic, StatusCode> {
    room.first_session = fetch_first_session(db, room.id)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    room.share_token = fetch_primary_share_token(db, room.id)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(room)
}

/// Distinguish "field absent" from "field present and null".
/// Lets PUT requests express both "leave unchanged" and "clear to NULL".
fn deserialize_some<'de, T, D>(deserializer: D) -> Result<Option<Option<T>>, D::Error>
where
    T: Deserialize<'de>,
    D: Deserializer<'de>,
{
    Ok(Some(Option::deserialize(deserializer)?))
}

#[derive(Deserialize)]
pub struct ListRoomsQuery {
    pub search: Option<String>,
    pub active: Option<bool>,
    pub limit: Option<i64>,
    pub offset: Option<i64>,
    /// One of: hifz | tilawa | muraja | tajweed.
    pub halaqah_type: Option<String>,
    /// Validated via `parse_riwaya`.
    pub riwaya: Option<String>,
    /// Student-only: approved | pending | rejected | none (no enrollment).
    pub my_status: Option<String>,
    /// `Some(true)` = only public rooms; omitted = no filter.
    pub is_public: Option<bool>,
}

#[derive(Deserialize)]
pub struct CreateRoomRequest {
    pub name: String,
    pub teacher_id: Option<Uuid>,
    pub max_students: Option<i32>,
    pub riwaya: Option<String>,
    /// `hifz` | `tilawa` | `muraja` | `tajweed`
    pub halaqah_type: Option<String>,
    pub is_public: Option<bool>,
    pub enrollment_open: Option<bool>,
    pub requires_approval: Option<bool>,
    pub description: Option<String>,
    /// ISO 8601 timestamp; NULL means continuous enrollment.
    pub enrollment_deadline_at: Option<DateTime<Utc>>,
    /// IANA timezone; defaults to Asia/Riyadh when omitted or invalid.
    pub timezone: Option<String>,
}

#[derive(Deserialize)]
pub struct UpdateRoomRequest {
    pub name: Option<String>,
    pub max_students: Option<i32>,
    pub is_active: Option<bool>,
    pub riwaya: Option<String>,
    pub halaqah_type: Option<String>,
    pub is_public: Option<bool>,
    pub enrollment_open: Option<bool>,
    pub requires_approval: Option<bool>,
    /// Pass `Some(Some(text))` to set, `Some(None)` to clear, `None` to leave unchanged.
    #[serde(default, deserialize_with = "deserialize_some")]
    pub description: Option<Option<String>>,
    #[serde(default, deserialize_with = "deserialize_some")]
    pub enrollment_deadline_at: Option<Option<DateTime<Utc>>>,
    /// Optional IANA timezone update.
    pub timezone: Option<String>,
}

fn validate_description(s: Option<&str>) -> Result<(), StatusCode> {
    if let Some(text) = s {
        if text.len() > 2000 {
            return Err(StatusCode::BAD_REQUEST);
        }
    }
    Ok(())
}

fn validate_deadline(d: Option<DateTime<Utc>>, now: DateTime<Utc>) -> Result<(), StatusCode> {
    if let Some(dt) = d {
        if dt < now - Duration::days(1) {
            return Err(StatusCode::BAD_REQUEST);
        }
        if dt > now + Duration::days(365 * 10) {
            return Err(StatusCode::BAD_REQUEST);
        }
    }
    Ok(())
}

fn require_admin(auth: &AuthenticatedUser) -> Result<(), StatusCode> {
    if auth.role != "admin" {
        return Err(StatusCode::FORBIDDEN);
    }
    Ok(())
}

fn require_teacher_or_admin(auth: &AuthenticatedUser) -> Result<(), StatusCode> {
    match auth.role.as_str() {
        "teacher" | "admin" => Ok(()),
        _ => Err(StatusCode::FORBIDDEN),
    }
}

fn can_manage_room(auth: &AuthenticatedUser, room_teacher_id: Uuid) -> bool {
    auth.role == "admin" || (auth.role == "teacher" && auth.id == room_teacher_id)
}

fn parse_halaqah_type(s: &str) -> Result<&str, StatusCode> {
    match s {
        "hifz" | "tilawa" | "muraja" | "tajweed" => Ok(s),
        _ => Err(StatusCode::BAD_REQUEST),
    }
}

async fn is_valid_teacher(state: &AppState, id: Uuid) -> Result<bool, StatusCode> {
    let ok: bool = sqlx::query_scalar(
        "SELECT EXISTS(SELECT 1 FROM users WHERE id = $1 AND role = 'teacher'::user_role)",
    )
    .bind(id)
    .fetch_one(&state.db)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(ok)
}

pub async fn room_stats(
    State(state): State<AppState>,
    auth: AuthenticatedUser,
) -> Result<Json<RoomStatsResponse>, StatusCode> {
    match auth.role.as_str() {
        "admin" => {
            let row: (i64, i64, i64, i64, i64) = sqlx::query_as(
                "SELECT (SELECT COUNT(*)::bigint FROM rooms) AS total,
                        (SELECT COUNT(*)::bigint FROM rooms WHERE is_active) AS active,
                        (SELECT COUNT(*)::bigint FROM rooms WHERE NOT is_active) AS inactive,
                        (SELECT COUNT(*)::bigint FROM enrollments WHERE status = 'pending') AS pending,
                        (SELECT COUNT(*)::bigint FROM rooms WHERE is_active = false) AS archived",
            )
            .fetch_one(&state.db)
            .await
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
            Ok(Json(RoomStatsResponse {
                total: row.0,
                active: row.1,
                inactive: row.2,
                pending_count_total: row.3,
                archived_count: row.4,
            }))
        }
        "teacher" => {
            let row: (i64, i64, i64, i64, i64) = sqlx::query_as(
                "SELECT (SELECT COUNT(*)::bigint FROM rooms WHERE teacher_id = $1),
                        (SELECT COUNT(*)::bigint FROM rooms WHERE teacher_id = $1 AND is_active),
                        (SELECT COUNT(*)::bigint FROM rooms WHERE teacher_id = $1 AND NOT is_active),
                        (SELECT COUNT(*)::bigint FROM enrollments e INNER JOIN rooms r ON r.id = e.room_id \
                         WHERE r.teacher_id = $1 AND e.status = 'pending'),
                        (SELECT COUNT(*)::bigint FROM rooms WHERE teacher_id = $1 AND is_active = false)",
            )
            .bind(auth.id)
            .fetch_one(&state.db)
            .await
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
            Ok(Json(RoomStatsResponse {
                total: row.0,
                active: row.1,
                inactive: row.2,
                pending_count_total: row.3,
                archived_count: row.4,
            }))
        }
        "student" => {
            let total: i64 = sqlx::query_scalar("SELECT COUNT(*)::bigint FROM rooms WHERE is_active = true")
                .fetch_one(&state.db)
                .await
                .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
            Ok(Json(RoomStatsResponse {
                total,
                active: total,
                inactive: 0,
                pending_count_total: 0,
                archived_count: 0,
            }))
        }
        _ => Err(StatusCode::FORBIDDEN),
    }
}

pub async fn list_teachers(
    State(state): State<AppState>,
    auth: AuthenticatedUser,
) -> Result<Json<Vec<TeacherOption>>, StatusCode> {
    require_admin(&auth)?;

    let teachers = sqlx::query_as::<_, TeacherOption>(
        "SELECT id, name FROM users WHERE role = 'teacher'::user_role ORDER BY name ASC",
    )
    .fetch_all(&state.db)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(teachers))
}

fn push_room_list_filters(
    qb: &mut QueryBuilder<'_, sqlx::Postgres>,
    auth: &AuthenticatedUser,
    params: &ListRoomsQuery,
) -> Result<(), StatusCode> {
    match auth.role.as_str() {
        "admin" => {}
        "teacher" => {
            qb.push(" AND r.teacher_id = ");
            qb.push_bind(auth.id);
        }
        "student" => {
            qb.push(
                " AND (r.is_public = true OR EXISTS (SELECT 1 FROM enrollments e WHERE e.room_id = r.id AND e.student_id = ",
            );
            qb.push_bind(auth.id);
            qb.push(" AND e.status IN ('approved', 'pending')))");
            qb.push(" AND r.is_active = true");
        }
        _ => return Err(StatusCode::FORBIDDEN),
    }

    if let Some(s) = &params.search {
        let t = s.trim();
        if !t.is_empty() {
            let pattern = format!("%{}%", t);
            qb.push(" AND r.name ILIKE ");
            qb.push_bind(pattern);
        }
    }

    if let Some(active) = params.active {
        qb.push(" AND r.is_active = ");
        qb.push_bind(active);
    }

    if let Some(ref ht) = params.halaqah_type {
        let v = parse_halaqah_type(ht.trim())?.to_string();
        qb.push(" AND r.halaqah_type::text = ");
        qb.push_bind(v);
    }

    if let Some(ref rw) = params.riwaya {
        let v = parse_riwaya(rw.trim()).ok_or(StatusCode::BAD_REQUEST)?.to_string();
        qb.push(" AND r.riwaya::text = ");
        qb.push_bind(v);
    }

    if auth.role.as_str() == "student" {
        if let Some(ref ms) = params.my_status {
            match ms.trim() {
                "approved" => {
                    qb.push(" AND e_my.status = ");
                    qb.push_bind("approved");
                }
                "pending" => {
                    qb.push(" AND e_my.status = ");
                    qb.push_bind("pending");
                }
                "rejected" => {
                    qb.push(" AND e_my.status = ");
                    qb.push_bind("rejected");
                }
                "none" => {
                    qb.push(" AND e_my.status IS NULL");
                }
                _ => return Err(StatusCode::BAD_REQUEST),
            }
        }
    }

    if let Some(public) = params.is_public {
        qb.push(" AND r.is_public = ");
        qb.push_bind(public);
    }

    Ok(())
}

pub async fn list_rooms(
    State(state): State<AppState>,
    auth: AuthenticatedUser,
    Query(params): Query<ListRoomsQuery>,
) -> Result<Json<Paginated<RoomPublic>>, StatusCode> {
    let limit = params.limit.unwrap_or(50).clamp(1, 100);
    let offset = params.offset.unwrap_or(0).max(0);

    let mut qb_count = match auth.role.as_str() {
        "student" => {
            let mut b = QueryBuilder::new(
                "SELECT COUNT(r.id)::bigint \
                 FROM rooms r \
                 INNER JOIN users u ON u.id = r.teacher_id \
                 LEFT JOIN enrollments e_my ON e_my.room_id = r.id AND e_my.student_id = ",
            );
            b.push_bind(auth.id);
            b.push(" WHERE 1=1");
            b
        }
        _ => QueryBuilder::new(
            "SELECT COUNT(r.id)::bigint FROM rooms r INNER JOIN users u ON u.id = r.teacher_id WHERE 1=1",
        ),
    };
    push_room_list_filters(&mut qb_count, &auth, &params)?;
    let total: i64 = qb_count
        .build_query_scalar()
        .fetch_one(&state.db)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let mut qb = match auth.role.as_str() {
        "student" => {
            let mut b = QueryBuilder::new(
                "SELECT r.id, r.name, r.teacher_id, u.name AS teacher_name, r.max_students, r.is_active, r.created_at, \
                 r.riwaya::text AS riwaya, r.halaqah_type::text AS halaqah_type, \
                 COALESCE((SELECT COUNT(*)::bigint FROM enrollments e WHERE e.room_id = r.id AND e.status = 'approved'), 0) AS enrolled_count, \
                 COALESCE((SELECT COUNT(*)::bigint FROM sessions s WHERE s.room_id = r.id), 0) AS sessions_count, \
                 r.is_public, r.enrollment_open, r.requires_approval, \
                 COALESCE((SELECT COUNT(*)::bigint FROM enrollments e WHERE e.room_id = r.id AND e.status = 'pending'), 0) AS pending_count, \
                 e_my.status AS my_status, \
                 r.description, r.enrollment_deadline_at, r.setup_completed_at, \
             COALESCE((SELECT COUNT(*)::bigint FROM sessions s WHERE s.room_id = r.id AND s.status = 'completed'), 0) AS completed_sessions_count, \
                 r.timezone \
                 FROM rooms r \
                 INNER JOIN users u ON u.id = r.teacher_id \
                 LEFT JOIN enrollments e_my ON e_my.room_id = r.id AND e_my.student_id = ",
            );
            b.push_bind(auth.id);
            b.push(" WHERE 1=1");
            b
        }
        _ => QueryBuilder::new(
            "SELECT r.id, r.name, r.teacher_id, u.name AS teacher_name, r.max_students, r.is_active, r.created_at, \
             r.riwaya::text AS riwaya, r.halaqah_type::text AS halaqah_type, \
             COALESCE((SELECT COUNT(*)::bigint FROM enrollments e WHERE e.room_id = r.id AND e.status = 'approved'), 0) AS enrolled_count, \
             COALESCE((SELECT COUNT(*)::bigint FROM sessions s WHERE s.room_id = r.id), 0) AS sessions_count, \
             r.is_public, r.enrollment_open, r.requires_approval, \
             COALESCE((SELECT COUNT(*)::bigint FROM enrollments e WHERE e.room_id = r.id AND e.status = 'pending'), 0) AS pending_count, \
             CAST(NULL AS TEXT) AS my_status, \
             r.description, r.enrollment_deadline_at, r.setup_completed_at, \
             COALESCE((SELECT COUNT(*)::bigint FROM sessions s WHERE s.room_id = r.id AND s.status = 'completed'), 0) AS completed_sessions_count, \
             r.timezone \
             FROM rooms r \
             INNER JOIN users u ON u.id = r.teacher_id \
             WHERE 1=1",
        ),
    };

    push_room_list_filters(&mut qb, &auth, &params)?;
    qb.push(" ORDER BY r.created_at DESC");
    qb.push(" LIMIT ");
    qb.push_bind(limit);
    qb.push(" OFFSET ");
    qb.push_bind(offset);

    let rooms = qb
        .build_query_as::<RoomPublic>()
        .fetch_all(&state.db)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(Paginated {
        items: rooms,
        total,
        limit,
        offset,
    }))
}

pub async fn get_room(
    State(state): State<AppState>,
    auth: AuthenticatedUser,
    Path(id): Path<Uuid>,
) -> Result<Json<RoomPublic>, StatusCode> {
    let room = if auth.role == "student" {
        sqlx::query_as::<_, RoomPublic>(
            "SELECT r.id, r.name, r.teacher_id, u.name AS teacher_name, r.max_students, r.is_active, r.created_at, \
             r.riwaya::text AS riwaya, r.halaqah_type::text AS halaqah_type, \
             COALESCE((SELECT COUNT(*)::bigint FROM enrollments e WHERE e.room_id = r.id AND e.status = 'approved'), 0) AS enrolled_count, \
             COALESCE((SELECT COUNT(*)::bigint FROM sessions s WHERE s.room_id = r.id), 0) AS sessions_count, \
             r.is_public, r.enrollment_open, r.requires_approval, \
             COALESCE((SELECT COUNT(*)::bigint FROM enrollments e WHERE e.room_id = r.id AND e.status = 'pending'), 0) AS pending_count, \
             (SELECT e.status FROM enrollments e WHERE e.room_id = r.id AND e.student_id = $2 LIMIT 1) AS my_status, \
             r.description, r.enrollment_deadline_at, r.setup_completed_at, \
             COALESCE((SELECT COUNT(*)::bigint FROM sessions s WHERE s.room_id = r.id AND s.status = 'completed'), 0) AS completed_sessions_count, \
             r.timezone \
             FROM rooms r \
             INNER JOIN users u ON u.id = r.teacher_id \
             WHERE r.id = $1",
        )
        .bind(id)
        .bind(auth.id)
        .fetch_optional(&state.db)
        .await
    } else {
        sqlx::query_as::<_, RoomPublic>(
            "SELECT r.id, r.name, r.teacher_id, u.name AS teacher_name, r.max_students, r.is_active, r.created_at, \
             r.riwaya::text AS riwaya, r.halaqah_type::text AS halaqah_type, \
             COALESCE((SELECT COUNT(*)::bigint FROM enrollments e WHERE e.room_id = r.id AND e.status = 'approved'), 0) AS enrolled_count, \
             COALESCE((SELECT COUNT(*)::bigint FROM sessions s WHERE s.room_id = r.id), 0) AS sessions_count, \
             r.is_public, r.enrollment_open, r.requires_approval, \
             COALESCE((SELECT COUNT(*)::bigint FROM enrollments e WHERE e.room_id = r.id AND e.status = 'pending'), 0) AS pending_count, \
             CAST(NULL AS TEXT) AS my_status, \
             r.description, r.enrollment_deadline_at, r.setup_completed_at, \
             COALESCE((SELECT COUNT(*)::bigint FROM sessions s WHERE s.room_id = r.id AND s.status = 'completed'), 0) AS completed_sessions_count, \
             r.timezone \
             FROM rooms r \
             INNER JOIN users u ON u.id = r.teacher_id \
             WHERE r.id = $1",
        )
        .bind(id)
        .fetch_optional(&state.db)
        .await
    }
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
    .ok_or(StatusCode::NOT_FOUND)?;

    if auth.role == "student" {
        if !room.is_active {
            return Err(StatusCode::FORBIDDEN);
        }
        if !room.is_public {
            let has: bool = sqlx::query_scalar(
                "SELECT EXISTS(SELECT 1 FROM enrollments WHERE room_id = $1 AND student_id = $2)",
            )
            .bind(id)
            .bind(auth.id)
            .fetch_one(&state.db)
            .await
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
            if !has {
                return Err(StatusCode::FORBIDDEN);
            }
        }
    }

    Ok(Json(enrich_room_detail(&state.db, room).await?))
}

pub async fn create_room(
    State(state): State<AppState>,
    auth: AuthenticatedUser,
    Json(req): Json<CreateRoomRequest>,
) -> Result<Json<RoomPublic>, StatusCode> {
    require_teacher_or_admin(&auth)?;

    let name = req.name.trim();
    if name.is_empty() {
        return Err(StatusCode::BAD_REQUEST);
    }

    let max_students = req.max_students.unwrap_or(20);
    if max_students < 1 {
        return Err(StatusCode::BAD_REQUEST);
    }

    let teacher_id = if auth.role == "teacher" {
        auth.id
    } else {
        let tid = req.teacher_id.ok_or(StatusCode::BAD_REQUEST)?;
        if !is_valid_teacher(&state, tid).await? {
            return Err(StatusCode::BAD_REQUEST);
        }
        tid
    };

    let id = Uuid::new_v4();

    let riwaya = req
        .riwaya
        .as_deref()
        .and_then(parse_riwaya)
        .unwrap_or("hafs");

    let halaqah_type = req.halaqah_type.as_deref().unwrap_or("hifz");
    parse_halaqah_type(halaqah_type)?;

    let is_public = req.is_public.unwrap_or(false);
    let enrollment_open = req.enrollment_open.unwrap_or(true);
    let requires_approval = req.requires_approval.unwrap_or(true);

    validate_description(req.description.as_deref())?;
    validate_deadline(req.enrollment_deadline_at, Utc::now())?;

    let timezone = req
        .timezone
        .as_deref()
        .and_then(validate_iana_timezone)
        .map(|s| s.to_string())
        .unwrap_or_else(|| default_timezone().to_string());

    // Quota enforcement (open-core seam). No-op in community: `quota()` is None,
    // so neither branch runs — not even the COUNT query. The cloud build injects a
    // provider that returns Some(limit) and these checks bite. Enforcement logic is
    // identical across editions; only the limit value comes from the provider.
    let ent = state
        .entitlements
        .resolve(&EntitlementContext {
            user_id: teacher_id,
            role: "teacher".to_string(),
        })
        .await;

    // max_halaqat: number of active rooms this teacher owns.
    // NOTE: counted per-teacher — the only dimension core knows. Org-level caps,
    // if ever needed, are enforced in cloud's own routes, never by changing this.
    if let Some(limit) = ent.quota("max_halaqat") {
        let current: i64 = sqlx::query_scalar(
            "SELECT COUNT(*)::bigint FROM rooms WHERE teacher_id = $1 AND is_active = true",
        )
        .bind(teacher_id)
        .fetch_one(&state.db)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
        if current >= limit {
            return Err(StatusCode::FORBIDDEN);
        }
    }

    // max_students_per_halaqah: ceiling on the room's configured capacity.
    if let Some(limit) = ent.quota("max_students_per_halaqah") {
        if (max_students as i64) > limit {
            return Err(StatusCode::FORBIDDEN);
        }
    }

    sqlx::query(
        "INSERT INTO rooms (id, name, teacher_id, max_students, is_active, riwaya, halaqah_type, is_public, enrollment_open, requires_approval, description, enrollment_deadline_at, timezone) \
         VALUES ($1, $2, $3, $4, true, $5, $6::halaqah_type, $7, $8, $9, $10, $11, $12)",
    )
    .bind(id)
    .bind(name)
    .bind(teacher_id)
    .bind(max_students)
    .bind(riwaya)
    .bind(halaqah_type)
    .bind(is_public)
    .bind(enrollment_open)
    .bind(requires_approval)
    .bind(req.description)
    .bind(req.enrollment_deadline_at)
    .bind(&timezone)
    .execute(&state.db)
    .await
    .map_err(|e| {
        tracing::error!(error = ?e, "create_room insert failed");
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    let room = sqlx::query_as::<_, RoomPublic>(
        "SELECT r.id, r.name, r.teacher_id, u.name AS teacher_name, r.max_students, r.is_active, r.created_at, \
         r.riwaya::text AS riwaya, r.halaqah_type::text AS halaqah_type, \
         COALESCE((SELECT COUNT(*)::bigint FROM enrollments e WHERE e.room_id = r.id AND e.status = 'approved'), 0) AS enrolled_count, \
         COALESCE((SELECT COUNT(*)::bigint FROM sessions s WHERE s.room_id = r.id), 0) AS sessions_count, \
         r.is_public, r.enrollment_open, r.requires_approval, \
         COALESCE((SELECT COUNT(*)::bigint FROM enrollments e WHERE e.room_id = r.id AND e.status = 'pending'), 0) AS pending_count, \
         CAST(NULL AS TEXT) AS my_status, \
         r.description, r.enrollment_deadline_at, r.setup_completed_at, \
             COALESCE((SELECT COUNT(*)::bigint FROM sessions s WHERE s.room_id = r.id AND s.status = 'completed'), 0) AS completed_sessions_count, \
         r.timezone \
         FROM rooms r \
         INNER JOIN users u ON u.id = r.teacher_id \
         WHERE r.id = $1",
    )
    .bind(id)
    .fetch_one(&state.db)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    crate::services::product_events::track(
        &state.db,
        "halaqah_created",
        Some(auth.id),
        Some(auth.role.as_str()),
        serde_json::json!({
            "room_id": id,
            "halaqah_type": halaqah_type,
        }),
    )
    .await;

    Ok(Json(room))
}

pub async fn update_room(
    State(state): State<AppState>,
    auth: AuthenticatedUser,
    Path(id): Path<Uuid>,
    Json(req): Json<UpdateRoomRequest>,
) -> Result<Json<RoomPublic>, StatusCode> {
    let existing = sqlx::query_as::<_, RoomPublic>(
        "SELECT r.id, r.name, r.teacher_id, u.name AS teacher_name, r.max_students, r.is_active, r.created_at, \
         r.riwaya::text AS riwaya, r.halaqah_type::text AS halaqah_type, \
         COALESCE((SELECT COUNT(*)::bigint FROM enrollments e WHERE e.room_id = r.id AND e.status = 'approved'), 0) AS enrolled_count, \
         COALESCE((SELECT COUNT(*)::bigint FROM sessions s WHERE s.room_id = r.id), 0) AS sessions_count, \
         r.is_public, r.enrollment_open, r.requires_approval, \
         COALESCE((SELECT COUNT(*)::bigint FROM enrollments e WHERE e.room_id = r.id AND e.status = 'pending'), 0) AS pending_count, \
         CAST(NULL AS TEXT) AS my_status, \
         r.description, r.enrollment_deadline_at, r.setup_completed_at, \
             COALESCE((SELECT COUNT(*)::bigint FROM sessions s WHERE s.room_id = r.id AND s.status = 'completed'), 0) AS completed_sessions_count, \
         r.timezone \
         FROM rooms r \
         INNER JOIN users u ON u.id = r.teacher_id \
         WHERE r.id = $1",
    )
    .bind(id)
    .fetch_optional(&state.db)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
    .ok_or(StatusCode::NOT_FOUND)?;

    if !can_manage_room(&auth, existing.teacher_id) {
        return Err(StatusCode::FORBIDDEN);
    }

    if req.name.is_none()
        && req.max_students.is_none()
        && req.is_active.is_none()
        && req.riwaya.is_none()
        && req.halaqah_type.is_none()
        && req.is_public.is_none()
        && req.enrollment_open.is_none()
        && req.requires_approval.is_none()
        && req.description.is_none()
        && req.enrollment_deadline_at.is_none()
        && req.timezone.is_none()
    {
        return Err(StatusCode::BAD_REQUEST);
    }

    if let Some(ref desc_opt) = req.description {
        validate_description(desc_opt.as_deref())?;
    }
    if let Some(deadline_opt) = &req.enrollment_deadline_at {
        validate_deadline(*deadline_opt, Utc::now())?;
    }

    let timezone = if let Some(ref tz) = req.timezone {
        validate_iana_timezone(tz.trim())
            .ok_or(StatusCode::BAD_REQUEST)?
            .to_string()
    } else {
        existing.timezone.clone()
    };

    if let Some(new_max) = req.max_students {
        let ent = state
            .entitlements
            .resolve(&EntitlementContext {
                user_id: existing.teacher_id,
                role: "teacher".to_string(),
            })
            .await;
        if let Some(limit) = ent.quota("max_students_per_halaqah") {
            if (new_max as i64) > limit {
                return Err(StatusCode::FORBIDDEN);
            }
        }
    }

    let name = req.name.map(|n| n.trim().to_string()).unwrap_or(existing.name.clone());
    let max_students = req.max_students.unwrap_or(existing.max_students);
    let is_active = req.is_active.unwrap_or(existing.is_active);
    let riwaya = req
        .riwaya
        .as_deref()
        .map(|s| parse_riwaya(s).ok_or(StatusCode::BAD_REQUEST))
        .transpose()?
        .map(|s| s.to_string())
        .unwrap_or(existing.riwaya.clone());
    let halaqah_type: String = if let Some(ref s) = req.halaqah_type {
        parse_halaqah_type(s.trim())?.to_string()
    } else {
        existing.halaqah_type.clone()
    };
    let is_public = req.is_public.unwrap_or(existing.is_public);
    let enrollment_open = req.enrollment_open.unwrap_or(existing.enrollment_open);
    let requires_approval = req.requires_approval.unwrap_or(existing.requires_approval);

    if name.is_empty() || max_students < 1 {
        return Err(StatusCode::BAD_REQUEST);
    }

    // Same cleanup as archive when deactivating via PUT.
    if existing.is_active && !is_active {
        end_open_activity_for_room(&state, id).await?;
    }
    // Orphan live sessions from archives before this fix would resume on restore — clear them.
    if !existing.is_active && is_active {
        let live_ids: Vec<Uuid> = sqlx::query_scalar(
            "SELECT id FROM sessions WHERE room_id = $1 AND status::text = 'in_progress'",
        )
        .bind(id)
        .fetch_all(&state.db)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
        if !live_ids.is_empty() {
            sqlx::query(
                "UPDATE sessions SET status = 'cancelled'::session_status \
                 WHERE room_id = $1 AND status::text = 'in_progress'",
            )
            .bind(id)
            .execute(&state.db)
            .await
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
            for sid in live_ids {
                crate::api::ws::signaling::on_session_ended(&state, sid).await;
            }
        }
    }

    let desc_present = req.description.is_some();
    let desc_sql: Option<String> = req.description.clone().and_then(|x| x);
    let deadline_present = req.enrollment_deadline_at.is_some();
    let deadline_sql: Option<DateTime<Utc>> = req.enrollment_deadline_at.clone().and_then(|x| x);

    sqlx::query(
        "UPDATE rooms SET name = $1, max_students = $2, is_active = $3, riwaya = $4, \
         halaqah_type = $5::halaqah_type, is_public = $6, enrollment_open = $7, requires_approval = $8, \
         description = CASE WHEN $9 THEN $10 ELSE description END, \
         enrollment_deadline_at = CASE WHEN $11 THEN $12 ELSE enrollment_deadline_at END, \
         timezone = $13 \
         WHERE id = $14",
    )
    .bind(&name)
    .bind(max_students)
    .bind(is_active)
    .bind(&riwaya)
    .bind(&halaqah_type)
    .bind(is_public)
    .bind(enrollment_open)
    .bind(requires_approval)
    .bind(desc_present)
    .bind(desc_sql)
    .bind(deadline_present)
    .bind(deadline_sql)
    .bind(&timezone)
    .bind(id)
    .execute(&state.db)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let room = sqlx::query_as::<_, RoomPublic>(
        "SELECT r.id, r.name, r.teacher_id, u.name AS teacher_name, r.max_students, r.is_active, r.created_at, \
         r.riwaya::text AS riwaya, r.halaqah_type::text AS halaqah_type, \
         COALESCE((SELECT COUNT(*)::bigint FROM enrollments e WHERE e.room_id = r.id AND e.status = 'approved'), 0) AS enrolled_count, \
         COALESCE((SELECT COUNT(*)::bigint FROM sessions s WHERE s.room_id = r.id), 0) AS sessions_count, \
         r.is_public, r.enrollment_open, r.requires_approval, \
         COALESCE((SELECT COUNT(*)::bigint FROM enrollments e WHERE e.room_id = r.id AND e.status = 'pending'), 0) AS pending_count, \
         CAST(NULL AS TEXT) AS my_status, \
         r.description, r.enrollment_deadline_at, r.setup_completed_at, \
             COALESCE((SELECT COUNT(*)::bigint FROM sessions s WHERE s.room_id = r.id AND s.status = 'completed'), 0) AS completed_sessions_count, \
         r.timezone \
         FROM rooms r \
         INNER JOIN users u ON u.id = r.teacher_id \
         WHERE r.id = $1",
    )
    .bind(id)
    .fetch_one(&state.db)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(room))
}

/// Cancel live + future scheduled sessions and pause recurring schedules for a room.
/// Completes WS/attendance cleanup for any session that was `in_progress`.
async fn end_open_activity_for_room(state: &AppState, room_id: Uuid) -> Result<(), StatusCode> {
    let live_ids: Vec<Uuid> = sqlx::query_scalar(
        "SELECT id FROM sessions WHERE room_id = $1 AND status::text = 'in_progress'",
    )
    .bind(room_id)
    .fetch_all(&state.db)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    sqlx::query(
        "UPDATE sessions SET status = 'cancelled'::session_status \
         WHERE room_id = $1 AND status::text IN ('in_progress', 'scheduled')",
    )
    .bind(room_id)
    .execute(&state.db)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    sqlx::query("UPDATE schedules SET is_active = false WHERE room_id = $1 AND is_active = true")
        .bind(room_id)
        .execute(&state.db)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    for sid in live_ids {
        crate::api::ws::signaling::on_session_ended(state, sid).await;
    }
    Ok(())
}

/// Deactivates the room (archive). Historical enrollments, completed sessions, and recitations are preserved.
/// Live and future scheduled sessions are cancelled so teacher/student live UI clears immediately.
pub async fn delete_room(
    State(state): State<AppState>,
    auth: AuthenticatedUser,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, StatusCode> {
    let row: Option<(Uuid, bool)> = sqlx::query_as("SELECT teacher_id, is_active FROM rooms WHERE id = $1")
        .bind(id)
        .fetch_optional(&state.db)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let Some((teacher_id, was_active)) = row else {
        return Err(StatusCode::NOT_FOUND);
    };

    if !can_manage_room(&auth, teacher_id) {
        return Err(StatusCode::FORBIDDEN);
    }

    if !was_active {
        return Ok(StatusCode::NO_CONTENT);
    }

    end_open_activity_for_room(&state, id).await?;

    let result = sqlx::query("UPDATE rooms SET is_active = false WHERE id = $1 AND is_active = true")
        .bind(id)
        .execute(&state.db)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    if result.rows_affected() == 0 {
        return Err(StatusCode::NOT_FOUND);
    }

    Ok(StatusCode::NO_CONTENT)
}

/// Permanently removes an **archived** room and its related data (sessions, enrollments, schedules,
/// recitations for that room, share links). Active rooms must be archived first.
pub async fn purge_room(
    State(state): State<AppState>,
    auth: AuthenticatedUser,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, StatusCode> {
    let row: Option<(Uuid, bool)> = sqlx::query_as("SELECT teacher_id, is_active FROM rooms WHERE id = $1")
        .bind(id)
        .fetch_optional(&state.db)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let Some((teacher_id, is_active)) = row else {
        return Err(StatusCode::NOT_FOUND);
    };

    if !can_manage_room(&auth, teacher_id) {
        return Err(StatusCode::FORBIDDEN);
    }

    if is_active {
        return Err(StatusCode::CONFLICT);
    }

    // Clear any leftover live state before cascades remove sessions.
    end_open_activity_for_room(&state, id).await?;

    let mut tx = state
        .db
        .begin()
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    // Recitations SET NULL on room/session delete — remove them explicitly for a true purge.
    sqlx::query(
        "DELETE FROM recitations \
         WHERE room_id = $1 \
            OR session_id IN (SELECT id FROM sessions WHERE room_id = $1)",
    )
    .bind(id)
    .execute(&mut *tx)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    // share_links has no FK to rooms/sessions.
    sqlx::query(
        "DELETE FROM share_links \
         WHERE (target_type IN ('halaqah', 'invite') AND target_id = $1) \
            OR (target_type = 'session' AND target_id IN (SELECT id FROM sessions WHERE room_id = $1))",
    )
    .bind(id)
    .execute(&mut *tx)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let result = sqlx::query("DELETE FROM rooms WHERE id = $1 AND is_active = false")
        .bind(id)
        .execute(&mut *tx)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    if result.rows_affected() == 0 {
        return Err(StatusCode::NOT_FOUND);
    }

    tx.commit()
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(StatusCode::NO_CONTENT)
}

#[derive(serde::Serialize)]
pub struct SetupCompleteResponse {
    pub setup_completed_at: DateTime<Utc>,
}

#[derive(serde::Serialize)]
pub struct SetupErrorBody {
    pub code: &'static str,
    pub message: &'static str,
}

/// Mark room setup complete once at least one session exists. Idempotent.
pub async fn complete_room_setup(
    State(state): State<AppState>,
    auth: AuthenticatedUser,
    Path(id): Path<Uuid>,
) -> Result<Json<SetupCompleteResponse>, (StatusCode, Json<SetupErrorBody>)> {
    let row: Option<(Uuid, Option<DateTime<Utc>>)> =
        sqlx::query_as("SELECT teacher_id, setup_completed_at FROM rooms WHERE id = $1")
            .bind(id)
            .fetch_optional(&state.db)
            .await
            .map_err(|_| {
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(SetupErrorBody {
                        code: "server_error",
                        message: "server error",
                    }),
                )
            })?;

    let Some((teacher_id, existing)) = row else {
        return Err((
            StatusCode::NOT_FOUND,
            Json(SetupErrorBody {
                code: "not_found",
                message: "room not found",
            }),
        ));
    };

    if !can_manage_room(&auth, teacher_id) {
        return Err((
            StatusCode::FORBIDDEN,
            Json(SetupErrorBody {
                code: "forbidden",
                message: "forbidden",
            }),
        ));
    }

    if let Some(at) = existing {
        return Ok(Json(SetupCompleteResponse {
            setup_completed_at: at,
        }));
    }

    let session_count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*)::bigint FROM sessions WHERE room_id = $1",
    )
    .bind(id)
    .fetch_one(&state.db)
    .await
    .map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(SetupErrorBody {
                code: "server_error",
                message: "server error",
            }),
        )
    })?;

    if session_count < 1 {
        return Err((
            StatusCode::CONFLICT,
            Json(SetupErrorBody {
                code: "no_session",
                message: "schedule a session before completing setup",
            }),
        ));
    }

    let at: DateTime<Utc> = sqlx::query_scalar(
        "UPDATE rooms SET setup_completed_at = NOW() \
         WHERE id = $1 AND setup_completed_at IS NULL \
         RETURNING setup_completed_at",
    )
    .bind(id)
    .fetch_one(&state.db)
    .await
    .map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(SetupErrorBody {
                code: "server_error",
                message: "server error",
            }),
        )
    })?;

    Ok(Json(SetupCompleteResponse {
        setup_completed_at: at,
    }))
}

#[derive(Debug, Serialize)]
pub struct StudentMemoryLastStop {
    pub surah: i32,
    pub ayah_end: i32,
    pub at: DateTime<Utc>,
}

#[derive(Debug, Serialize)]
pub struct StudentMemoryNextTarget {
    pub surah: i32,
    pub ayah_start: i32,
    pub ayah_end: i32,
    pub recitation_id: Uuid,
}

#[derive(Debug, Serialize)]
pub struct StudentMemoryRow {
    pub student_id: Uuid,
    pub student_name: String,
    pub last_stop: Option<StudentMemoryLastStop>,
    pub recurring_error: Option<String>,
    pub next_target: Option<StudentMemoryNextTarget>,
}

#[derive(FromRow)]
struct StudentMemoryDbRow {
    student_id: Uuid,
    student_name: String,
    last_stop_surah: Option<i32>,
    last_stop_ayah_end: Option<i32>,
    last_stop_at: Option<DateTime<Utc>>,
    recurring_error: Option<String>,
    next_surah: Option<i32>,
    next_ayah_start: Option<i32>,
    next_ayah_end: Option<i32>,
    next_recitation_id: Option<Uuid>,
}

/// GET `/api/rooms/{id}/student-memory` — per-enrollee last stop, recurring error, next target.
pub async fn student_memory(
    State(state): State<AppState>,
    auth: AuthenticatedUser,
    Path(id): Path<Uuid>,
) -> Result<Json<Vec<StudentMemoryRow>>, StatusCode> {
    let teacher_id: Option<Uuid> =
        sqlx::query_scalar("SELECT teacher_id FROM rooms WHERE id = $1")
            .bind(id)
            .fetch_optional(&state.db)
            .await
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    let teacher_id = teacher_id.ok_or(StatusCode::NOT_FOUND)?;
    if !can_manage_room(&auth, teacher_id) {
        return Err(StatusCode::FORBIDDEN);
    }

    let rows: Vec<StudentMemoryDbRow> = sqlx::query_as(
        "SELECT e.student_id, u.name AS student_name, \
                ls.surah AS last_stop_surah, ls.ayah_end AS last_stop_ayah_end, \
                ls.created_at AS last_stop_at, \
                re.error_category AS recurring_error, \
                nt.surah AS next_surah, nt.ayah_start AS next_ayah_start, \
                nt.ayah_end AS next_ayah_end, nt.id AS next_recitation_id \
         FROM enrollments e \
         INNER JOIN users u ON u.id = e.student_id \
         LEFT JOIN LATERAL ( \
             SELECT r.surah, r.ayah_end, r.created_at \
             FROM recitations r \
             WHERE r.room_id = e.room_id \
               AND r.student_id = e.student_id \
               AND (r.grade IS NOT NULL OR r.plan_status = 'completed') \
             ORDER BY r.created_at DESC \
             LIMIT 1 \
         ) ls ON TRUE \
         LEFT JOIN LATERAL ( \
             SELECT ea.error_category::text AS error_category \
             FROM error_annotations ea \
             INNER JOIN recitations r ON r.id = ea.recitation_id \
             WHERE r.room_id = e.room_id \
               AND r.student_id = e.student_id \
               AND ea.annotation_kind = 'error' \
               AND ea.status = 'open' \
             GROUP BY ea.error_category \
             ORDER BY COUNT(*) DESC \
             LIMIT 1 \
         ) re ON TRUE \
         LEFT JOIN LATERAL ( \
             SELECT r.id, r.surah, r.ayah_start, r.ayah_end \
             FROM recitations r \
             WHERE r.room_id = e.room_id \
               AND r.student_id = e.student_id \
               AND r.plan_status = 'planned' \
             ORDER BY r.order_index ASC, r.created_at ASC \
             LIMIT 1 \
         ) nt ON TRUE \
         WHERE e.room_id = $1 AND e.status = 'approved' \
         ORDER BY u.name ASC",
    )
    .bind(id)
    .fetch_all(&state.db)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let out = rows
        .into_iter()
        .map(|r| {
            let last_stop = match (r.last_stop_surah, r.last_stop_ayah_end, r.last_stop_at) {
                (Some(surah), Some(ayah_end), Some(at)) => Some(StudentMemoryLastStop {
                    surah,
                    ayah_end,
                    at,
                }),
                _ => None,
            };
            let next_target = match (
                r.next_surah,
                r.next_ayah_start,
                r.next_ayah_end,
                r.next_recitation_id,
            ) {
                (Some(surah), Some(ayah_start), Some(ayah_end), Some(recitation_id)) => {
                    Some(StudentMemoryNextTarget {
                        surah,
                        ayah_start,
                        ayah_end,
                        recitation_id,
                    })
                }
                _ => None,
            };
            StudentMemoryRow {
                student_id: r.student_id,
                student_name: r.student_name,
                last_stop,
                recurring_error: r.recurring_error,
                next_target,
            }
        })
        .collect();

    Ok(Json(out))
}
