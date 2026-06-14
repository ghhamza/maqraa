// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

use axum::{extract::State, http::StatusCode, Json};
use chrono::{NaiveDate, Utc};
use serde::Deserialize;

use crate::api::extractors::AuthenticatedUser;
use crate::api::handlers::auth::ApiMessage;
use crate::api::profile_constants::{is_valid_qiraat_slug, is_valid_spoken_language};
use crate::api::types::UserResponse;
use crate::api::user_response::load_user_response;
use crate::api::AppState;

#[derive(Deserialize)]
pub struct CompleteProfileRequest {
    pub gender: String,
    pub date_of_birth: String,
    pub country: String,
    pub phone: String,
    pub spoken_languages: Vec<String>,
    #[serde(default)]
    pub qiraat_taught: Vec<String>,
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

fn parse_date_of_birth(raw: &str) -> Result<NaiveDate, (StatusCode, Json<ApiMessage>)> {
    let dob = NaiveDate::parse_from_str(raw.trim(), "%Y-%m-%d")
        .map_err(|_| profile_err("invalid_date_of_birth", "Invalid date of birth"))?;
    let min = NaiveDate::from_ymd_opt(1900, 1, 1)
        .ok_or_else(|| profile_err("invalid_date_of_birth", "Invalid date of birth"))?;
    if dob < min {
        return Err(profile_err("invalid_date_of_birth", "Invalid date of birth"));
    }
    if dob > Utc::now().date_naive() {
        return Err(profile_err("invalid_date_of_birth", "Invalid date of birth"));
    }
    Ok(dob)
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

    let dob = parse_date_of_birth(&req.date_of_birth)?;

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

    sqlx::query(
        "UPDATE users SET gender = $1, date_of_birth = $2, country = $3, phone = $4, \
         spoken_languages = $5, qiraat_taught = $6, profile_completion_pending = false \
         WHERE id = $7",
    )
    .bind(gender)
    .bind(dob)
    .bind(&country)
    .bind(phone)
    .bind(&req.spoken_languages)
    .bind(&qiraat_taught)
    .bind(auth.id)
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
