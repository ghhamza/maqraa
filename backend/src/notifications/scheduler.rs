// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

use std::time::Duration;

use chrono::{DateTime, Timelike, Utc};
use chrono_tz::Tz;
use sqlx::{PgPool, Postgres, Transaction};
use uuid::Uuid;

use crate::config::AppConfig;

use super::format::{format_count, format_session_time, role_label};
use super::queue::enqueue_in_tx;
use super::templates::TemplateVars;

fn parse_display_tz(tz: &str) -> Tz {
    tz.parse().unwrap_or(chrono_tz::Asia::Riyadh)
}

#[derive(sqlx::FromRow)]
struct ReminderRow {
    session_id: Uuid,
    title: Option<String>,
    scheduled_at: DateTime<Utc>,
    room_name: String,
    user_id: Uuid,
    email: String,
    preferred_language: String,
}

#[derive(sqlx::FromRow)]
struct ProfileNudgeRow {
    id: Uuid,
    name: String,
    email: String,
    preferred_language: String,
}

#[derive(sqlx::FromRow)]
struct SignupRow {
    name: String,
    email: String,
    role: String,
    created_at: DateTime<Utc>,
}

#[derive(sqlx::FromRow)]
struct AdminRow {
    id: Uuid,
    email: String,
    preferred_language: String,
}

const SIGNUP_LIST_CAP: usize = 50;

const REMINDER_STUDENTS_24H: &str = "\
SELECT s.id AS session_id, s.title, s.scheduled_at, \
       r.name AS room_name, u.id AS user_id, u.email, u.preferred_language \
FROM sessions s \
JOIN rooms r ON r.id = s.room_id \
JOIN enrollments e ON e.room_id = s.room_id AND e.status = 'approved' \
JOIN users u ON u.id = e.student_id \
WHERE s.status = 'scheduled' \
  AND s.scheduled_at > now() + interval '1 hour' \
  AND s.scheduled_at <= now() + interval '24 hours' \
  AND NOT EXISTS ( \
      SELECT 1 FROM session_reminder_log l \
      WHERE l.session_id = s.id AND l.recipient_user_id = u.id AND l.kind = '24h' \
  )";

const REMINDER_TEACHER_24H: &str = "\
SELECT s.id AS session_id, s.title, s.scheduled_at, \
       r.name AS room_name, u.id AS user_id, u.email, u.preferred_language \
FROM sessions s \
JOIN rooms r ON r.id = s.room_id \
JOIN users u ON u.id = r.teacher_id \
WHERE s.status = 'scheduled' \
  AND s.scheduled_at > now() + interval '1 hour' \
  AND s.scheduled_at <= now() + interval '24 hours' \
  AND NOT EXISTS ( \
      SELECT 1 FROM session_reminder_log l \
      WHERE l.session_id = s.id AND l.recipient_user_id = u.id AND l.kind = '24h' \
  )";

const REMINDER_STUDENTS_1H: &str = "\
SELECT s.id AS session_id, s.title, s.scheduled_at, \
       r.name AS room_name, u.id AS user_id, u.email, u.preferred_language \
FROM sessions s \
JOIN rooms r ON r.id = s.room_id \
JOIN enrollments e ON e.room_id = s.room_id AND e.status = 'approved' \
JOIN users u ON u.id = e.student_id \
WHERE s.status = 'scheduled' \
  AND s.scheduled_at > now() \
  AND s.scheduled_at <= now() + interval '1 hour' \
  AND NOT EXISTS ( \
      SELECT 1 FROM session_reminder_log l \
      WHERE l.session_id = s.id AND l.recipient_user_id = u.id AND l.kind = '1h' \
  )";

const REMINDER_TEACHER_1H: &str = "\
SELECT s.id AS session_id, s.title, s.scheduled_at, \
       r.name AS room_name, u.id AS user_id, u.email, u.preferred_language \
FROM sessions s \
JOIN rooms r ON r.id = s.room_id \
JOIN users u ON u.id = r.teacher_id \
WHERE s.status = 'scheduled' \
  AND s.scheduled_at > now() \
  AND s.scheduled_at <= now() + interval '1 hour' \
  AND NOT EXISTS ( \
      SELECT 1 FROM session_reminder_log l \
      WHERE l.session_id = s.id AND l.recipient_user_id = u.id AND l.kind = '1h' \
  )";

pub fn spawn_scheduler(pool: PgPool, config: AppConfig) {
    tokio::spawn(async move {
        let mut interval = tokio::time::interval(Duration::from_secs(600));
        loop {
            interval.tick().await;
            if let Err(e) = run_tick(&pool, &config).await {
                tracing::error!(error = %e, "notification scheduler tick failed");
            }
        }
    });
    tracing::info!("notification scheduler started (10 minute interval)");
}

async fn run_tick(pool: &PgPool, config: &AppConfig) -> Result<(), sqlx::Error> {
    if !config.notifications_enabled {
        return Ok(());
    }

    for row in sqlx::query_as::<_, ReminderRow>(REMINDER_STUDENTS_24H)
        .fetch_all(pool)
        .await?
    {
        send_reminder(pool, config, row, "24h").await?;
    }
    for row in sqlx::query_as::<_, ReminderRow>(REMINDER_TEACHER_24H)
        .fetch_all(pool)
        .await?
    {
        send_reminder(pool, config, row, "24h").await?;
    }
    for row in sqlx::query_as::<_, ReminderRow>(REMINDER_STUDENTS_1H)
        .fetch_all(pool)
        .await?
    {
        send_reminder(pool, config, row, "1h").await?;
    }
    for row in sqlx::query_as::<_, ReminderRow>(REMINDER_TEACHER_1H)
        .fetch_all(pool)
        .await?
    {
        send_reminder(pool, config, row, "1h").await?;
    }

    for row in sqlx::query_as::<_, ProfileNudgeRow>(
        "SELECT id, name, email, preferred_language \
         FROM users \
         WHERE profile_completion_pending = true \
           AND created_at < now() - interval '24 hours' \
           AND profile_nudge_sent_at IS NULL",
    )
    .fetch_all(pool)
    .await?
    {
        send_profile_nudge(pool, config, row).await?;
    }

    run_signup_digest_sweep(pool, config).await?;

    Ok(())
}

async fn send_reminder(
    pool: &PgPool,
    config: &AppConfig,
    row: ReminderRow,
    kind: &str,
) -> Result<(), sqlx::Error> {
    let mut tx: Transaction<'_, Postgres> = pool.begin().await?;

    let base = config.app_base_url.trim_end_matches('/');
    let session_title = row.title.unwrap_or_else(|| "Session".to_string());
    let session_time =
        format_session_time(row.scheduled_at, &row.preferred_language, &config.app_display_tz);
    let session_url = format!("{base}/sessions/{}", row.session_id);

    let vars = TemplateVars::new()
        .with("session_title", session_title)
        .with("room_name", row.room_name)
        .with("session_time", session_time)
        .with("session_url", session_url);

    enqueue_in_tx(
        &mut *tx,
        config,
        "session_reminder",
        &row.preferred_language,
        &row.email,
        Some(row.user_id),
        vars,
    )
    .await?;

    sqlx::query(
        "INSERT INTO session_reminder_log (session_id, recipient_user_id, kind) \
         VALUES ($1, $2, $3)",
    )
    .bind(row.session_id)
    .bind(row.user_id)
    .bind(kind)
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(())
}

async fn send_profile_nudge(
    pool: &PgPool,
    config: &AppConfig,
    row: ProfileNudgeRow,
) -> Result<(), sqlx::Error> {
    let mut tx: Transaction<'_, Postgres> = pool.begin().await?;

    let base = config.app_base_url.trim_end_matches('/');
    let vars = TemplateVars::new()
        .with("name", row.name)
        .with("app_url", format!("{base}/profile/complete"));

    enqueue_in_tx(
        &mut *tx,
        config,
        "profile_completion_reminder",
        &row.preferred_language,
        &row.email,
        Some(row.id),
        vars,
    )
    .await?;

    sqlx::query("UPDATE users SET profile_nudge_sent_at = now() WHERE id = $1")
        .bind(row.id)
        .execute(&mut *tx)
        .await?;

    tx.commit().await?;
    Ok(())
}

async fn run_signup_digest_sweep(pool: &PgPool, config: &AppConfig) -> Result<(), sqlx::Error> {
    let tz = parse_display_tz(&config.app_display_tz);
    let local_now = Utc::now().with_timezone(&tz);
    let local_date = local_now.date_naive();

    if local_now.hour() < config.digest_send_hour {
        return Ok(());
    }

    let already_sent: bool = sqlx::query_scalar(
        "SELECT EXISTS( \
            SELECT 1 FROM digest_log \
            WHERE digest_key = 'new_signups' AND sent_for_date = $1 \
         )",
    )
    .bind(local_date)
    .fetch_one(pool)
    .await?;

    if already_sent {
        return Ok(());
    }

    let signups: Vec<SignupRow> = sqlx::query_as(
        "SELECT name, email, role::text AS role, created_at \
         FROM users \
         WHERE created_at >= now() - interval '24 hours' \
         ORDER BY created_at DESC",
    )
    .fetch_all(pool)
    .await?;

    let admins: Vec<AdminRow> = sqlx::query_as(
        "SELECT id, email, preferred_language \
         FROM users \
         WHERE role = 'admin'",
    )
    .fetch_all(pool)
    .await?;

    let mut tx: Transaction<'_, Postgres> = pool.begin().await?;

    if !signups.is_empty() {
        let base = config.app_base_url.trim_end_matches('/');
        let total = signups.len();
        for admin in &admins {
            let locale = admin.preferred_language.as_str();
            let list_lines = build_signup_list_lines(&signups, locale, &config.app_display_tz);
            let vars = TemplateVars::new()
                .with("count", format_count(total, locale))
                .with("app_url", format!("{base}/users"))
                .with_list_lines(list_lines);
            enqueue_in_tx(
                &mut *tx,
                config,
                "new_signup_digest",
                locale,
                &admin.email,
                Some(admin.id),
                vars,
            )
            .await?;
        }
    }

    sqlx::query(
        "INSERT INTO digest_log (digest_key, sent_for_date) VALUES ('new_signups', $1)",
    )
    .bind(local_date)
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(())
}

fn build_signup_list_lines(
    signups: &[SignupRow],
    locale: &str,
    display_tz: &str,
) -> Vec<String> {
    let mut lines: Vec<String> = signups
        .iter()
        .take(SIGNUP_LIST_CAP)
        .map(|s| {
            let role = role_label(&s.role, locale);
            let signed_at = format_session_time(s.created_at, locale, display_tz);
            format!("{} — {} — {} — {}", s.name, s.email, role, signed_at)
        })
        .collect();

    if signups.len() > SIGNUP_LIST_CAP {
        let extra = signups.len() - SIGNUP_LIST_CAP;
        let overflow = match locale {
            "ar" => format!("+ {} أكثر", format_count(extra, locale)),
            "fr" => format!("+ {extra} de plus"),
            _ => format!("+ {extra} more"),
        };
        lines.push(overflow);
    }

    lines
}

// If a session is rescheduled out of the reminder window and later back in, the existing
// session_reminder_log row prevents a duplicate reminder — session_rescheduled email covers that.
