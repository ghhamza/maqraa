// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

use axum::{extract::State, http::StatusCode, Json};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::api::demographics::{validate_demographics, DemographicsInput};
use crate::api::extractors::AuthenticatedUser;
use crate::api::handlers::share::try_attribute_instance_registration;
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
use crate::timezone::validate_iana_timezone;

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
    #[serde(default)]
    pub share_token: Option<String>,
    #[serde(default)]
    pub gender: Option<String>,
    #[serde(default)]
    pub birth_year: Option<i16>,
    #[serde(default)]
    pub country_code: Option<String>,
    #[serde(default)]
    pub timezone: Option<String>,
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

fn optional_valid_timezone(tz: Option<&str>) -> Option<String> {
    tz.and_then(|s| validate_iana_timezone(s.trim()).map(|v| v.to_string()))
}

#[derive(Deserialize)]
pub struct LoginRequest {
    pub email: String,
    pub password: String,
    #[serde(default)]
    pub timezone: Option<String>,
}

#[derive(Serialize)]
pub struct AuthResponse {
    pub token: String,
    pub user: UserResponse,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub is_new: Option<bool>,
}

#[derive(Serialize)]
pub struct AuthErrorBody {
    pub error: &'static str,
}

#[derive(Serialize)]
pub struct PublicConfigResponse {
    pub google_client_id: Option<String>,
}

pub async fn public_config(State(state): State<AppState>) -> Json<PublicConfigResponse> {
    Json(PublicConfigResponse {
        google_client_id: state.config.google_client_id.clone(),
    })
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

    let demo = validate_demographics(&DemographicsInput {
        gender: req.gender.clone(),
        birth_year: req.birth_year,
        country_code: req.country_code.clone(),
    })
    .map_err(|_| StatusCode::BAD_REQUEST)?;

    let hash = password::hash_password(&req.password).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    let user_id = Uuid::new_v4();
    let locale = normalize_locale(&req.locale);
    let timezone = optional_valid_timezone(req.timezone.as_deref());

    sqlx::query(
        "INSERT INTO users (id, name, email, password_hash, role, preferred_language, \
         gender, birth_year, country_code, country, timezone) \
         VALUES ($1, $2, $3, $4, $5::user_role, $6, $7, $8, $9, $9, $10)",
    )
    .bind(user_id)
    .bind(&req.name)
    .bind(&email)
    .bind(&hash)
    .bind(role)
    .bind(locale)
    .bind(&demo.gender)
    .bind(demo.birth_year)
    .bind(&demo.country_code)
    .bind(&timezone)
    .execute(&state.db)
    .await
    .map_err(|_| StatusCode::CONFLICT)?;

    try_attribute_instance_registration(&state.db, req.share_token.as_deref()).await;

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

    crate::services::product_events::track(
        &state.db,
        "user_registered",
        Some(user_id),
        Some(role),
        serde_json::json!({ "method": "password" }),
    )
    .await;

    Ok(Json(AuthResponse {
        token,
        user,
        is_new: None,
    }))
}

pub async fn login(
    State(state): State<AppState>,
    Json(req): Json<LoginRequest>,
) -> Result<Json<AuthResponse>, (StatusCode, Json<AuthErrorBody>)> {
    let email = req.email.trim().to_lowercase();
    if email.is_empty() {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(AuthErrorBody {
                error: "bad_request",
            }),
        ));
    }

    let row: (Uuid, String, String, Option<String>, String, Option<String>) = sqlx::query_as(
        "SELECT id, name, email, password_hash, role::text, timezone \
         FROM users WHERE lower(trim(email)) = $1",
    )
    .bind(&email)
    .fetch_one(&state.db)
    .await
    .map_err(|_| {
        (
            StatusCode::UNAUTHORIZED,
            Json(AuthErrorBody {
                error: "unauthorized",
            }),
        )
    })?;

    let Some(ref hash) = row.3 else {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(AuthErrorBody {
                error: "use_google_login",
            }),
        ));
    };

    if !password::verify_password(&req.password, hash).unwrap_or(false) {
        return Err((
            StatusCode::UNAUTHORIZED,
            Json(AuthErrorBody {
                error: "unauthorized",
            }),
        ));
    }

    let token = jwt::create_token(row.0, &row.4, &state.config.jwt_secret).map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(AuthErrorBody {
                error: "server_error",
            }),
        )
    })?;

    let _ = sqlx::query(
        "UPDATE users SET prev_seen_at = last_seen_at, last_seen_at = NOW() WHERE id = $1",
    )
    .bind(row.0)
    .execute(&state.db)
    .await;

    if row.5.is_none() {
        if let Some(tz) = optional_valid_timezone(req.timezone.as_deref()) {
            let _ = sqlx::query(
                "UPDATE users SET timezone = $1 WHERE id = $2 AND timezone IS NULL",
            )
            .bind(&tz)
            .bind(row.0)
            .execute(&state.db)
            .await;
        }
    }

    let user = load_user_response(&state.db, row.0).await.map_err(|_| {
        (
            StatusCode::UNAUTHORIZED,
            Json(AuthErrorBody {
                error: "unauthorized",
            }),
        )
    })?;

    Ok(Json(AuthResponse {
        token,
        user,
        is_new: None,
    }))
}

#[derive(Deserialize)]
pub struct GoogleAuthRequest {
    pub credential: String,
    #[serde(default)]
    pub role: Option<String>,
    #[serde(default)]
    pub gender: Option<String>,
    #[serde(default)]
    pub birth_year: Option<i16>,
    #[serde(default)]
    pub country_code: Option<String>,
    #[serde(default)]
    pub timezone: Option<String>,
}

pub async fn google_auth(
    State(state): State<AppState>,
    Json(req): Json<GoogleAuthRequest>,
) -> Result<Json<AuthResponse>, (StatusCode, Json<AuthErrorBody>)> {
    let Some(verifier) = state.google.as_ref() else {
        return Err((
            StatusCode::NOT_FOUND,
            Json(AuthErrorBody {
                error: "not_found",
            }),
        ));
    };

    let credential = req.credential.trim();
    if credential.is_empty() {
        return Err((
            StatusCode::UNAUTHORIZED,
            Json(AuthErrorBody {
                error: "invalid_google_token",
            }),
        ));
    }

    let identity = verifier.verify_id_token(credential).await.map_err(|e| {
        tracing::debug!(error = %e, "google token verification failed");
        (
            StatusCode::UNAUTHORIZED,
            Json(AuthErrorBody {
                error: "invalid_google_token",
            }),
        )
    })?;

    let mut tx = state.db.begin().await.map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(AuthErrorBody {
                error: "server_error",
            }),
        )
    })?;

    // 1) Existing Google-linked user
    let by_sub: Option<(Uuid, String, Option<String>)> = sqlx::query_as(
        "SELECT id, role::text, timezone FROM users WHERE google_sub = $1",
    )
    .bind(&identity.sub)
    .fetch_optional(&mut *tx)
    .await
    .map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(AuthErrorBody {
                error: "server_error",
            }),
        )
    })?;

    let client_tz = optional_valid_timezone(req.timezone.as_deref());

    let (user_id, role, is_new) = if let Some((id, role, existing_tz)) = by_sub {
        if existing_tz.is_none() {
            if let Some(ref tz) = client_tz {
                let _ = sqlx::query(
                    "UPDATE users SET timezone = $1 WHERE id = $2 AND timezone IS NULL",
                )
                .bind(tz)
                .bind(id)
                .execute(&mut *tx)
                .await;
            }
        }
        (id, role, false)
    } else {
        // 2) Link by email
        let by_email: Option<(Uuid, String, Option<String>)> = sqlx::query_as(
            "SELECT id, role::text, timezone FROM users WHERE lower(trim(email)) = $1",
        )
        .bind(&identity.email)
        .fetch_optional(&mut *tx)
        .await
        .map_err(|_| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(AuthErrorBody {
                    error: "server_error",
                }),
            )
        })?;

        if let Some((id, role, existing_tz)) = by_email {
            sqlx::query(
                "UPDATE users SET google_sub = $1, \
                 email_verified_at = COALESCE(email_verified_at, NOW()), \
                 timezone = CASE WHEN timezone IS NULL THEN $3 ELSE timezone END \
                 WHERE id = $2",
            )
            .bind(&identity.sub)
            .bind(id)
            .bind(&client_tz)
            .execute(&mut *tx)
            .await
            .map_err(|_| {
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(AuthErrorBody {
                        error: "server_error",
                    }),
                )
            })?;
            let _ = existing_tz; // timezone set via CASE above when null
            (id, role, false)
        } else {
            // 3) Create new user — role required
            let role = match req.role.as_deref().map(str::trim) {
                None | Some("") => {
                    return Err((
                        StatusCode::BAD_REQUEST,
                        Json(AuthErrorBody {
                            error: "role_required",
                        }),
                    ));
                }
                Some("admin") => {
                    return Err((
                        StatusCode::BAD_REQUEST,
                        Json(AuthErrorBody {
                            error: "invalid_role",
                        }),
                    ));
                }
                Some("student") | Some("teacher") => req.role.as_deref().unwrap().trim(),
                Some(_) => {
                    return Err((
                        StatusCode::BAD_REQUEST,
                        Json(AuthErrorBody {
                            error: "invalid_role",
                        }),
                    ));
                }
            };

            let demo = validate_demographics(&DemographicsInput {
                gender: req.gender.clone(),
                birth_year: req.birth_year,
                country_code: req.country_code.clone(),
            })
            .map_err(|_| {
                (
                    StatusCode::BAD_REQUEST,
                    Json(AuthErrorBody {
                        error: "invalid_demographics",
                    }),
                )
            })?;

            let user_id = Uuid::new_v4();
            sqlx::query(
                "INSERT INTO users (id, name, email, password_hash, role, google_sub, email_verified_at, \
                 gender, birth_year, country_code, country, timezone) \
                 VALUES ($1, $2, $3, NULL, $4::user_role, $5, NOW(), $6, $7, $8, $8, $9)",
            )
            .bind(user_id)
            .bind(&identity.name)
            .bind(&identity.email)
            .bind(role)
            .bind(&identity.sub)
            .bind(&demo.gender)
            .bind(demo.birth_year)
            .bind(&demo.country_code)
            .bind(&client_tz)
            .execute(&mut *tx)
            .await
            .map_err(|e| {
                tracing::warn!(error = %e, "google signup insert failed");
                (
                    StatusCode::CONFLICT,
                    Json(AuthErrorBody {
                        error: "conflict",
                    }),
                )
            })?;
            (user_id, role.to_string(), true)
        }
    };

    let _ = sqlx::query(
        "UPDATE users SET prev_seen_at = last_seen_at, last_seen_at = NOW() WHERE id = $1",
    )
    .bind(user_id)
    .execute(&mut *tx)
    .await;

    tx.commit().await.map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(AuthErrorBody {
                error: "server_error",
            }),
        )
    })?;

    let token = jwt::create_token(user_id, &role, &state.config.jwt_secret).map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(AuthErrorBody {
                error: "server_error",
            }),
        )
    })?;

    let user = load_user_response(&state.db, user_id).await.map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(AuthErrorBody {
                error: "server_error",
            }),
        )
    })?;

    if is_new {
        crate::services::product_events::track(
            &state.db,
            "user_registered",
            Some(user_id),
            Some(role.as_str()),
            serde_json::json!({ "method": "google" }),
        )
        .await;
    }

    Ok(Json(AuthResponse {
        token,
        user,
        is_new: if is_new { Some(true) } else { None },
    }))
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
    #[serde(default)]
    pub timezone: Option<String>,
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

    let timezone = match req.timezone.as_deref() {
        None => None,
        Some(s) if s.trim().is_empty() => None,
        Some(s) => Some(validate_iana_timezone(s.trim()).ok_or(StatusCode::BAD_REQUEST)?.to_string()),
    };

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

    sqlx::query(
        "UPDATE users SET name = $1, email = $2, \
         timezone = CASE WHEN $4::text IS NOT NULL THEN $4 ELSE timezone END \
         WHERE id = $3",
    )
    .bind(name)
    .bind(&email)
    .bind(auth.id)
    .bind(&timezone)
    .execute(&state.db)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    load_user_response(&state.db, auth.id)
        .await
        .map(Json)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)
}

#[derive(Deserialize)]
pub struct UpdateAuthProfileRequest {
    pub name: String,
    #[serde(default)]
    pub gender: Option<String>,
    #[serde(default)]
    pub birth_year: Option<i16>,
    #[serde(default)]
    pub country_code: Option<String>,
    #[serde(default)]
    pub timezone: Option<String>,
}

/// `PUT /api/auth/profile` — update display name + optional soft demographics.
pub async fn update_auth_profile(
    State(state): State<AppState>,
    auth: AuthenticatedUser,
    Json(req): Json<UpdateAuthProfileRequest>,
) -> Result<Json<UserResponse>, StatusCode> {
    let name = req.name.trim();
    if name.is_empty() {
        return Err(StatusCode::BAD_REQUEST);
    }

    let demo = validate_demographics(&DemographicsInput {
        gender: req.gender,
        birth_year: req.birth_year,
        country_code: req.country_code,
    })?;

    let timezone = match req.timezone.as_deref() {
        None => None,
        Some(s) if s.trim().is_empty() => None,
        Some(s) => Some(validate_iana_timezone(s.trim()).ok_or(StatusCode::BAD_REQUEST)?.to_string()),
    };

    sqlx::query(
        "UPDATE users SET name = $1, gender = $2, birth_year = $3, country_code = $4, \
         country = CASE WHEN $4::char(2) IS NOT NULL THEN $4 ELSE country END, \
         timezone = CASE WHEN $6::text IS NOT NULL THEN $6 ELSE timezone END \
         WHERE id = $5",
    )
    .bind(name)
    .bind(&demo.gender)
    .bind(demo.birth_year)
    .bind(&demo.country_code)
    .bind(auth.id)
    .bind(&timezone)
    .execute(&state.db)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    load_user_response(&state.db, auth.id)
        .await
        .map(Json)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)
}

#[derive(Deserialize)]
pub struct ChangePasswordRequest {
    #[serde(default)]
    pub current_password: Option<String>,
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

    let hash: Option<String> = sqlx::query_scalar("SELECT password_hash FROM users WHERE id = $1")
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

    if let Some(ref existing) = hash {
        let current = req.current_password.as_deref().unwrap_or("");
        if !password::verify_password(current, existing).unwrap_or(false) {
            // Use 400 (not 401) so the client does not clear the session / redirect to login.
            return Err((
                StatusCode::BAD_REQUEST,
                Json(ApiMessage {
                    message: "كلمة المرور الحالية غير صحيحة",
                    code: "wrong_password",
                }),
            ));
        }
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
