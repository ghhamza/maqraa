// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

use axum::{extract::State, http::StatusCode, Json};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::api::extractors::AuthenticatedUser;
use crate::api::types::{MeResponse, UserResponse};
use crate::api::user_response::load_user_response;
use crate::entitlements::EntitlementContext;
use crate::api::AppState;
use crate::auth::{
    create_reset_token, create_verification_token, consume_reset_token, consume_verification_token,
    invalidate_reset_tokens, invalidate_verification_tokens, recent_verification_token_exists,
    jwt, password,
};
use crate::notifications::{enqueue, TemplateVars};

#[derive(Serialize)]
pub struct ApiMessage {
    pub message: &'static str,
    pub code: &'static str,
}

#[derive(Deserialize)]
pub struct RegisterRequest {
    pub name: String,
    pub email: String,
    pub password: String,
    pub role: String,
    #[serde(default = "default_locale")]
    pub locale: String,
}

fn default_locale() -> String {
    "ar".to_string()
}

fn normalize_locale(locale: &str) -> &str {
    match locale {
        "ar" | "en" | "fr" => locale,
        _ => "ar",
    }
}

#[derive(Deserialize)]
pub struct LoginRequest {
    pub email: String,
    pub password: String,
}

#[derive(Serialize)]
pub struct AuthResponse {
    pub token: String,
    pub user: UserResponse,
}

pub async fn register(
    State(state): State<AppState>,
    Json(req): Json<RegisterRequest>,
) -> Result<Json<AuthResponse>, StatusCode> {
    let role = match req.role.as_str() {
        "student" | "teacher" => req.role.as_str(),
        _ => return Err(StatusCode::BAD_REQUEST),
    };

    let email = req.email.trim().to_lowercase();
    if email.is_empty() {
        return Err(StatusCode::BAD_REQUEST);
    }

    if req.password.len() < 8 {
        return Err(StatusCode::BAD_REQUEST);
    }

    let hash = password::hash_password(&req.password).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    let user_id = Uuid::new_v4();
    let locale = normalize_locale(&req.locale);

    sqlx::query(
        "INSERT INTO users (id, name, email, password_hash, role, preferred_language) \
         VALUES ($1, $2, $3, $4, $5::user_role, $6)",
    )
    .bind(user_id)
    .bind(&req.name)
    .bind(&email)
    .bind(&hash)
    .bind(role)
    .bind(locale)
    .execute(&state.db)
    .await
    .map_err(|_| StatusCode::CONFLICT)?;

    let verify_token = create_verification_token(&state.db, user_id)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let verify_url = format!(
        "{}/verify-email/{verify_token}",
        state.config.app_base_url.trim_end_matches('/')
    );
    let vars = TemplateVars::new()
        .with("name", req.name.trim())
        .with("verify_url", verify_url);
    if let Err(e) = enqueue(
        &state.db,
        &state.config,
        "welcome_verify",
        locale,
        &email,
        Some(user_id),
        vars,
    )
    .await
    {
        tracing::error!(error = %e, user_id = %user_id, "failed to enqueue welcome email");
    }

    let token = jwt::create_token(user_id, role, &state.config.jwt_secret)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let user = load_user_response(&state.db, user_id)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(AuthResponse { token, user }))
}

pub async fn login(
    State(state): State<AppState>,
    Json(req): Json<LoginRequest>,
) -> Result<Json<AuthResponse>, StatusCode> {
    let email = req.email.trim().to_lowercase();
    if email.is_empty() {
        return Err(StatusCode::BAD_REQUEST);
    }

    let row: (Uuid, String, String, String, String, bool) = sqlx::query_as(
        "SELECT id, name, email, password_hash, role::text, role_selection_pending \
         FROM users WHERE lower(trim(email)) = $1",
    )
    .bind(&email)
    .fetch_one(&state.db)
    .await
    .map_err(|_| StatusCode::UNAUTHORIZED)?;

    if !password::verify_password(&req.password, &row.3).unwrap_or(false) {
        return Err(StatusCode::UNAUTHORIZED);
    }

    let token = jwt::create_token(row.0, &row.4, &state.config.jwt_secret)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let _ = sqlx::query(
        "UPDATE users SET prev_seen_at = last_seen_at, last_seen_at = NOW() WHERE id = $1",
    )
    .bind(row.0)
    .execute(&state.db)
    .await;

    let user = load_user_response(&state.db, row.0)
        .await
        .map_err(|_| StatusCode::UNAUTHORIZED)?;

    Ok(Json(AuthResponse { token, user }))
}

#[derive(Serialize)]
pub struct WhatsNewResponse {
    pub since: Option<DateTime<Utc>>,
    pub new_recitations: i64,
    pub new_enrollments: i64,
    pub completed_sessions: i64,
    pub pending_requests: i64,
}

pub async fn whats_new(
    State(state): State<AppState>,
    auth: AuthenticatedUser,
) -> Result<Json<WhatsNewResponse>, StatusCode> {
    let prev: Option<DateTime<Utc>> = sqlx::query_scalar("SELECT prev_seen_at FROM users WHERE id = $1")
        .bind(auth.id)
        .fetch_one(&state.db)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let Some(since) = prev else {
        return Ok(Json(WhatsNewResponse {
            since: None,
            new_recitations: 0,
            new_enrollments: 0,
            completed_sessions: 0,
            pending_requests: 0,
        }));
    };

    let (recitations, enrollments, sessions_completed, pending) = match auth.role.as_str() {
        "teacher" => {
            let r: i64 = sqlx::query_scalar(
                "SELECT COUNT(*)::bigint FROM recitations WHERE teacher_id = $1 AND created_at > $2",
            )
            .bind(auth.id)
            .bind(since)
            .fetch_one(&state.db)
            .await
            .unwrap_or(0);
            let e: i64 = sqlx::query_scalar(
                "SELECT COUNT(*)::bigint FROM enrollments e JOIN rooms r ON r.id = e.room_id \
                 WHERE r.teacher_id = $1 AND e.enrolled_at > $2 AND e.status = 'approved'",
            )
            .bind(auth.id)
            .bind(since)
            .fetch_one(&state.db)
            .await
            .unwrap_or(0);
            let s: i64 = sqlx::query_scalar(
                "SELECT COUNT(*)::bigint FROM sessions WHERE room_id IN (SELECT id FROM rooms WHERE teacher_id = $1) \
                 AND status::text = 'completed' AND scheduled_at > $2",
            )
            .bind(auth.id)
            .bind(since)
            .fetch_one(&state.db)
            .await
            .unwrap_or(0);
            let p: i64 = sqlx::query_scalar(
                "SELECT COUNT(*)::bigint FROM enrollments e JOIN rooms r ON r.id = e.room_id \
                 WHERE r.teacher_id = $1 AND e.enrolled_at > $2 AND e.status = 'pending'",
            )
            .bind(auth.id)
            .bind(since)
            .fetch_one(&state.db)
            .await
            .unwrap_or(0);
            (r, e, s, p)
        }
        "student" => {
            let r: i64 = sqlx::query_scalar(
                "SELECT COUNT(*)::bigint FROM recitations WHERE student_id = $1 AND created_at > $2",
            )
            .bind(auth.id)
            .bind(since)
            .fetch_one(&state.db)
            .await
            .unwrap_or(0);
            let s: i64 = sqlx::query_scalar(
                "SELECT COUNT(*)::bigint FROM session_attendance sa JOIN sessions ses ON ses.id = sa.session_id \
                 WHERE sa.student_id = $1 AND sa.attended = true AND ses.status::text = 'completed' AND ses.scheduled_at > $2",
            )
            .bind(auth.id)
            .bind(since)
            .fetch_one(&state.db)
            .await
            .unwrap_or(0);
            (r, 0, s, 0)
        }
        _ => (0, 0, 0, 0),
    };

    Ok(Json(WhatsNewResponse {
        since: Some(since),
        new_recitations: recitations,
        new_enrollments: enrollments,
        completed_sessions: sessions_completed,
        pending_requests: pending,
    }))
}

pub async fn me(
    State(state): State<AppState>,
    auth: AuthenticatedUser,
) -> Result<Json<MeResponse>, StatusCode> {
    let user = load_user_response(&state.db, auth.id)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    let entitlements = state
        .entitlements
        .resolve(&EntitlementContext {
            user_id: auth.id,
            role: auth.role.clone(),
        })
        .await;
    Ok(Json(MeResponse {
        user,
        entitlements,
    }))
}

#[derive(Deserialize)]
pub struct UpdateProfileRequest {
    pub name: String,
    pub email: String,
}

pub async fn update_profile(
    State(state): State<AppState>,
    auth: AuthenticatedUser,
    Json(req): Json<UpdateProfileRequest>,
) -> Result<Json<UserResponse>, StatusCode> {
    let name = req.name.trim();
    let email = req.email.trim().to_lowercase();
    if name.is_empty() || email.is_empty() {
        return Err(StatusCode::BAD_REQUEST);
    }

    let existing_lower = auth.email.trim().to_lowercase();
    if email != existing_lower {
        let exists: bool = sqlx::query_scalar(
            "SELECT EXISTS(SELECT 1 FROM users WHERE lower(trim(email)) = $1 AND id <> $2)",
        )
        .bind(&email)
        .bind(auth.id)
        .fetch_one(&state.db)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
        if exists {
            return Err(StatusCode::CONFLICT);
        }
    }

    sqlx::query("UPDATE users SET name = $1, email = $2 WHERE id = $3")
        .bind(name)
        .bind(&email)
        .bind(auth.id)
        .execute(&state.db)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    load_user_response(&state.db, auth.id)
        .await
        .map(Json)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)
}

#[derive(Deserialize)]
pub struct RoleSelectionRequest {
    pub role: String,
}

pub async fn role_selection(
    State(state): State<AppState>,
    auth: AuthenticatedUser,
    Json(req): Json<RoleSelectionRequest>,
) -> Result<Json<UserResponse>, (StatusCode, Json<ApiMessage>)> {
    let pending: bool = sqlx::query_scalar("SELECT role_selection_pending FROM users WHERE id = $1")
        .bind(auth.id)
        .fetch_one(&state.db)
        .await
        .map_err(|_| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ApiMessage {
                    message: "خطأ في الخادم",
                    code: "server_error",
                }),
            )
        })?;

    if !pending {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(ApiMessage {
                message: "Role already selected",
                code: "role_already_selected",
            }),
        ));
    }

    let role = match req.role.as_str() {
        "student" | "teacher" => req.role.as_str(),
        _ => {
            return Err((
                StatusCode::BAD_REQUEST,
                Json(ApiMessage {
                    message: "Invalid role",
                    code: "invalid_role",
                }),
            ));
        }
    };

    sqlx::query("UPDATE users SET role = $1::user_role, role_selection_pending = FALSE WHERE id = $2")
        .bind(role)
        .bind(auth.id)
        .execute(&state.db)
        .await
        .map_err(|_| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ApiMessage {
                    message: "خطأ في الخادم",
                    code: "server_error",
                }),
            )
        })?;

    load_user_response(&state.db, auth.id)
        .await
        .map(Json)
        .map_err(|_| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ApiMessage {
                    message: "خطأ في الخادم",
                    code: "server_error",
                }),
            )
        })
}

#[derive(Deserialize)]
pub struct ChangePasswordRequest {
    pub current_password: String,
    pub new_password: String,
}

pub async fn change_password(
    State(state): State<AppState>,
    auth: AuthenticatedUser,
    Json(req): Json<ChangePasswordRequest>,
) -> Result<StatusCode, (StatusCode, Json<ApiMessage>)> {
    if req.new_password.len() < 8 {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(ApiMessage {
                message: "كلمة المرور قصيرة",
                code: "weak_password",
            }),
        ));
    }

    let hash: String = sqlx::query_scalar("SELECT password_hash FROM users WHERE id = $1")
        .bind(auth.id)
        .fetch_one(&state.db)
        .await
        .map_err(|_| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ApiMessage {
                    message: "خطأ في الخادم",
                    code: "server_error",
                }),
            )
        })?;

    if !password::verify_password(&req.current_password, &hash).unwrap_or(false) {
        // Use 400 (not 401) so the client does not clear the session / redirect to login.
        return Err((
            StatusCode::BAD_REQUEST,
            Json(ApiMessage {
                message: "كلمة المرور الحالية غير صحيحة",
                code: "wrong_password",
            }),
        ));
    }

    let new_hash = password::hash_password(&req.new_password).map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ApiMessage {
                message: "خطأ في الخادم",
                code: "server_error",
            }),
        )
    })?;

    sqlx::query("UPDATE users SET password_hash = $1 WHERE id = $2")
        .bind(&new_hash)
        .bind(auth.id)
        .execute(&state.db)
        .await
        .map_err(|_| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ApiMessage {
                    message: "خطأ في الخادم",
                    code: "server_error",
                }),
            )
        })?;

    Ok(StatusCode::NO_CONTENT)
}

#[derive(Serialize)]
pub struct OkResponse {
    pub ok: bool,
}

#[derive(Serialize)]
pub struct ResendVerificationResponse {
    pub ok: bool,
    /// True when a new verification email was queued (false if already verified or rate-limited).
    pub queued: bool,
}

#[derive(Deserialize)]
pub struct VerifyEmailRequest {
    pub token: String,
}

pub async fn verify_email(
    State(state): State<AppState>,
    Json(req): Json<VerifyEmailRequest>,
) -> Result<Json<OkResponse>, StatusCode> {
    let token = req.token.trim();
    if token.is_empty() {
        return Err(StatusCode::BAD_REQUEST);
    }

    let user_id = consume_verification_token(&state.db, token)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let Some(user_id) = user_id else {
        return Err(StatusCode::BAD_REQUEST);
    };

    sqlx::query("UPDATE users SET email_verified_at = NOW() WHERE id = $1")
        .bind(user_id)
        .execute(&state.db)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(OkResponse { ok: true }))
}

pub async fn resend_verification(
    State(state): State<AppState>,
    auth: AuthenticatedUser,
) -> Result<Json<ResendVerificationResponse>, StatusCode> {
    let row: (Option<DateTime<Utc>>, String, String) = sqlx::query_as(
        "SELECT email_verified_at, email, preferred_language FROM users WHERE id = $1",
    )
    .bind(auth.id)
    .fetch_one(&state.db)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    if row.0.is_some() {
        return Ok(Json(ResendVerificationResponse { ok: true, queued: false }));
    }

    if recent_verification_token_exists(&state.db, auth.id, 60)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
    {
        return Ok(Json(ResendVerificationResponse { ok: true, queued: false }));
    }

    invalidate_verification_tokens(&state.db, auth.id)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let verify_token = create_verification_token(&state.db, auth.id)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let verify_url = format!(
        "{}/verify-email/{verify_token}",
        state.config.app_base_url.trim_end_matches('/')
    );
    let vars = TemplateVars::new()
        .with("name", auth.name.clone())
        .with("verify_url", verify_url);
    if let Err(e) = enqueue(
        &state.db,
        &state.config,
        "welcome_verify",
        &row.2,
        &row.1,
        Some(auth.id),
        vars,
    )
    .await
    {
        tracing::error!(error = %e, user_id = %auth.id, "failed to enqueue verification email");
        return Err(StatusCode::INTERNAL_SERVER_ERROR);
    }

    Ok(Json(ResendVerificationResponse { ok: true, queued: true }))
}

#[derive(Deserialize)]
pub struct ForgotPasswordRequest {
    pub email: String,
    #[serde(default = "default_locale")]
    pub locale: String,
}

#[derive(Serialize)]
pub struct ForgotPasswordResponse {
    pub message: &'static str,
}

pub async fn forgot_password(
    State(state): State<AppState>,
    Json(req): Json<ForgotPasswordRequest>,
) -> Json<ForgotPasswordResponse> {
    let email = req.email.trim().to_lowercase();
    let locale = normalize_locale(&req.locale);

    if !email.is_empty() {
        let user: Option<(Uuid, String)> = sqlx::query_as(
            "SELECT id, name FROM users WHERE lower(trim(email)) = $1 AND password_hash IS NOT NULL",
        )
        .bind(&email)
        .fetch_optional(&state.db)
        .await
        .unwrap_or(None);

        if let Some((user_id, name)) = user {
            if let Ok(reset_token) = create_reset_token(&state.db, user_id).await {
                let reset_url = format!(
                    "{}/reset-password/{reset_token}",
                    state.config.app_base_url.trim_end_matches('/')
                );
                let vars = TemplateVars::new()
                    .with("name", name)
                    .with("reset_url", reset_url);
                let _ = enqueue(
                    &state.db,
                    &state.config,
                    "password_reset",
                    locale,
                    &email,
                    Some(user_id),
                    vars,
                )
                .await;
            }
        }
    }

    Json(ForgotPasswordResponse {
        message: "If an account exists for that email, a reset link has been sent.",
    })
}

#[derive(Deserialize)]
pub struct ResetPasswordRequest {
    pub token: String,
    pub new_password: String,
}

pub async fn reset_password(
    State(state): State<AppState>,
    Json(req): Json<ResetPasswordRequest>,
) -> Result<Json<OkResponse>, (StatusCode, Json<ApiMessage>)> {
    if req.new_password.len() < 8 {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(ApiMessage {
                message: "كلمة المرور قصيرة",
                code: "weak_password",
            }),
        ));
    }

    let token = req.token.trim();
    if token.is_empty() {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(ApiMessage {
                message: "Invalid token",
                code: "invalid_token",
            }),
        ));
    }

    let user_id = consume_reset_token(&state.db, token)
        .await
        .map_err(|_| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ApiMessage {
                    message: "خطأ في الخادم",
                    code: "server_error",
                }),
            )
        })?;

    let Some(user_id) = user_id else {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(ApiMessage {
                message: "Invalid or expired token",
                code: "invalid_token",
            }),
        ));
    };

    let new_hash = password::hash_password(&req.new_password).map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ApiMessage {
                message: "خطأ في الخادم",
                code: "server_error",
            }),
        )
    })?;

    sqlx::query("UPDATE users SET password_hash = $1 WHERE id = $2")
        .bind(&new_hash)
        .bind(user_id)
        .execute(&state.db)
        .await
        .map_err(|_| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ApiMessage {
                    message: "خطأ في الخادم",
                    code: "server_error",
                }),
            )
        })?;

    invalidate_reset_tokens(&state.db, user_id)
        .await
        .map_err(|_| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ApiMessage {
                    message: "خطأ في الخادم",
                    code: "server_error",
                }),
            )
        })?;

    Ok(Json(OkResponse { ok: true }))
}
