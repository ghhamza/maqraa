// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    Json,
};
use serde::{Deserialize, Serialize};
use sqlx::{Postgres, QueryBuilder};
use uuid::Uuid;

use crate::api::extractors::AuthenticatedUser;
use crate::api::types::{Paginated, UserAdminDetail, UserPublic, UserStatsResponse};
use crate::api::user_response::load_user_admin_detail;
use crate::api::AppState;
use crate::auth::password;
use crate::notifications::{enqueue, render, TemplateVars};

#[derive(Deserialize)]
pub struct ListUsersQuery {
    pub role: Option<String>,
    pub search: Option<String>,
    pub limit: Option<i64>,
    pub offset: Option<i64>,
}

fn push_user_filters<'a>(qb: &mut QueryBuilder<'a, Postgres>, params: &'a ListUsersQuery) {
    if let Some(r) = &params.role {
        let r = r.trim();
        if r == "student" || r == "teacher" || r == "admin" {
            qb.push(" AND role::text = ");
            qb.push_bind(r);
        }
    }

    if let Some(s) = &params.search {
        let t = s.trim();
        if !t.is_empty() {
            let pattern = format!("%{}%", t);
            qb.push(" AND (name ILIKE ");
            qb.push_bind(pattern.clone());
            qb.push(" OR email ILIKE ");
            qb.push_bind(pattern);
            qb.push(")");
        }
    }
}

#[derive(Deserialize)]
pub struct CreateUserRequest {
    pub name: String,
    pub email: String,
    pub password: String,
    pub role: String,
}

#[derive(Deserialize)]
pub struct UpdateUserRequest {
    pub name: Option<String>,
    pub email: Option<String>,
    pub role: Option<String>,
}

#[derive(Serialize)]
pub struct DeleteSelfError {
    pub message: &'static str,
    pub code: &'static str,
}

fn require_admin(auth: &AuthenticatedUser) -> Result<(), StatusCode> {
    if auth.role != "admin" {
        return Err(StatusCode::FORBIDDEN);
    }
    Ok(())
}

fn validate_role_str(role: &str) -> Result<&str, StatusCode> {
    match role {
        "student" | "teacher" | "admin" => Ok(role),
        _ => Err(StatusCode::BAD_REQUEST),
    }
}

pub async fn stats(
    State(state): State<AppState>,
    auth: AuthenticatedUser,
) -> Result<Json<UserStatsResponse>, StatusCode> {
    require_admin(&auth)?;

    let total: i64 = sqlx::query_scalar("SELECT COUNT(*)::bigint FROM users")
        .fetch_one(&state.db)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let students: i64 = sqlx::query_scalar(
        "SELECT COUNT(*)::bigint FROM users WHERE role = 'student'::user_role",
    )
    .fetch_one(&state.db)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let teachers: i64 = sqlx::query_scalar(
        "SELECT COUNT(*)::bigint FROM users WHERE role = 'teacher'::user_role",
    )
    .fetch_one(&state.db)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let admins: i64 = sqlx::query_scalar(
        "SELECT COUNT(*)::bigint FROM users WHERE role = 'admin'::user_role",
    )
    .fetch_one(&state.db)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(UserStatsResponse {
        total,
        students,
        teachers,
        admins,
    }))
}

pub async fn list_users(
    State(state): State<AppState>,
    auth: AuthenticatedUser,
    Query(params): Query<ListUsersQuery>,
) -> Result<Json<Paginated<UserPublic>>, StatusCode> {
    require_admin(&auth)?;

    let limit = params.limit.unwrap_or(50).clamp(1, 100);
    let offset = params.offset.unwrap_or(0).max(0);

    let mut qb_count = QueryBuilder::new("SELECT COUNT(*)::bigint FROM users WHERE 1=1");
    push_user_filters(&mut qb_count, &params);
    let total: i64 = qb_count
        .build_query_scalar()
        .fetch_one(&state.db)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let mut qb = QueryBuilder::new(
        "SELECT id, name, email, role::text AS role, created_at FROM users WHERE 1=1",
    );
    push_user_filters(&mut qb, &params);
    qb.push(" ORDER BY created_at DESC");
    qb.push(" LIMIT ");
    qb.push_bind(limit);
    qb.push(" OFFSET ");
    qb.push_bind(offset);

    let users = qb
        .build_query_as::<UserPublic>()
        .fetch_all(&state.db)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(Paginated {
        items: users,
        total,
        limit,
        offset,
    }))
}

pub async fn get_user(
    State(state): State<AppState>,
    auth: AuthenticatedUser,
    Path(id): Path<Uuid>,
) -> Result<Json<UserAdminDetail>, StatusCode> {
    require_admin(&auth)?;

    load_user_admin_detail(&state.db, id)
        .await
        .map(Json)
        .map_err(|e| match e {
            sqlx::Error::RowNotFound => StatusCode::NOT_FOUND,
            _ => StatusCode::INTERNAL_SERVER_ERROR,
        })
}

pub async fn create_user(
    State(state): State<AppState>,
    auth: AuthenticatedUser,
    Json(req): Json<CreateUserRequest>,
) -> Result<Json<UserPublic>, StatusCode> {
    require_admin(&auth)?;

    let role = validate_role_str(&req.role)?;
    let email = req.email.trim().to_lowercase();
    if email.is_empty() || req.name.trim().is_empty() {
        return Err(StatusCode::BAD_REQUEST);
    }

    let hash = password::hash_password(&req.password).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    let id = Uuid::new_v4();

    sqlx::query(
        "INSERT INTO users (id, name, email, password_hash, role) VALUES ($1, $2, $3, $4, $5::user_role)",
    )
    .bind(id)
    .bind(req.name.trim())
    .bind(&email)
    .bind(&hash)
    .bind(role)
    .execute(&state.db)
    .await
    .map_err(|e| {
        if let Some(db) = e.as_database_error() {
            if db.code().as_deref() == Some("23505") {
                return StatusCode::CONFLICT;
            }
        }
        tracing::error!(error = ?e, "create_user insert failed");
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    let user = sqlx::query_as::<_, UserPublic>(
        "SELECT id, name, email, role::text AS role, created_at FROM users WHERE id = $1",
    )
    .bind(id)
    .fetch_one(&state.db)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(user))
}

pub async fn update_user(
    State(state): State<AppState>,
    auth: AuthenticatedUser,
    Path(id): Path<Uuid>,
    Json(req): Json<UpdateUserRequest>,
) -> Result<Json<UserPublic>, StatusCode> {
    require_admin(&auth)?;

    let existing = sqlx::query_as::<_, UserPublic>(
        "SELECT id, name, email, role::text AS role, created_at FROM users WHERE id = $1",
    )
    .bind(id)
    .fetch_optional(&state.db)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
    .ok_or(StatusCode::NOT_FOUND)?;

    if req.name.is_none() && req.email.is_none() && req.role.is_none() {
        return Err(StatusCode::BAD_REQUEST);
    }

    let name = req.name.map(|n| n.trim().to_string()).unwrap_or(existing.name.clone());
    let email = req
        .email
        .map(|e| e.trim().to_lowercase())
        .unwrap_or(existing.email.clone());
    let role_str = if let Some(r) = &req.role {
        validate_role_str(r)?.to_string()
    } else {
        existing.role.clone()
    };

    if name.is_empty() || email.is_empty() {
        return Err(StatusCode::BAD_REQUEST);
    }

    if email != existing.email {
        let exists: bool = sqlx::query_scalar(
            "SELECT EXISTS(SELECT 1 FROM users WHERE lower(trim(email)) = $1 AND id <> $2)",
        )
        .bind(&email)
        .bind(id)
        .fetch_one(&state.db)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
        if exists {
            return Err(StatusCode::CONFLICT);
        }
    }

    sqlx::query(
        "UPDATE users SET name = $1, email = $2, role = $3::user_role WHERE id = $4",
    )
    .bind(&name)
    .bind(&email)
    .bind(&role_str)
    .bind(id)
    .execute(&state.db)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let updated = sqlx::query_as::<_, UserPublic>(
        "SELECT id, name, email, role::text AS role, created_at FROM users WHERE id = $1",
    )
    .bind(id)
    .fetch_one(&state.db)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(updated))
}

pub async fn delete_user(
    State(state): State<AppState>,
    auth: AuthenticatedUser,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, (StatusCode, Json<DeleteSelfError>)> {
    require_admin(&auth).map_err(|_| {
        (
            StatusCode::FORBIDDEN,
            Json(DeleteSelfError {
                message: "غير مصرح",
                code: "no_permission",
            }),
        )
    })?;

    if id == auth.id {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(DeleteSelfError {
                message: "لا يمكنك حذف حسابك",
                code: "delete_self_account",
            }),
        ));
    }

    let has_rooms: bool = sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM rooms WHERE teacher_id = $1)")
        .bind(id)
        .fetch_one(&state.db)
        .await
        .map_err(|_| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(DeleteSelfError {
                    message: "خطأ في الخادم",
                    code: "server_error",
                }),
            )
        })?;

    if has_rooms {
        return Err((
            StatusCode::CONFLICT,
            Json(DeleteSelfError {
                message: "لا يمكن حذف معلّم لديه غرف",
                code: "teacher_has_rooms",
            }),
        ));
    }

    let result = sqlx::query("DELETE FROM users WHERE id = $1")
        .bind(id)
        .execute(&state.db)
        .await
        .map_err(|_| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(DeleteSelfError {
                    message: "خطأ في الخادم",
                    code: "server_error",
                }),
            )
        })?;

    if result.rows_affected() == 0 {
        return Err((
            StatusCode::NOT_FOUND,
            Json(DeleteSelfError {
                message: "غير موجود",
                code: "not_found",
            }),
        ));
    }

    Ok(StatusCode::NO_CONTENT)
}

#[derive(Serialize)]
pub struct SendSessionGuideResponse {
    pub queued: bool,
}

pub async fn send_session_guide(
    State(state): State<AppState>,
    auth: AuthenticatedUser,
    Path(id): Path<Uuid>,
) -> Result<Json<SendSessionGuideResponse>, StatusCode> {
    require_admin(&auth)?;

    let target: Option<(String, String, String, String)> = sqlx::query_as(
        "SELECT name, email, preferred_language, role::text FROM users WHERE id = $1",
    )
    .bind(id)
    .fetch_optional(&state.db)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let Some((name, email, preferred_language, role)) = target else {
        return Err(StatusCode::NOT_FOUND);
    };

    if role != "teacher" {
        return Err(StatusCode::BAD_REQUEST);
    }

    let vars = TemplateVars::new().with("name", name);
    enqueue(
        &state.db,
        &state.config,
        "first_session_guide",
        &preferred_language,
        &email,
        Some(id),
        vars,
    )
    .await
    .map_err(|e| {
        tracing::error!(error = %e, user_id = %id, "failed to enqueue first_session_guide");
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    Ok(Json(SendSessionGuideResponse { queued: true }))
}

#[derive(Serialize)]
pub struct SendProfileReminderResponse {
    pub queued: bool,
}

pub async fn send_profile_reminder(
    State(state): State<AppState>,
    auth: AuthenticatedUser,
    Path(id): Path<Uuid>,
) -> Result<Json<SendProfileReminderResponse>, StatusCode> {
    require_admin(&auth)?;

    let target: Option<(String, String, String, String, bool)> = sqlx::query_as(
        "SELECT name, email, preferred_language, role::text, profile_completion_pending \
         FROM users WHERE id = $1",
    )
    .bind(id)
    .fetch_optional(&state.db)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let Some((name, email, preferred_language, role, profile_completion_pending)) = target else {
        return Err(StatusCode::NOT_FOUND);
    };

    if role != "teacher" && role != "student" {
        return Err(StatusCode::BAD_REQUEST);
    }

    if !profile_completion_pending {
        return Err(StatusCode::CONFLICT);
    }

    let base = state.config.app_base_url.trim_end_matches('/');
    let vars = TemplateVars::new()
        .with("name", name)
        .with("app_url", format!("{base}/profile/complete"));

    enqueue(
        &state.db,
        &state.config,
        "profile_completion_reminder",
        &preferred_language,
        &email,
        Some(id),
        vars,
    )
    .await
    .map_err(|e| {
        tracing::error!(error = %e, user_id = %id, "failed to enqueue profile_completion_reminder");
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    sqlx::query("UPDATE users SET profile_nudge_sent_at = now() WHERE id = $1")
        .bind(id)
        .execute(&state.db)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(SendProfileReminderResponse { queued: true }))
}

const CUSTOM_EMAIL_MAX_SUBJECT: usize = 200;
const CUSTOM_EMAIL_MAX_MESSAGE: usize = 5_000;

#[derive(Deserialize)]
pub struct CustomEmailRequest {
    pub subject: String,
    pub message: String,
    /// Admin UI language for greeting, footer, and layout (ar/en/fr).
    pub locale: Option<String>,
}

#[derive(Serialize)]
pub struct CustomEmailPreviewResponse {
    pub subject: String,
    pub html: String,
    pub text: String,
}

#[derive(Serialize)]
pub struct SendCustomEmailResponse {
    pub queued: bool,
}

struct CustomEmailTarget {
    name: String,
    email: String,
    role: String,
}

async fn load_custom_email_target(
    db: &sqlx::PgPool,
    id: Uuid,
) -> Result<CustomEmailTarget, StatusCode> {
    let target: Option<(String, String, String)> = sqlx::query_as(
        "SELECT name, email, role::text FROM users WHERE id = $1",
    )
    .bind(id)
    .fetch_optional(db)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let Some((name, email, role)) = target else {
        return Err(StatusCode::NOT_FOUND);
    };

    if role != "teacher" && role != "student" {
        return Err(StatusCode::BAD_REQUEST);
    }

    Ok(CustomEmailTarget {
        name,
        email,
        role,
    })
}

fn normalize_email_locale(locale: &str) -> &str {
    match locale {
        "ar" | "en" | "fr" => locale,
        _ => "ar",
    }
}

async fn resolve_sender_locale(
    db: &sqlx::PgPool,
    sender_id: Uuid,
    requested: Option<&str>,
) -> Result<String, StatusCode> {
    if let Some(locale) = requested.map(str::trim).filter(|s| !s.is_empty()) {
        return Ok(normalize_email_locale(locale).to_string());
    }

    let locale: Option<String> = sqlx::query_scalar(
        "SELECT preferred_language FROM users WHERE id = $1",
    )
    .bind(sender_id)
    .fetch_optional(db)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(normalize_email_locale(&locale.unwrap_or_else(|| "ar".to_string())).to_string())
}

fn validate_custom_email(body: &CustomEmailRequest) -> Result<(String, String), StatusCode> {
    let subject = body.subject.trim();
    let message = body.message.trim();

    if subject.is_empty() || message.is_empty() {
        return Err(StatusCode::BAD_REQUEST);
    }
    if subject.chars().count() > CUSTOM_EMAIL_MAX_SUBJECT
        || message.chars().count() > CUSTOM_EMAIL_MAX_MESSAGE
    {
        return Err(StatusCode::BAD_REQUEST);
    }

    Ok((subject.to_string(), message.to_string()))
}

fn custom_email_vars(name: &str, subject: &str, message: &str) -> TemplateVars {
    TemplateVars::new()
        .with("name", name)
        .with("subject", subject)
        .with("message", message)
}

fn custom_message_template(role: &str) -> &'static str {
    if role == "student" {
        "student_custom_message"
    } else {
        "teacher_custom_message"
    }
}

pub async fn preview_custom_email(
    State(state): State<AppState>,
    auth: AuthenticatedUser,
    Path(id): Path<Uuid>,
    Json(body): Json<CustomEmailRequest>,
) -> Result<Json<CustomEmailPreviewResponse>, StatusCode> {
    require_admin(&auth)?;

    let target = load_custom_email_target(&state.db, id).await?;
    let (subject, message) = validate_custom_email(&body)?;
    let locale = resolve_sender_locale(&state.db, auth.id, body.locale.as_deref()).await?;
    let vars = custom_email_vars(&target.name, &subject, &message);
    let rendered = render(
        custom_message_template(&target.role),
        &locale,
        &vars,
    );

    Ok(Json(CustomEmailPreviewResponse {
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
    }))
}

pub async fn send_custom_email(
    State(state): State<AppState>,
    auth: AuthenticatedUser,
    Path(id): Path<Uuid>,
    Json(body): Json<CustomEmailRequest>,
) -> Result<Json<SendCustomEmailResponse>, StatusCode> {
    require_admin(&auth)?;

    let target = load_custom_email_target(&state.db, id).await?;
    let (subject, message) = validate_custom_email(&body)?;
    let locale = resolve_sender_locale(&state.db, auth.id, body.locale.as_deref()).await?;
    let vars = custom_email_vars(&target.name, &subject, &message);
    let template_key = custom_message_template(&target.role);

    enqueue(
        &state.db,
        &state.config,
        template_key,
        &locale,
        &target.email,
        Some(id),
        vars,
    )
    .await
    .map_err(|e| {
        tracing::error!(
            error = %e,
            user_id = %id,
            template_key = %template_key,
            "failed to enqueue custom message"
        );
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    Ok(Json(SendCustomEmailResponse { queued: true }))
}
