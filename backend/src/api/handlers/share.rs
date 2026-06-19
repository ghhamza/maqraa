// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    Json,
};
use chrono::{DateTime, Utc};
use rand::Rng;
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

use crate::api::extractors::AuthenticatedUser;
use crate::api::AppState;
use crate::models::share_link::ShareLink;
use crate::notifications::{enqueue, TemplateVars};
use crate::services::ics::{build_session_ics, ics_calendar_response, SessionIcsInput};

use super::enrollments::{enroll_student, notify_pending_enrollment_request, EnrollOutcome, EnrollStudentError};

#[path = "share_html.rs"]
mod share_html;

pub use share_html::share_landing;

const TOKEN_ALPHABET: &[u8] =
    b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-";
const TOKEN_LEN: usize = 24;

const INSTANCE_APP_NAME: &str = "المقرأة";
const INSTANCE_TAGLINE: &str = "منصة تعليم القرآن الكريم";

#[derive(Serialize)]
pub struct ApiMessage {
    pub message: &'static str,
    pub code: &'static str,
}

#[derive(Deserialize)]
pub struct CreateShareLinkRequest {
    pub target_type: String,
    pub target_id: Option<Uuid>,
    pub expires_at: Option<DateTime<Utc>>,
    pub max_uses: Option<i32>,
    pub auto_approve: Option<bool>,
    pub email_bound: Option<String>,
}

#[derive(Serialize)]
pub struct ShareLinkResponse {
    pub id: Uuid,
    pub token: String,
    pub share_url: String,
    pub target_type: String,
    pub target_id: Option<Uuid>,
    pub expires_at: Option<DateTime<Utc>>,
    pub max_uses: Option<i32>,
    pub use_count: i32,
    pub created_at: DateTime<Utc>,
}

#[derive(Serialize)]
pub struct ShareLinkListItem {
    pub id: Uuid,
    pub token: String,
    pub share_url: String,
    pub target_type: String,
    pub target_id: Option<Uuid>,
    pub use_count: i32,
    pub join_count: i32,
    pub revoked_at: Option<DateTime<Utc>>,
    pub expires_at: Option<DateTime<Utc>>,
    pub max_uses: Option<i32>,
    pub email_bound: Option<String>,
    pub auto_approve: bool,
    pub created_at: DateTime<Utc>,
}

#[derive(Deserialize)]
pub struct ListShareLinksQuery {
    pub target_type: Option<String>,
    pub target_id: Option<Uuid>,
}

#[derive(Debug, Clone, Serialize)]
pub struct HalaqahTeaser {
    pub name: String,
    pub teacher_name: String,
    pub riwaya: String,
    pub halaqah_type: String,
    pub is_public: bool,
    pub enrollment_open: bool,
    pub requires_approval: bool,
    pub max_students: i32,
    pub enrolled_count: i64,
}

#[derive(Debug, Clone, Serialize)]
pub struct InviteTeaser {
    pub name: String,
    pub teacher_name: String,
    pub riwaya: String,
    pub halaqah_type: String,
    pub is_public: bool,
    pub enrollment_open: bool,
    pub requires_approval: bool,
    pub max_students: i32,
    pub enrolled_count: i64,
    pub auto_approve: bool,
}

#[derive(Debug, Clone, Serialize)]
pub struct SessionTeaser {
    pub title: Option<String>,
    pub scheduled_at: DateTime<Utc>,
    pub duration_minutes: i32,
    pub status: String,
    pub room_name: String,
    pub teacher_name: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct InstanceTeaser {
    pub app_name: &'static str,
    pub tagline: &'static str,
}

pub enum TeaserPayload {
    Halaqah {
        teaser: HalaqahTeaser,
        description: Option<String>,
    },
    Invite {
        teaser: InviteTeaser,
        description: Option<String>,
    },
    Session {
        teaser: SessionTeaser,
    },
    Instance {
        teaser: InstanceTeaser,
    },
}

pub enum ShareError {
    InvalidLink,
    Db(sqlx::Error),
}

#[derive(Serialize)]
pub struct AcceptShareResponse {
    pub target_type: String,
    pub target_id: Option<Uuid>,
    pub route: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub enrollment_status: Option<String>,
    pub joined: bool,
}

const LINK_COLS: &str = "id, token, target_type, target_id, created_by, auto_approve, \
     email_bound, expires_at, max_uses, use_count, join_count, revoked_at, created_at";

#[derive(Serialize)]
#[serde(tag = "target_type", rename_all = "snake_case")]
pub enum PublicShareResponse {
    Halaqah(HalaqahTeaser),
    Invite(InviteTeaser),
    Session(SessionTeaser),
    Instance(InstanceTeaser),
}

#[derive(FromRow)]
struct HalaqahTeaserRow {
    name: String,
    teacher_name: String,
    riwaya: String,
    halaqah_type: String,
    is_public: bool,
    enrollment_open: bool,
    requires_approval: bool,
    max_students: i32,
    description: Option<String>,
    enrolled_count: i64,
}

#[derive(FromRow)]
struct SessionTeaserRow {
    title: Option<String>,
    scheduled_at: DateTime<Utc>,
    duration_minutes: i32,
    status: String,
    room_name: String,
    teacher_name: String,
}

fn generate_share_token() -> String {
    let mut rng = rand::thread_rng();
    (0..TOKEN_LEN)
        .map(|_| {
            let idx = rng.gen_range(0..TOKEN_ALPHABET.len());
            TOKEN_ALPHABET[idx] as char
        })
        .collect()
}

fn share_url(config: &crate::config::AppConfig, token: &str) -> String {
    format!(
        "{}/s/{}",
        config.public_base_url.trim_end_matches('/'),
        token
    )
}

fn is_unique_violation(err: &sqlx::Error) -> bool {
    matches!(
        err,
        sqlx::Error::Database(db) if db.code().as_deref() == Some("23505")
    )
}

fn is_valid_target_type(target_type: &str) -> bool {
    matches!(
        target_type,
        "halaqah" | "session" | "invite" | "instance"
    )
}

fn can_manage_room(auth: &AuthenticatedUser, room_teacher_id: Uuid) -> bool {
    auth.role == "admin" || (auth.role == "teacher" && auth.id == room_teacher_id)
}

fn server_error() -> (StatusCode, Json<ApiMessage>) {
    (
        StatusCode::INTERNAL_SERVER_ERROR,
        Json(ApiMessage {
            message: "خطأ في الخادم",
            code: "server_error",
        }),
    )
}

async fn room_teacher_id(
    db: &sqlx::PgPool,
    room_id: Uuid,
) -> Result<Option<Uuid>, sqlx::Error> {
    sqlx::query_scalar("SELECT teacher_id FROM rooms WHERE id = $1")
        .bind(room_id)
        .fetch_optional(db)
        .await
}

async fn session_room_teacher_id(
    db: &sqlx::PgPool,
    session_id: Uuid,
) -> Result<Option<Uuid>, sqlx::Error> {
    sqlx::query_scalar(
        "SELECT r.teacher_id FROM sessions s \
         INNER JOIN rooms r ON r.id = s.room_id \
         WHERE s.id = $1",
    )
    .bind(session_id)
    .fetch_optional(db)
    .await
}

async fn target_exists(
    db: &sqlx::PgPool,
    target_type: &str,
    target_id: Uuid,
) -> Result<bool, sqlx::Error> {
    let exists = match target_type {
        "halaqah" | "invite" => {
            sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM rooms WHERE id = $1)")
                .bind(target_id)
                .fetch_one(db)
                .await?
        }
        "session" => {
            sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM sessions WHERE id = $1)")
                .bind(target_id)
                .fetch_one(db)
                .await?
        }
        _ => false,
    };
    Ok(exists)
}

async fn authorize_create(
    db: &sqlx::PgPool,
    auth: &AuthenticatedUser,
    target_type: &str,
    target_id: Option<Uuid>,
) -> Result<(), (StatusCode, Json<ApiMessage>)> {
    if target_type == "instance" {
        if auth.role != "admin" {
            return Err((
                StatusCode::FORBIDDEN,
                Json(ApiMessage {
                    message: "غير مصرح",
                    code: "not_owner",
                }),
            ));
        }
        if target_id.is_some() {
            return Err((
                StatusCode::BAD_REQUEST,
                Json(ApiMessage {
                    message: "معرف الهدف غير صالح",
                    code: "invalid_target",
                }),
            ));
        }
        return Ok(());
    }

    let Some(target_id) = target_id else {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(ApiMessage {
                message: "معرف الهدف مطلوب",
                code: "invalid_target",
            }),
        ));
    };

    let teacher_id = match target_type {
        "halaqah" | "invite" => room_teacher_id(db, target_id).await.map_err(|_| server_error())?,
        "session" => {
            session_room_teacher_id(db, target_id)
                .await
                .map_err(|_| server_error())?
        }
        _ => None,
    };

    let Some(teacher_id) = teacher_id else {
        return Err((
            StatusCode::NOT_FOUND,
            Json(ApiMessage {
                message: "غير موجود",
                code: "not_found",
            }),
        ));
    };

    if !can_manage_room(auth, teacher_id) {
        return Err((
            StatusCode::FORBIDDEN,
            Json(ApiMessage {
                message: "غير مصرح",
                code: "not_owner",
            }),
        ));
    }

    Ok(())
}

fn share_link_response(link: &ShareLink, config: &crate::config::AppConfig) -> ShareLinkResponse {
    ShareLinkResponse {
        id: link.id,
        token: link.token.clone(),
        share_url: share_url(config, &link.token),
        target_type: link.target_type.clone(),
        target_id: link.target_id,
        expires_at: link.expires_at,
        max_uses: link.max_uses,
        use_count: link.use_count,
        created_at: link.created_at,
    }
}

pub async fn create_link(
    State(state): State<AppState>,
    auth: AuthenticatedUser,
    Json(req): Json<CreateShareLinkRequest>,
) -> Result<(StatusCode, Json<ShareLinkResponse>), (StatusCode, Json<ApiMessage>)> {
    let target_type = req.target_type.trim();
    if !is_valid_target_type(target_type) {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(ApiMessage {
                message: "نوع الهدف غير صالح",
                code: "invalid_target_type",
            }),
        ));
    }

    authorize_create(&state.db, &auth, target_type, req.target_id).await?;

    if target_type != "instance" {
        let target_id = req.target_id.unwrap();
        let exists = target_exists(&state.db, target_type, target_id)
            .await
            .map_err(|_| server_error())?;
        if !exists {
            return Err((
                StatusCode::NOT_FOUND,
                Json(ApiMessage {
                    message: "غير موجود",
                    code: "not_found",
                }),
            ));
        }
    }

    let auto_approve = req.auto_approve.unwrap_or(false);

    for _ in 0..5 {
        let token = generate_share_token();
        let result = sqlx::query_as::<_, ShareLink>(
            "INSERT INTO share_links \
             (token, target_type, target_id, created_by, auto_approve, email_bound, expires_at, max_uses) \
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8) \
             RETURNING id, token, target_type, target_id, created_by, auto_approve, email_bound, \
                       expires_at, max_uses, use_count, join_count, revoked_at, created_at",
        )
        .bind(&token)
        .bind(target_type)
        .bind(req.target_id)
        .bind(auth.id)
        .bind(auto_approve)
        .bind(req.email_bound.as_deref())
        .bind(req.expires_at)
        .bind(req.max_uses)
        .fetch_one(&state.db)
        .await;

        match result {
            Ok(link) => {
                return Ok((
                    StatusCode::CREATED,
                    Json(share_link_response(&link, &state.config)),
                ));
            }
            Err(e) if is_unique_violation(&e) => continue,
            Err(_) => return Err(server_error()),
        }
    }

    Err(server_error())
}

/// Best-effort: increment join_count for a valid instance share link. Never errors outward.
pub async fn try_attribute_instance_registration(db: &sqlx::PgPool, share_token: Option<&str>) {
    let Some(token) = share_token.map(str::trim).filter(|s| !s.is_empty()) else {
        return;
    };

    if let Err(e) = sqlx::query(
        "UPDATE share_links SET join_count = join_count + 1 \
         WHERE token = $1 AND target_type = 'instance' \
         AND revoked_at IS NULL \
         AND (expires_at IS NULL OR expires_at > NOW()) \
         AND (max_uses IS NULL OR use_count < max_uses)",
    )
    .bind(token)
    .execute(db)
    .await
    {
        tracing::debug!(
            error = %e,
            token,
            "instance share registration attribution skipped"
        );
    }
}

pub async fn list_links(
    State(state): State<AppState>,
    auth: AuthenticatedUser,
    Query(params): Query<ListShareLinksQuery>,
) -> Result<Json<Vec<ShareLinkListItem>>, StatusCode> {
    if params.target_type.as_deref() == Some("instance") && auth.role != "admin" {
        return Err(StatusCode::FORBIDDEN);
    }

    let mut qb = sqlx::QueryBuilder::new(
        "SELECT id, token, target_type, target_id, created_by, auto_approve, email_bound, \
         expires_at, max_uses, use_count, join_count, revoked_at, created_at \
         FROM share_links WHERE created_by = ",
    );
    qb.push_bind(auth.id);

    if let Some(target_type) = params.target_type.as_deref() {
        let t = target_type.trim();
        if is_valid_target_type(t) {
            qb.push(" AND target_type = ");
            qb.push_bind(t);
        }
    }
    if let Some(target_id) = params.target_id {
        qb.push(" AND target_id = ");
        qb.push_bind(target_id);
    }

    qb.push(" ORDER BY created_at DESC");

    let rows = qb
        .build_query_as::<ShareLink>()
        .fetch_all(&state.db)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let items = rows
        .into_iter()
        .map(|link| ShareLinkListItem {
            id: link.id,
            token: link.token.clone(),
            share_url: share_url(&state.config, &link.token),
            target_type: link.target_type,
            target_id: link.target_id,
            use_count: link.use_count,
            join_count: link.join_count,
            revoked_at: link.revoked_at,
            expires_at: link.expires_at,
            max_uses: link.max_uses,
            email_bound: link.email_bound,
            auto_approve: link.auto_approve,
            created_at: link.created_at,
        })
        .collect();

    Ok(Json(items))
}

pub async fn revoke_link(
    State(state): State<AppState>,
    auth: AuthenticatedUser,
    Path(link_id): Path<Uuid>,
) -> Result<Json<ApiMessage>, (StatusCode, Json<ApiMessage>)> {
    let row: Option<(Uuid,)> =
        sqlx::query_as("SELECT created_by FROM share_links WHERE id = $1")
            .bind(link_id)
            .fetch_optional(&state.db)
            .await
            .map_err(|_| server_error())?;

    let Some((created_by,)) = row else {
        return Err((
            StatusCode::NOT_FOUND,
            Json(ApiMessage {
                message: "غير موجود",
                code: "not_found",
            }),
        ));
    };

    if auth.role != "admin" && auth.id != created_by {
        return Err((
            StatusCode::FORBIDDEN,
            Json(ApiMessage {
                message: "غير مصرح",
                code: "not_owner",
            }),
        ));
    }

    sqlx::query(
        "UPDATE share_links SET revoked_at = COALESCE(revoked_at, NOW()) WHERE id = $1",
    )
    .bind(link_id)
    .execute(&state.db)
    .await
    .map_err(|_| server_error())?;

    Ok(Json(ApiMessage {
        message: "تم إلغاء الرابط",
        code: "revoked",
    }))
}

#[derive(Deserialize)]
pub struct SendRoomInvitesRequest {
    pub emails: Vec<String>,
    #[serde(default = "default_auto_approve")]
    pub auto_approve: bool,
    pub locale: Option<String>,
}

fn default_auto_approve() -> bool {
    true
}

#[derive(Serialize)]
pub struct InviteResultItem {
    pub id: Uuid,
    pub email: String,
    pub share_url: String,
    pub status: &'static str,
}

fn is_valid_email(email: &str) -> bool {
    let parts: Vec<&str> = email.split('@').collect();
    if parts.len() != 2 {
        return false;
    }
    let local = parts[0];
    let domain = parts[1];
    !local.is_empty()
        && !domain.is_empty()
        && domain.contains('.')
        && !domain.starts_with('.')
        && !domain.ends_with('.')
}

fn normalize_invite_locale(request_locale: Option<&str>, teacher_locale: &str) -> String {
    if let Some(loc) = request_locale.map(str::trim).filter(|s| !s.is_empty()) {
        if matches!(loc, "ar" | "en" | "fr") {
            return loc.to_string();
        }
    }
    let tl = teacher_locale.trim();
    if matches!(tl, "ar" | "en" | "fr") {
        return tl.to_string();
    }
    "ar".to_string()
}

async fn authorize_room_invites(
    db: &sqlx::PgPool,
    auth: &AuthenticatedUser,
    room_id: Uuid,
) -> Result<(String, String, String), (StatusCode, Json<ApiMessage>)> {
    let row: Option<(Uuid, String, String)> = sqlx::query_as(
        "SELECT r.teacher_id, r.name, u.preferred_language \
         FROM rooms r \
         INNER JOIN users u ON u.id = r.teacher_id \
         WHERE r.id = $1",
    )
    .bind(room_id)
    .fetch_optional(db)
    .await
    .map_err(|_| server_error())?;

    let Some((teacher_id, halaqah_name, teacher_locale)) = row else {
        return Err((
            StatusCode::NOT_FOUND,
            Json(ApiMessage {
                message: "غير موجود",
                code: "not_found",
            }),
        ));
    };

    if !can_manage_room(auth, teacher_id) {
        return Err((
            StatusCode::FORBIDDEN,
            Json(ApiMessage {
                message: "غير مصرح",
                code: "not_owner",
            }),
        ));
    }

    let teacher_name: String = sqlx::query_scalar("SELECT name FROM users WHERE id = $1")
        .bind(teacher_id)
        .fetch_one(db)
        .await
        .map_err(|_| server_error())?;

    Ok((teacher_name, halaqah_name, teacher_locale))
}

async fn revoke_active_invites_for_email(
    db: &sqlx::PgPool,
    room_id: Uuid,
    email: &str,
) -> Result<(), sqlx::Error> {
    sqlx::query(
        "UPDATE share_links SET revoked_at = COALESCE(revoked_at, NOW()) \
         WHERE target_type = 'invite' \
         AND target_id = $1 \
         AND email_bound = $2 \
         AND revoked_at IS NULL \
         AND (expires_at IS NULL OR expires_at > NOW()) \
         AND (max_uses IS NULL OR use_count < max_uses)",
    )
    .bind(room_id)
    .bind(email)
    .execute(db)
    .await?;
    Ok(())
}

async fn insert_invite_link(
    db: &sqlx::PgPool,
    room_id: Uuid,
    created_by: Uuid,
    email: &str,
    auto_approve: bool,
) -> Result<ShareLink, sqlx::Error> {
    for _ in 0..5 {
        let token = generate_share_token();
        let result = sqlx::query_as::<_, ShareLink>(
            "INSERT INTO share_links \
             (token, target_type, target_id, created_by, auto_approve, email_bound, max_uses) \
             VALUES ($1, 'invite', $2, $3, $4, $5, 1) \
             RETURNING id, token, target_type, target_id, created_by, auto_approve, email_bound, \
                       expires_at, max_uses, use_count, join_count, revoked_at, created_at",
        )
        .bind(&token)
        .bind(room_id)
        .bind(created_by)
        .bind(auto_approve)
        .bind(email)
        .fetch_one(db)
        .await;

        match result {
            Ok(link) => return Ok(link),
            Err(e) if is_unique_violation(&e) => continue,
            Err(e) => return Err(e),
        }
    }

    Err(sqlx::Error::RowNotFound)
}

async fn enqueue_halaqah_invite_email(
    state: &AppState,
    to_email: &str,
    locale: &str,
    teacher_name: &str,
    halaqah_name: &str,
    share_url: &str,
) {
    let vars = TemplateVars::new()
        .with("teacher_name", teacher_name)
        .with("halaqah_name", halaqah_name)
        .with("share_url", share_url);
    let _ = enqueue(
        &state.db,
        &state.config,
        "halaqah_invite",
        locale,
        to_email,
        None,
        vars,
    )
    .await;
}

pub async fn send_room_invites(
    State(state): State<AppState>,
    auth: AuthenticatedUser,
    Path(room_id): Path<Uuid>,
    Json(req): Json<SendRoomInvitesRequest>,
) -> Result<Json<Vec<InviteResultItem>>, (StatusCode, Json<ApiMessage>)> {
    let (teacher_name, halaqah_name, teacher_locale) =
        authorize_room_invites(&state.db, &auth, room_id).await?;

    let locale = normalize_invite_locale(req.locale.as_deref(), &teacher_locale);
    let auto_approve = req.auto_approve;

    let mut seen = std::collections::HashSet::new();
    let mut results = Vec::new();

    for raw in &req.emails {
        let email = raw.trim().to_lowercase();
        if email.is_empty() || !is_valid_email(&email) {
            continue;
        }
        if !seen.insert(email.clone()) {
            continue;
        }

        revoke_active_invites_for_email(&state.db, room_id, &email)
            .await
            .map_err(|_| server_error())?;

        let link = insert_invite_link(&state.db, room_id, auth.id, &email, auto_approve)
            .await
            .map_err(|_| server_error())?;

        let url = share_url(&state.config, &link.token);
        enqueue_halaqah_invite_email(
            &state,
            &email,
            &locale,
            &teacher_name,
            &halaqah_name,
            &url,
        )
        .await;

        results.push(InviteResultItem {
            id: link.id,
            email,
            share_url: url,
            status: "created",
        });
    }

    Ok(Json(results))
}

pub async fn resend_invite(
    State(state): State<AppState>,
    auth: AuthenticatedUser,
    Path(link_id): Path<Uuid>,
) -> Result<Json<ApiMessage>, (StatusCode, Json<ApiMessage>)> {
    let link: Option<ShareLink> = sqlx::query_as(&format!(
        "SELECT {LINK_COLS} FROM share_links WHERE id = $1 AND target_type = 'invite'"
    ))
    .bind(link_id)
    .fetch_optional(&state.db)
    .await
    .map_err(|_| server_error())?;

    let Some(link) = link else {
        return Err((
            StatusCode::NOT_FOUND,
            Json(ApiMessage {
                message: "غير موجود",
                code: "not_found",
            }),
        ));
    };

    let Some(room_id) = link.target_id else {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(ApiMessage {
                message: "الرابط غير صالح",
                code: "invalid_link",
            }),
        ));
    };

    let (teacher_name, halaqah_name, teacher_locale) =
        authorize_room_invites(&state.db, &auth, room_id).await?;

    let email = link
        .email_bound
        .as_deref()
        .map(str::trim)
        .filter(|e| !e.is_empty());

    let Some(email) = email else {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(ApiMessage {
                message: "الرابط غير صالح",
                code: "invalid_link",
            }),
        ));
    };

    if link.revoked_at.is_some() {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(ApiMessage {
                message: "الرابط غير صالح",
                code: "invalid_link",
            }),
        ));
    }

    if link.expires_at.is_some_and(|exp| exp <= Utc::now()) {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(ApiMessage {
                message: "الرابط غير صالح",
                code: "invalid_link",
            }),
        ));
    }

    if link.max_uses.is_some_and(|max| link.use_count >= max) {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(ApiMessage {
                message: "الرابط غير صالح",
                code: "invalid_link",
            }),
        ));
    }

    let locale = normalize_invite_locale(None, &teacher_locale);
    let url = share_url(&state.config, &link.token);
    enqueue_halaqah_invite_email(
        &state,
        email,
        &locale,
        &teacher_name,
        &halaqah_name,
        &url,
    )
    .await;

    Ok(Json(ApiMessage {
        message: "تم إعادة الإرسال",
        code: "resent",
    }))
}

async fn fetch_halaqah_teaser(
    db: &sqlx::PgPool,
    room_id: Uuid,
) -> Result<Option<HalaqahTeaserRow>, sqlx::Error> {
    sqlx::query_as::<_, HalaqahTeaserRow>(
        "SELECT r.name, u.name AS teacher_name, r.riwaya, r.halaqah_type::text AS halaqah_type, r.is_public, \
         r.enrollment_open, r.requires_approval, r.max_students, r.description, \
         (SELECT COUNT(*)::bigint FROM enrollments e \
          WHERE e.room_id = r.id AND e.status = 'approved') AS enrolled_count \
         FROM rooms r \
         INNER JOIN users u ON u.id = r.teacher_id \
         WHERE r.id = $1",
    )
    .bind(room_id)
    .fetch_optional(db)
    .await
}

async fn fetch_session_teaser(
    db: &sqlx::PgPool,
    session_id: Uuid,
) -> Result<Option<SessionTeaserRow>, sqlx::Error> {
    sqlx::query_as::<_, SessionTeaserRow>(
        "SELECT s.title, s.scheduled_at, s.duration_minutes, s.status::text AS status, \
         r.name AS room_name, u.name AS teacher_name \
         FROM sessions s \
         INNER JOIN rooms r ON r.id = s.room_id \
         INNER JOIN users u ON u.id = r.teacher_id \
         WHERE s.id = $1",
    )
    .bind(session_id)
    .fetch_optional(db)
    .await
}

fn halaqah_teaser_from_row(row: HalaqahTeaserRow) -> (HalaqahTeaser, Option<String>) {
    let teaser = HalaqahTeaser {
        name: row.name,
        teacher_name: row.teacher_name,
        riwaya: row.riwaya,
        halaqah_type: row.halaqah_type,
        is_public: row.is_public,
        enrollment_open: row.enrollment_open,
        requires_approval: row.requires_approval,
        max_students: row.max_students,
        enrolled_count: row.enrolled_count,
    };
    (teaser, row.description)
}

fn teaser_to_public(payload: &TeaserPayload) -> PublicShareResponse {
    match payload {
        TeaserPayload::Halaqah { teaser, .. } => PublicShareResponse::Halaqah(teaser.clone()),
        TeaserPayload::Invite { teaser, .. } => PublicShareResponse::Invite(teaser.clone()),
        TeaserPayload::Session { teaser } => PublicShareResponse::Session(teaser.clone()),
        TeaserPayload::Instance { teaser } => PublicShareResponse::Instance(InstanceTeaser {
            app_name: teaser.app_name,
            tagline: teaser.tagline,
        }),
    }
}

async fn load_teaser_for_link(
    state: &AppState,
    link: &ShareLink,
) -> Result<TeaserPayload, ShareError> {
    match link.target_type.as_str() {
        "halaqah" => {
            let Some(room_id) = link.target_id else {
                return Err(ShareError::InvalidLink);
            };
            let Some(row) = fetch_halaqah_teaser(&state.db, room_id)
                .await
                .map_err(ShareError::Db)?
            else {
                return Err(ShareError::InvalidLink);
            };
            let (teaser, description) = halaqah_teaser_from_row(row);
            Ok(TeaserPayload::Halaqah {
                teaser,
                description,
            })
        }
        "invite" => {
            let Some(room_id) = link.target_id else {
                return Err(ShareError::InvalidLink);
            };
            let Some(row) = fetch_halaqah_teaser(&state.db, room_id)
                .await
                .map_err(ShareError::Db)?
            else {
                return Err(ShareError::InvalidLink);
            };
            let (base, description) = halaqah_teaser_from_row(row);
            Ok(TeaserPayload::Invite {
                teaser: InviteTeaser {
                    name: base.name,
                    teacher_name: base.teacher_name,
                    riwaya: base.riwaya,
                    halaqah_type: base.halaqah_type,
                    is_public: base.is_public,
                    enrollment_open: base.enrollment_open,
                    requires_approval: base.requires_approval,
                    max_students: base.max_students,
                    enrolled_count: base.enrolled_count,
                    auto_approve: link.auto_approve,
                },
                description,
            })
        }
        "session" => {
            let Some(session_id) = link.target_id else {
                return Err(ShareError::InvalidLink);
            };
            let Some(row) = fetch_session_teaser(&state.db, session_id)
                .await
                .map_err(ShareError::Db)?
            else {
                return Err(ShareError::InvalidLink);
            };
            Ok(TeaserPayload::Session {
                teaser: SessionTeaser {
                    title: row.title,
                    scheduled_at: row.scheduled_at,
                    duration_minutes: row.duration_minutes,
                    status: row.status,
                    room_name: row.room_name,
                    teacher_name: row.teacher_name,
                },
            })
        }
        "instance" => Ok(TeaserPayload::Instance {
            teaser: InstanceTeaser {
                app_name: INSTANCE_APP_NAME,
                tagline: INSTANCE_TAGLINE,
            },
        }),
        _ => Err(ShareError::InvalidLink),
    }
}

async fn fetch_valid_share_link(
    state: &AppState,
    token: &str,
) -> Result<ShareLink, ShareError> {
    let token = token.trim();
    sqlx::query_as(&format!(
        "SELECT {LINK_COLS} FROM share_links \
         WHERE token = $1 \
         AND revoked_at IS NULL \
         AND (expires_at IS NULL OR expires_at > NOW()) \
         AND (max_uses IS NULL OR use_count < max_uses)"
    ))
    .bind(token)
    .fetch_optional(&state.db)
    .await
    .map_err(ShareError::Db)?
    .ok_or(ShareError::InvalidLink)
}

async fn enrollment_status_for_student(
    db: &sqlx::PgPool,
    room_id: Uuid,
    student_id: Uuid,
) -> Result<Option<String>, sqlx::Error> {
    sqlx::query_scalar(
        "SELECT status FROM enrollments WHERE room_id = $1 AND student_id = $2",
    )
    .bind(room_id)
    .bind(student_id)
    .fetch_optional(db)
    .await
}

pub async fn accept_share(
    State(state): State<AppState>,
    auth: AuthenticatedUser,
    Path(token): Path<String>,
) -> Result<Json<AcceptShareResponse>, (StatusCode, Json<ApiMessage>)> {
    let invalid = || {
        (
            StatusCode::NOT_FOUND,
            Json(ApiMessage {
                message: "الرابط غير صالح",
                code: "invalid_link",
            }),
        )
    };

    let link = fetch_valid_share_link(&state, &token)
        .await
        .map_err(|e| match e {
            ShareError::InvalidLink => invalid(),
            ShareError::Db(_) => server_error(),
        })?;

    if let Some(bound) = link.email_bound.as_deref() {
        let bound = bound.trim().to_lowercase();
        let caller = auth.email.trim().to_lowercase();
        if !bound.is_empty() && bound != caller {
            return Err((
                StatusCode::FORBIDDEN,
                Json(ApiMessage {
                    message: "هذا الرابط مخصّص لحساب آخر",
                    code: "wrong_account",
                }),
            ));
        }
    }

    let mut enrollment_status: Option<String> = None;
    let mut joined = false;

    match link.target_type.as_str() {
        "halaqah" | "invite" => {
            let Some(room_id) = link.target_id else {
                return Err(invalid());
            };

            let room_exists: bool = sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM rooms WHERE id = $1)")
                .bind(room_id)
                .fetch_one(&state.db)
                .await
                .map_err(|_| server_error())?;
            if !room_exists {
                return Err(invalid());
            }

            if auth.role == "student" {
                let enrollment_open: Option<bool> = sqlx::query_scalar(
                    "SELECT enrollment_open FROM rooms WHERE id = $1",
                )
                .bind(room_id)
                .fetch_optional(&state.db)
                .await
                .map_err(|_| server_error())?;

                if enrollment_open == Some(true) {
                    let force_approved =
                        link.target_type == "invite" && link.auto_approve;
                    let mut tx = state.db.begin().await.map_err(|_| server_error())?;
                    match enroll_student(&mut tx, room_id, auth.id, force_approved).await {
                        Ok(EnrollOutcome::Created { status }) => {
                            tx.commit().await.map_err(|_| server_error())?;
                            joined = true;
                            enrollment_status = Some(status.clone());
                            if status == "pending" {
                                notify_pending_enrollment_request(&state, room_id, auth.id).await;
                            }
                        }
                        Ok(EnrollOutcome::AlreadyEnrolled { status }) => {
                            let _ = tx.rollback().await;
                            enrollment_status = Some(status);
                        }
                        Err(e) => {
                            let _ = tx.rollback().await;
                            return Err(match e {
                                EnrollStudentError::NotFound => invalid(),
                                EnrollStudentError::RoomNotAvailable => (
                                    StatusCode::FORBIDDEN,
                                    Json(ApiMessage {
                                        message: "الغرفة غير متاحة",
                                        code: "room_not_available",
                                    }),
                                ),
                                EnrollStudentError::EnrollmentClosed => (
                                    StatusCode::BAD_REQUEST,
                                    Json(ApiMessage {
                                        message: "التسجيل مغلق",
                                        code: "enrollment_closed",
                                    }),
                                ),
                                EnrollStudentError::RoomFull => (
                                    StatusCode::BAD_REQUEST,
                                    Json(ApiMessage {
                                        message: "الغرفة ممتلئة",
                                        code: "room_full",
                                    }),
                                ),
                                EnrollStudentError::Db(_) => server_error(),
                            });
                        }
                    }
                } else {
                    enrollment_status = enrollment_status_for_student(&state.db, room_id, auth.id)
                        .await
                        .map_err(|_| server_error())?;
                }
            }

            if joined {
                sqlx::query(
                    "UPDATE share_links SET join_count = join_count + 1 WHERE token = $1",
                )
                .bind(&link.token)
                .execute(&state.db)
                .await
                .map_err(|_| server_error())?;
            }

            Ok(Json(AcceptShareResponse {
                target_type: link.target_type,
                target_id: Some(room_id),
                route: format!("/rooms/{room_id}"),
                enrollment_status,
                joined,
            }))
        }
        "session" => {
            let Some(session_id) = link.target_id else {
                return Err(invalid());
            };

            #[derive(FromRow)]
            struct SessionAcceptRow {
                room_id: Uuid,
                status: String,
                teacher_id: Uuid,
            }

            let Some(row) = sqlx::query_as::<_, SessionAcceptRow>(
                "SELECT s.room_id, s.status::text AS status, r.teacher_id \
                 FROM sessions s \
                 INNER JOIN rooms r ON r.id = s.room_id \
                 WHERE s.id = $1",
            )
            .bind(session_id)
            .fetch_optional(&state.db)
            .await
            .map_err(|_| server_error())?
            else {
                return Err(invalid());
            };

            if auth.role == "student" {
                let enrollment_open: Option<bool> = sqlx::query_scalar(
                    "SELECT enrollment_open FROM rooms WHERE id = $1",
                )
                .bind(row.room_id)
                .fetch_optional(&state.db)
                .await
                .map_err(|_| server_error())?;

                if enrollment_open == Some(true) {
                    let mut tx = state.db.begin().await.map_err(|_| server_error())?;
                    match enroll_student(&mut tx, row.room_id, auth.id, false).await {
                        Ok(EnrollOutcome::Created { status }) => {
                            tx.commit().await.map_err(|_| server_error())?;
                            joined = true;
                            enrollment_status = Some(status.clone());
                            if status == "pending" {
                                notify_pending_enrollment_request(&state, row.room_id, auth.id).await;
                            }
                        }
                        Ok(EnrollOutcome::AlreadyEnrolled { status }) => {
                            let _ = tx.rollback().await;
                            enrollment_status = Some(status);
                        }
                        Err(e) => {
                            let _ = tx.rollback().await;
                            return Err(match e {
                                EnrollStudentError::NotFound => invalid(),
                                EnrollStudentError::RoomNotAvailable => (
                                    StatusCode::FORBIDDEN,
                                    Json(ApiMessage {
                                        message: "الغرفة غير متاحة",
                                        code: "room_not_available",
                                    }),
                                ),
                                EnrollStudentError::EnrollmentClosed => (
                                    StatusCode::BAD_REQUEST,
                                    Json(ApiMessage {
                                        message: "التسجيل مغلق",
                                        code: "enrollment_closed",
                                    }),
                                ),
                                EnrollStudentError::RoomFull => (
                                    StatusCode::BAD_REQUEST,
                                    Json(ApiMessage {
                                        message: "الغرفة ممتلئة",
                                        code: "room_full",
                                    }),
                                ),
                                EnrollStudentError::Db(_) => server_error(),
                            });
                        }
                    }
                } else {
                    enrollment_status = enrollment_status_for_student(&state.db, row.room_id, auth.id)
                        .await
                        .map_err(|_| server_error())?;
                }
            }

            if joined {
                sqlx::query(
                    "UPDATE share_links SET join_count = join_count + 1 WHERE token = $1",
                )
                .bind(&link.token)
                .execute(&state.db)
                .await
                .map_err(|_| server_error())?;
            }

            let can_enter_live = row.status == "in_progress"
                && (auth.role == "admin"
                    || auth.id == row.teacher_id
                    || enrollment_status.as_deref() == Some("approved"));

            let route = if can_enter_live {
                format!("/sessions/{session_id}/live")
            } else {
                format!("/sessions/{session_id}")
            };

            Ok(Json(AcceptShareResponse {
                target_type: link.target_type,
                target_id: Some(session_id),
                route,
                enrollment_status,
                joined,
            }))
        }
        "instance" => Ok(Json(AcceptShareResponse {
            target_type: link.target_type,
            target_id: None,
            route: "/".to_string(),
            enrollment_status: None,
            joined: false,
        })),
        _ => Err(invalid()),
    }
}

pub async fn resolve_share(
    state: &AppState,
    token: &str,
    count_open: bool,
) -> Result<TeaserPayload, ShareError> {
    let token = token.trim();

    let link: Option<ShareLink> = if count_open {
        sqlx::query_as(&format!(
            "UPDATE share_links SET use_count = use_count + 1 \
             WHERE token = $1 \
             AND revoked_at IS NULL \
             AND (expires_at IS NULL OR expires_at > NOW()) \
             AND (max_uses IS NULL OR use_count < max_uses) \
             RETURNING {LINK_COLS}"
        ))
        .bind(token)
        .fetch_optional(&state.db)
        .await
        .map_err(ShareError::Db)?
    } else {
        sqlx::query_as(&format!(
            "SELECT {LINK_COLS} FROM share_links \
             WHERE token = $1 \
             AND revoked_at IS NULL \
             AND (expires_at IS NULL OR expires_at > NOW()) \
             AND (max_uses IS NULL OR use_count < max_uses)"
        ))
        .bind(token)
        .fetch_optional(&state.db)
        .await
        .map_err(ShareError::Db)?
    };

    let Some(link) = link else {
        return Err(ShareError::InvalidLink);
    };

    load_teaser_for_link(state, &link).await
}

pub async fn share_ics(
    State(state): State<AppState>,
    Path(token): Path<String>,
) -> Result<axum::response::Response, StatusCode> {
    let link = fetch_valid_share_link(&state, &token)
        .await
        .map_err(|_| StatusCode::NOT_FOUND)?;

    if link.target_type != "session" {
        return Err(StatusCode::NOT_FOUND);
    }

    let session_id = link.target_id.ok_or(StatusCode::NOT_FOUND)?;

    let Some(row) = fetch_session_teaser(&state.db, session_id)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
    else {
        return Err(StatusCode::NOT_FOUND);
    };

    let base = state.config.public_base_url.trim_end_matches('/');
    let token_trimmed = token.trim();
    let join_url = format!("{base}/s/{token_trimmed}");

    let body = build_session_ics(&SessionIcsInput {
        session_id,
        title: row.title,
        room_name: row.room_name,
        teacher_name: row.teacher_name,
        scheduled_at: row.scheduled_at,
        duration_minutes: row.duration_minutes,
        join_url,
    });

    Ok(ics_calendar_response(body))
}

pub async fn resolve_public(
    State(state): State<AppState>,
    Path(token): Path<String>,
) -> Result<Json<PublicShareResponse>, (StatusCode, Json<ApiMessage>)> {
    let payload = resolve_share(&state, &token, true)
        .await
        .map_err(|e| match e {
            ShareError::InvalidLink => (
                StatusCode::NOT_FOUND,
                Json(ApiMessage {
                    message: "الرابط غير صالح",
                    code: "invalid_link",
                }),
            ),
            ShareError::Db(_) => server_error(),
        })?;

    Ok(Json(teaser_to_public(&payload)))
}

#[cfg(test)]
mod share_teaser_tests {
    use super::HalaqahTeaserRow;
    use sqlx::PgPool;
    use uuid::Uuid;

    async fn test_pool() -> PgPool {
        let path = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join(".env");
        dotenvy::from_path_override(&path).ok();
        let url = std::env::var("DATABASE_URL").expect("DATABASE_URL");
        PgPool::connect(&url).await.expect("db connect")
    }

    #[tokio::test]
    async fn halaqah_teaser_row_decodes_from_db() {
        let pool = test_pool().await;
        let room_id = Uuid::parse_str("3b711707-58fa-4617-9690-bcc06baf37b9").unwrap();

        let row = sqlx::query_as::<_, HalaqahTeaserRow>(
            "SELECT r.name, u.name AS teacher_name, r.riwaya, r.halaqah_type::text AS halaqah_type, r.is_public, \
             r.enrollment_open, r.requires_approval, r.max_students, r.description, \
             (SELECT COUNT(*)::bigint FROM enrollments e \
              WHERE e.room_id = r.id AND e.status = 'approved') AS enrolled_count \
             FROM rooms r \
             INNER JOIN users u ON u.id = r.teacher_id \
             WHERE r.id = $1",
        )
        .bind(room_id)
        .fetch_optional(&pool)
        .await
        .expect("query should succeed");

        assert!(row.is_some(), "expected halaqah teaser row for test room");
        let row = row.unwrap();
        assert_eq!(row.name, "3rd");
        assert_eq!(row.halaqah_type, "hifz");
    }

    #[tokio::test]
    async fn share_link_returning_decodes_for_halaqah_token() {
        use crate::models::share_link::ShareLink;

        let pool = test_pool().await;
        const LINK_COLS: &str = "id, token, target_type, target_id, created_by, auto_approve, \
             email_bound, expires_at, max_uses, use_count, join_count, revoked_at, created_at";

        let link = sqlx::query_as::<_, ShareLink>(&format!(
            "SELECT {LINK_COLS} FROM share_links WHERE token = $1"
        ))
        .bind("uMy3o36izzcztl9kU3Ugj56J")
        .fetch_optional(&pool)
        .await
        .expect("share link query should succeed");

        assert!(link.is_some(), "expected share link row");
        assert_eq!(link.unwrap().target_type, "halaqah");
    }
}
