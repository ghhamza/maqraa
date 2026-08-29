// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

use axum::{extract::State, http::StatusCode, Json};
use chrono::{NaiveDate, Datelike};
use serde::Deserialize;

use crate::api::extractors::AuthenticatedUser;
use crate::api::handlers::auth::ApiMessage;
use crate::api::profile_constants::{is_valid_qiraat_slug, is_valid_spoken_language};
use crate::api::types::UserResponse;
use crate::api::user_response::load_user_response;
use crate::api::AppState;
use crate::timezone::validate_iana_timezone;

#[derive(Deserialize)]
pub struct CompleteProfileRequest {
    pub gender: String,
    /// Preferred: year of birth only.
    #[serde(default)]
    pub birth_year: Option<i16>,
    /// Legacy full date — year is extracted when `birth_year` is absent.
    #[serde(default)]
    pub date_of_birth: Option<String>,
    pub country: String,
    pub phone: String,
    pub spoken_languages: Vec<String>,
    #[serde(default)]
    pub qiraat_taught: Vec<String>,
    #[serde(default)]
    pub timezone: Option<String>,
}

fn profile_err(code: &'static str, message: &'static str) -> (StatusCode, Json<ApiMessage>) {
    (
        StatusCode::BAD_REQUEST,
        Json(ApiMessage { message, code }),
    )
}

fn validate_phone(phone: &str) -> bool {
    if !phone.starts_with('+') {
        return false;
    }
    let digits: usize = phone.chars().filter(|c| c.is_ascii_digit()).count();
    (8..=16).contains(&digits)
}

fn parse_birth_year(year: i16) -> Result<i16, (StatusCode, Json<ApiMessage>)> {
    let current_year = chrono::Utc::now().year() as i16;
    if year < 1920 || year > current_year {
        return Err(profile_err("invalid_birth_year", "Invalid year of birth"));
    }
    Ok(year)
}

fn resolve_birth_year(req: &CompleteProfileRequest) -> Result<i16, (StatusCode, Json<ApiMessage>)> {
    if let Some(y) = req.birth_year {
        return parse_birth_year(y);
    }
    if let Some(raw) = req.date_of_birth.as_deref() {
        let dob = NaiveDate::parse_from_str(raw.trim(), "%Y-%m-%d")
            .map_err(|_| profile_err("invalid_birth_year", "Invalid year of birth"))?;
        return parse_birth_year(dob.year() as i16);
    }
    Err(profile_err("invalid_birth_year", "Year of birth is required"))
}

pub async fn complete_profile(
    State(state): State<AppState>,
    auth: AuthenticatedUser,
    Json(req): Json<CompleteProfileRequest>,
) -> Result<Json<UserResponse>, (StatusCode, Json<ApiMessage>)> {
    let gender = req.gender.trim();
    if gender != "male" && gender != "female" {
        return Err(profile_err("invalid_gender", "Invalid gender"));
    }

    let birth_year = resolve_birth_year(&req)?;

    let country = req.country.trim().to_uppercase();
    if country.len() != 2 || !country.chars().all(|c| c.is_ascii_alphabetic()) {
        return Err(profile_err("invalid_country", "Invalid country"));
    }

    let phone = req.phone.trim();
    if phone.is_empty() || !validate_phone(phone) {
        return Err(profile_err("invalid_phone", "Invalid phone"));
    }

    if req.spoken_languages.is_empty() {
        return Err(profile_err("languages_required", "Select at least one language"));
    }
    for lang in &req.spoken_languages {
        if !is_valid_spoken_language(lang) {
            return Err(profile_err("invalid_language", "Invalid language"));
        }
    }

    let qiraat_taught = if auth.role == "teacher" {
        if req.qiraat_taught.is_empty() {
            return Err(profile_err("qiraat_required", "Select at least one qira'a"));
        }
        for slug in &req.qiraat_taught {
            if !is_valid_qiraat_slug(slug) {
                return Err(profile_err("invalid_qiraat", "Invalid qira'a"));
            }
        }
        req.qiraat_taught.clone()
    } else {
        Vec::new()
    };

    let timezone = match req.timezone.as_deref() {
        None => None,
        Some(s) if s.trim().is_empty() => None,
        Some(s) => Some(
            validate_iana_timezone(s.trim())
                .ok_or_else(|| profile_err("invalid_timezone", "Invalid timezone"))?
                .to_string(),
        ),
    };

    sqlx::query(
        "UPDATE users SET gender = $1, birth_year = $2, date_of_birth = NULL, country = $3, phone = $4, \
         spoken_languages = $5, qiraat_taught = $6, profile_completion_pending = false, \
         country_code = $3, \
         timezone = CASE WHEN $8::text IS NOT NULL THEN $8 ELSE timezone END \
         WHERE id = $7",
    )
    .bind(gender)
    .bind(birth_year)
    .bind(&country)
    .bind(phone)
    .bind(&req.spoken_languages)
    .bind(&qiraat_taught)
    .bind(auth.id)
    .bind(&timezone)
    .execute(&state.db)
    .await
    .map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ApiMessage {
                message: "Server error",
                code: "server_error",
            }),
        )
    })?;

    crate::services::product_events::track(
        &state.db,
        "profile_completed",
        Some(auth.id),
        Some(auth.role.as_str()),
        serde_json::json!({}),
    )
    .await;

    load_user_response(&state.db, auth.id)
        .await
        .map(Json)
        .map_err(|_| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ApiMessage {
                    message: "Server error",
                    code: "server_error",
                }),
            )
        })
}
