// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

use sqlx::PgPool;
use uuid::Uuid;

use crate::config::AppConfig;

use super::templates::{render, TemplateVars};

pub async fn enqueue_in_tx<'e, E>(
    executor: E,
    config: &AppConfig,
    template_key: &str,
    locale: &str,
    recipient_email: &str,
    recipient_user_id: Option<Uuid>,
    vars: TemplateVars,
) -> Result<(), sqlx::Error>
where
    E: sqlx::Executor<'e, Database = sqlx::Postgres>,
{
    enqueue_with_attachment_in_tx(
        executor,
        config,
        template_key,
        locale,
        recipient_email,
        recipient_user_id,
        vars,
        None,
        None,
    )
    .await
}

pub async fn enqueue_with_attachment_in_tx<'e, E>(
    executor: E,
    config: &AppConfig,
    template_key: &str,
    locale: &str,
    recipient_email: &str,
    recipient_user_id: Option<Uuid>,
    vars: TemplateVars,
    attachment_filename: Option<&str>,
    attachment_content: Option<&[u8]>,
) -> Result<(), sqlx::Error>
where
    E: sqlx::Executor<'e, Database = sqlx::Postgres>,
{
    if !config.notifications_enabled {
        return Ok(());
    }

    let rendered = render(template_key, locale, &vars);

    sqlx::query(
        "INSERT INTO notifications \
         (template_key, locale, recipient_email, recipient_user_id, subject, body_html, body_text, \
          attachment_filename, attachment_content) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)",
    )
    .bind(template_key)
    .bind(locale)
    .bind(recipient_email)
    .bind(recipient_user_id)
    .bind(&rendered.subject)
    .bind(&rendered.html)
    .bind(&rendered.text)
    .bind(attachment_filename)
    .bind(attachment_content)
    .execute(executor)
    .await?;

    tracing::info!(
        template_key = %template_key,
        recipient = %recipient_email,
        "notification queued"
    );

    Ok(())
}

pub async fn enqueue(
    pool: &PgPool,
    config: &AppConfig,
    template_key: &str,
    locale: &str,
    recipient_email: &str,
    recipient_user_id: Option<Uuid>,
    vars: TemplateVars,
) -> Result<(), sqlx::Error> {
    enqueue_with_attachment(
        pool,
        config,
        template_key,
        locale,
        recipient_email,
        recipient_user_id,
        vars,
        None,
        None,
    )
    .await
}

pub async fn enqueue_with_attachment(
    pool: &PgPool,
    config: &AppConfig,
    template_key: &str,
    locale: &str,
    recipient_email: &str,
    recipient_user_id: Option<Uuid>,
    vars: TemplateVars,
    attachment_filename: Option<&str>,
    attachment_content: Option<&[u8]>,
) -> Result<(), sqlx::Error> {
    if !config.notifications_enabled {
        tracing::info!(
            template_key = %template_key,
            recipient = %recipient_email,
            "notifications disabled — skipping enqueue"
        );
        return Ok(());
    }

    enqueue_with_attachment_in_tx(
        pool,
        config,
        template_key,
        locale,
        recipient_email,
        recipient_user_id,
        vars,
        attachment_filename,
        attachment_content,
    )
    .await
}
