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
    qf_email: Option<String>,
    role_selection_pending: bool,
    profile_completion_pending: bool,
    gender: Option<String>,
    date_of_birth: Option<NaiveDate>,
    country: Option<String>,
    phone: Option<String>,
    spoken_languages: Vec<String>,
    qiraat_taught: Vec<String>,
    email_verified_at: Option<DateTime<Utc>>,
    preferred_language: String,
}

pub async fn load_user_response(db: &PgPool, user_id: Uuid) -> Result<UserResponse, sqlx::Error> {
    let row = sqlx::query_as::<_, UserProfileRow>(
        "SELECT u.id, u.name, u.email, u.role::text, qa.qf_email, u.role_selection_pending, \
         u.profile_completion_pending, u.gender, u.date_of_birth, u.country, u.phone, \
         u.spoken_languages, u.qiraat_taught, u.email_verified_at, u.preferred_language \
         FROM users u \
         LEFT JOIN qf_accounts qa ON qa.user_id = u.id \
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
        qf_linked: row.qf_email.is_some(),
        qf_email: row.qf_email,
        role_selection_pending: row.role_selection_pending,
        profile_completion_pending: row.profile_completion_pending,
        gender: row.gender,
        date_of_birth: row.date_of_birth,
        country: row.country,
        phone: row.phone,
        spoken_languages: row.spoken_languages,
        qiraat_taught: row.qiraat_taught,
        email_verified: row.email_verified_at.is_some(),
        preferred_language: row.preferred_language,
    })
}

#[derive(sqlx::FromRow)]
struct UserAdminRow {
    id: Uuid,
    name: String,
    email: String,
    role: String,
    created_at: DateTime<Utc>,
    qf_email: Option<String>,
    role_selection_pending: bool,
    profile_completion_pending: bool,
    gender: Option<String>,
    date_of_birth: Option<NaiveDate>,
    country: Option<String>,
    phone: Option<String>,
    spoken_languages: Vec<String>,
    qiraat_taught: Vec<String>,
}

pub async fn load_user_admin_detail(db: &PgPool, user_id: Uuid) -> Result<UserAdminDetail, sqlx::Error> {
    let row = sqlx::query_as::<_, UserAdminRow>(
        "SELECT u.id, u.name, u.email, u.role::text AS role, u.created_at, qa.qf_email, \
         u.role_selection_pending, u.profile_completion_pending, u.gender, u.date_of_birth, \
         u.country, u.phone, u.spoken_languages, u.qiraat_taught \
         FROM users u \
         LEFT JOIN qf_accounts qa ON qa.user_id = u.id \
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
        qf_linked: row.qf_email.is_some(),
        qf_email: row.qf_email,
        role_selection_pending: row.role_selection_pending,
        profile_completion_pending: row.profile_completion_pending,
        gender: row.gender,
        date_of_birth: row.date_of_birth,
        country: row.country,
        phone: row.phone,
        spoken_languages: row.spoken_languages,
        qiraat_taught: row.qiraat_taught,
    })
}
