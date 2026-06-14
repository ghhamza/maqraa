// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

use std::sync::Arc;
use std::time::Duration;

use sqlx::PgPool;
use uuid::Uuid;

use crate::config::AppConfig;

use super::provider::{EmailProvider, OutboundEmail};

#[derive(sqlx::FromRow)]
struct NotificationRow {
    id: Uuid,
    recipient_email: String,
    subject: String,
    body_html: String,
    body_text: String,
    retry_count: i32,
    max_retries: i32,
}

fn backoff_minutes(retry_count: i32) -> i64 {
    let minutes = 2_i64.pow(retry_count as u32);
    minutes.min(30)
}

async fn mark_sent(pool: &PgPool, id: Uuid) -> Result<(), sqlx::Error> {
    sqlx::query(
        "UPDATE notifications SET status = 'sent', sent_at = NOW() WHERE id = $1",
    )
    .bind(id)
    .execute(pool)
    .await?;
    Ok(())
}

async fn mark_failed(pool: &PgPool, id: Uuid, error: &str) -> Result<(), sqlx::Error> {
    sqlx::query(
        "UPDATE notifications SET status = 'failed', last_error = $2 WHERE id = $1",
    )
    .bind(id)
    .bind(error)
    .execute(pool)
    .await?;
    Ok(())
}

async fn requeue(pool: &PgPool, id: Uuid, retry_count: i32, error: &str) -> Result<(), sqlx::Error> {
    let delay = backoff_minutes(retry_count);
    sqlx::query(
        "UPDATE notifications SET status = 'queued', retry_count = $2, last_error = $3, \
         scheduled_at = NOW() + ($4 || ' minutes')::interval WHERE id = $1",
    )
    .bind(id)
    .bind(retry_count)
    .bind(error)
    .bind(delay.to_string())
    .execute(pool)
    .await?;
    Ok(())
}

async fn process_batch(
    pool: &PgPool,
    provider: &Arc<dyn EmailProvider>,
) -> Result<(), sqlx::Error> {
    let rows: Vec<NotificationRow> = sqlx::query_as(
        "UPDATE notifications SET status = 'sending' \
         WHERE id IN ( \
             SELECT id FROM notifications \
             WHERE status = 'queued' AND scheduled_at <= NOW() \
             ORDER BY created_at \
             FOR UPDATE SKIP LOCKED \
             LIMIT 20 \
         ) \
         RETURNING id, recipient_email, subject, body_html, body_text, retry_count, max_retries",
    )
    .fetch_all(pool)
    .await?;

    for row in rows {
        let email = OutboundEmail {
            to: row.recipient_email.clone(),
            subject: row.subject.clone(),
            html: row.body_html.clone(),
            text: row.body_text.clone(),
        };

        match provider.send(&email).await {
            Ok(()) => {
                if let Err(e) = mark_sent(pool, row.id).await {
                    tracing::error!(notification_id = %row.id, error = %e, "failed to mark notification sent");
                }
            }
            Err(e) => {
                let err_msg = e.to_string();
                let next_retry = row.retry_count + 1;
                if next_retry >= row.max_retries {
                    tracing::warn!(
                        notification_id = %row.id,
                        error = %err_msg,
                        "notification permanently failed"
                    );
                    if let Err(db_err) = mark_failed(pool, row.id, &err_msg).await {
                        tracing::error!(notification_id = %row.id, error = %db_err, "failed to mark notification failed");
                    }
                } else {
                    tracing::warn!(
                        notification_id = %row.id,
                        retry = next_retry,
                        error = %err_msg,
                        "notification send failed — requeueing"
                    );
                    if let Err(db_err) = requeue(pool, row.id, next_retry, &err_msg).await {
                        tracing::error!(notification_id = %row.id, error = %db_err, "failed to requeue notification");
                    }
                }
            }
        }
    }

    Ok(())
}

pub fn spawn_worker(pool: PgPool, provider: Arc<dyn EmailProvider>, config: AppConfig) {
    if !config.notifications_enabled {
        tracing::info!("notifications worker disabled (NOTIFICATIONS_ENABLED=false)");
        return;
    }

    tracing::info!("notifications worker started (poll interval 10s)");
    tokio::spawn(async move {
        let mut interval = tokio::time::interval(Duration::from_secs(10));
        loop {
            interval.tick().await;
            if let Err(e) = process_batch(&pool, &provider).await {
                tracing::error!(error = %e, "notification worker batch failed");
            }
        }
    });
}
