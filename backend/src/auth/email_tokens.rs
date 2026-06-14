// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

use chrono::{Duration, Utc};
use sqlx::PgPool;
use uuid::Uuid;

pub fn generate_token() -> String {
    format!("{}{}", Uuid::new_v4().simple(), Uuid::new_v4().simple())
}

pub async fn create_verification_token(pool: &PgPool, user_id: Uuid) -> Result<String, sqlx::Error> {
    let token = generate_token();
    let expires_at = Utc::now() + Duration::hours(24);

    sqlx::query(
        "INSERT INTO email_verification_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)",
    )
    .bind(user_id)
    .bind(&token)
    .bind(expires_at)
    .execute(pool)
    .await?;

    Ok(token)
}

pub async fn invalidate_verification_tokens(pool: &PgPool, user_id: Uuid) -> Result<(), sqlx::Error> {
    sqlx::query(
        "UPDATE email_verification_tokens SET consumed_at = NOW() \
         WHERE user_id = $1 AND consumed_at IS NULL",
    )
    .bind(user_id)
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn recent_verification_token_exists(
    pool: &PgPool,
    user_id: Uuid,
    within_secs: i64,
) -> Result<bool, sqlx::Error> {
    let exists: bool = sqlx::query_scalar(
        "SELECT EXISTS( \
             SELECT 1 FROM email_verification_tokens \
             WHERE user_id = $1 AND consumed_at IS NULL \
             AND created_at > NOW() - ($2 || ' seconds')::interval \
         )",
    )
    .bind(user_id)
    .bind(within_secs)
    .fetch_one(pool)
    .await?;
    Ok(exists)
}

pub async fn consume_verification_token(
    pool: &PgPool,
    token: &str,
) -> Result<Option<Uuid>, sqlx::Error> {
    let row: Option<(Uuid,)> = sqlx::query_as(
        "UPDATE email_verification_tokens SET consumed_at = NOW() \
         WHERE token = $1 AND consumed_at IS NULL AND expires_at > NOW() \
         RETURNING user_id",
    )
    .bind(token)
    .fetch_optional(pool)
    .await?;

    Ok(row.map(|r| r.0))
}

pub async fn create_reset_token(pool: &PgPool, user_id: Uuid) -> Result<String, sqlx::Error> {
    let token = generate_token();
    let expires_at = Utc::now() + Duration::hours(1);

    sqlx::query(
        "INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)",
    )
    .bind(user_id)
    .bind(&token)
    .bind(expires_at)
    .execute(pool)
    .await?;

    Ok(token)
}

pub async fn invalidate_reset_tokens(pool: &PgPool, user_id: Uuid) -> Result<(), sqlx::Error> {
    sqlx::query(
        "UPDATE password_reset_tokens SET consumed_at = NOW() \
         WHERE user_id = $1 AND consumed_at IS NULL",
    )
    .bind(user_id)
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn consume_reset_token(pool: &PgPool, token: &str) -> Result<Option<Uuid>, sqlx::Error> {
    let row: Option<(Uuid,)> = sqlx::query_as(
        "UPDATE password_reset_tokens SET consumed_at = NOW() \
         WHERE token = $1 AND consumed_at IS NULL AND expires_at > NOW() \
         RETURNING user_id",
    )
    .bind(token)
    .fetch_optional(pool)
    .await?;

    Ok(row.map(|r| r.0))
}
