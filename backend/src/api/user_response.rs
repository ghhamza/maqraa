// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

use chrono::{DateTime, NaiveDate, Utc};
use sqlx::PgPool;
use uuid::Uuid;

use crate::api::types::{UserAdminDetail, UserResponse};

#[derive(sqlx::FromRow)]
struct UserProfileRow {
    id: Uuid,
    name: String,
    email: String,
    role: String,
    profile_completion_pending: bool,
    gender: Option<String>,
    date_of_birth: Option<NaiveDate>,
    country: Option<String>,
    birth_year: Option<i16>,
    country_code: Option<String>,
    phone: Option<String>,
    spoken_languages: Vec<String>,
    qiraat_taught: Vec<String>,
    email_verified_at: Option<DateTime<Utc>>,
    preferred_language: String,
    has_password: bool,
}

pub async fn load_user_response(db: &PgPool, user_id: Uuid) -> Result<UserResponse, sqlx::Error> {
    let row = sqlx::query_as::<_, UserProfileRow>(
        "SELECT u.id, u.name, u.email, u.role::text, \
         u.profile_completion_pending, u.gender, u.date_of_birth, u.country, \
         u.birth_year, u.country_code, u.phone, \
         u.spoken_languages, u.qiraat_taught, u.email_verified_at, u.preferred_language, \
         (u.password_hash IS NOT NULL) AS has_password \
         FROM users u \
         WHERE u.id = $1",
    )
    .bind(user_id)
    .fetch_one(db)
    .await?;

    Ok(UserResponse {
        id: row.id,
        name: row.name,
        email: row.email,
        role: row.role,
        profile_completion_pending: row.profile_completion_pending,
        gender: row.gender,
        date_of_birth: row.date_of_birth,
        country: row.country,
        birth_year: row.birth_year,
        country_code: row.country_code,
        phone: row.phone,
        spoken_languages: row.spoken_languages,
        qiraat_taught: row.qiraat_taught,
        email_verified: row.email_verified_at.is_some(),
        preferred_language: row.preferred_language,
        has_password: row.has_password,
    })
}

#[derive(sqlx::FromRow)]
struct UserAdminRow {
    id: Uuid,
    name: String,
    email: String,
    role: String,
    created_at: DateTime<Utc>,
    profile_completion_pending: bool,
    gender: Option<String>,
    date_of_birth: Option<NaiveDate>,
    country: Option<String>,
    birth_year: Option<i16>,
    country_code: Option<String>,
    phone: Option<String>,
    spoken_languages: Vec<String>,
    qiraat_taught: Vec<String>,
}

pub async fn load_user_admin_detail(db: &PgPool, user_id: Uuid) -> Result<UserAdminDetail, sqlx::Error> {
    let row = sqlx::query_as::<_, UserAdminRow>(
        "SELECT u.id, u.name, u.email, u.role::text AS role, u.created_at, \
         u.profile_completion_pending, u.gender, u.date_of_birth, \
         u.country, u.birth_year, u.country_code, u.phone, u.spoken_languages, u.qiraat_taught \
         FROM users u \
         WHERE u.id = $1",
    )
    .bind(user_id)
    .fetch_one(db)
    .await?;

    Ok(UserAdminDetail {
        id: row.id,
        name: row.name,
        email: row.email,
        role: row.role,
        created_at: row.created_at,
        profile_completion_pending: row.profile_completion_pending,
        gender: row.gender,
        date_of_birth: row.date_of_birth,
        country: row.country,
        birth_year: row.birth_year,
        country_code: row.country_code,
        phone: row.phone,
        spoken_languages: row.spoken_languages,
        qiraat_taught: row.qiraat_taught,
    })
}
