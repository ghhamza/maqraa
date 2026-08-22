// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

use std::time::Duration;

use chrono::{DateTime, Datelike, Utc};
use chrono_tz::Tz;
use sqlx::PgPool;
use uuid::Uuid;

use crate::api::handlers::rooms::fetch_first_session;
use crate::api::handlers::share_card::{
    arabic_riwaya_label, arabic_type_label, format_session_ar, render_card_png, resolve_public_halaqah,
    CardFormat,
};
use crate::api::AppState;
use crate::config::AppConfig;

use super::format::format_session_time;
use super::queue::enqueue_with_attachment;
use super::templates::TemplateVars;

const WEEKDAYS_AR: [&str; 7] = [
    "الإثنين",
    "الثلاثاء",
    "الأربعاء",
    "الخميس",
    "الجمعة",
    "السبت",
    "الأحد",
];
const WEEKDAYS_EN: [&str; 7] = [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
    "Sunday",
];
const WEEKDAYS_FR: [&str; 7] = [
    "lundi",
    "mardi",
    "mercredi",
    "jeudi",
    "vendredi",
    "samedi",
    "dimanche",
];

fn weekday_name(locale: &str, at: DateTime<Utc>, tz_name: &str) -> String {
    let tz: Tz = tz_name.parse().unwrap_or(chrono_tz::Asia::Riyadh);
    let local = at.with_timezone(&tz);
    let idx = local.weekday().num_days_from_monday() as usize;
    match locale {
        "en" => WEEKDAYS_EN.get(idx).copied().unwrap_or("").to_string(),
        "fr" => WEEKDAYS_FR.get(idx).copied().unwrap_or("").to_string(),
        _ => WEEKDAYS_AR.get(idx).copied().unwrap_or("").to_string(),
    }
}

fn locale_of(preferred: &str) -> &str {
    match preferred {
        "en" | "fr" | "ar" => preferred,
        _ => "ar",
    }
}

fn urlencode(s: &str) -> String {
    let mut out = String::with_capacity(s.len() * 3);
    for b in s.bytes() {
        match b {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                out.push(b as char);
            }
            _ => out.push_str(&format!("%{b:02X}")),
        }
    }
    out
}

/// Ensure an active halaqah share link exists; returns its token.
async fn ensure_halaqah_share_token(
    pool: &PgPool,
    room_id: Uuid,
    teacher_id: Uuid,
) -> Result<String, sqlx::Error> {
    if let Some(token) = sqlx::query_scalar::<_, String>(
        "SELECT token FROM share_links \
         WHERE target_id = $1 AND target_type = 'halaqah' \
         AND revoked_at IS NULL \
         AND (expires_at IS NULL OR expires_at > NOW()) \
         AND (max_uses IS NULL OR use_count < max_uses) \
         ORDER BY created_at ASC LIMIT 1",
    )
    .bind(room_id)
    .fetch_optional(pool)
    .await?
    {
        return Ok(token);
    }

    const ALPHABET: &[u8] = b"ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
    use rand::Rng;
    for _ in 0..5 {
        let token: String = (0..24)
            .map(|_| {
                let idx = rand::thread_rng().gen_range(0..ALPHABET.len());
                ALPHABET[idx] as char
            })
            .collect();
        let result = sqlx::query_scalar::<_, String>(
            "INSERT INTO share_links \
             (token, target_type, target_id, created_by, auto_approve) \
             VALUES ($1, 'halaqah', $2, $3, false) \
             RETURNING token",
        )
        .bind(&token)
        .bind(room_id)
        .bind(teacher_id)
        .fetch_one(pool)
        .await;
        match result {
            Ok(t) => return Ok(t),
            Err(e) => {
                if let sqlx::Error::Database(db) = &e {
                    if db.code().as_deref() == Some("23505") {
                        continue;
                    }
                }
                return Err(e);
            }
        }
    }
    Err(sqlx::Error::RowNotFound)
}

async fn claim_send(
    pool: &PgPool,
    room_id: Uuid,
    kind: &str,
    seq: i16,
) -> Result<bool, sqlx::Error> {
    let res = sqlx::query(
        "INSERT INTO onboarding_emails (room_id, kind, seq) VALUES ($1, $2, $3) \
         ON CONFLICT (room_id, kind, seq) DO NOTHING",
    )
    .bind(room_id)
    .bind(kind)
    .bind(seq)
    .execute(pool)
    .await?;
    Ok(res.rows_affected() > 0)
}

#[derive(sqlx::FromRow)]
struct TeacherRoomRow {
    room_id: Uuid,
    room_name: String,
    teacher_id: Uuid,
    teacher_name: String,
    email: String,
    preferred_language: String,
    riwaya: String,
    halaqah_type: String,
}

async fn process_setup_incomplete(pool: &PgPool, config: &AppConfig) -> Result<(), sqlx::Error> {
    let base = config.public_base_url.trim_end_matches('/');

    for (seq, interval) in [(1i16, "1 hour"), (2i16, "24 hours")] {
        let rows: Vec<TeacherRoomRow> = sqlx::query_as(&format!(
            "SELECT r.id AS room_id, r.name AS room_name, u.id AS teacher_id, u.name AS teacher_name, \
                    u.email, u.preferred_language, r.riwaya::text AS riwaya, \
                    r.halaqah_type::text AS halaqah_type \
             FROM rooms r \
             JOIN users u ON u.id = r.teacher_id \
             WHERE r.is_active = true \
               AND r.setup_completed_at IS NULL \
               AND u.email IS NOT NULL AND u.email <> '' \
               AND r.created_at < NOW() - INTERVAL '{interval}' \
               AND NOT EXISTS ( \
                   SELECT 1 FROM onboarding_emails oe \
                   WHERE oe.room_id = r.id AND oe.kind = 'setup_incomplete' AND oe.seq = {seq} \
               )"
        ))
        .fetch_all(pool)
        .await?;

        for row in rows {
            if !claim_send(pool, row.room_id, "setup_incomplete", seq).await? {
                continue;
            }
            let locale = locale_of(&row.preferred_language);
            let setup_url = format!("{base}/rooms/{}/setup", row.room_id);
            let vars = TemplateVars::new()
                .with("teacher_name", &row.teacher_name)
                .with("halaqah_name", &row.room_name)
                .with("setup_url", &setup_url)
                .with("app_url", base);
            if let Err(e) = enqueue_with_attachment(
                pool,
                config,
                "setup_incomplete",
                locale,
                &row.email,
                Some(row.teacher_id),
                vars,
                None,
                None,
            )
            .await
            {
                tracing::error!(error = %e, room_id = %row.room_id, "enqueue setup_incomplete failed");
            }
        }
    }
    Ok(())
}

async fn process_share_nudge(
    pool: &PgPool,
    config: &AppConfig,
    state: &AppState,
) -> Result<(), sqlx::Error> {
    let base = config.public_base_url.trim_end_matches('/');

    for (seq, interval) in [(1i16, "24 hours"), (2i16, "3 days")] {
        let rows: Vec<TeacherRoomRow> = sqlx::query_as(&format!(
            "SELECT r.id AS room_id, r.name AS room_name, u.id AS teacher_id, u.name AS teacher_name, \
                    u.email, u.preferred_language, r.riwaya::text AS riwaya, \
                    r.halaqah_type::text AS halaqah_type \
             FROM rooms r \
             JOIN users u ON u.id = r.teacher_id \
             WHERE r.is_active = true \
               AND r.setup_completed_at IS NOT NULL \
               AND u.email IS NOT NULL AND u.email <> '' \
               AND r.setup_completed_at < NOW() - INTERVAL '{interval}' \
               AND COALESCE((SELECT COUNT(*)::bigint FROM enrollments e \
                             WHERE e.room_id = r.id AND e.status = 'approved'), 0) = 0 \
               AND NOT EXISTS ( \
                   SELECT 1 FROM onboarding_emails oe \
                   WHERE oe.room_id = r.id AND oe.kind = 'share_nudge' AND oe.seq = {seq} \
               )"
        ))
        .fetch_all(pool)
        .await?;

        for row in rows {
            if !claim_send(pool, row.room_id, "share_nudge", seq).await? {
                continue;
            }

            let token = match ensure_halaqah_share_token(pool, row.room_id, row.teacher_id).await {
                Ok(t) => t,
                Err(e) => {
                    tracing::error!(error = %e, room_id = %row.room_id, "ensure share token failed");
                    continue;
                }
            };

            let locale = locale_of(&row.preferred_language);
            let share_url = format!("{base}/s/{token}");
            let room_url = format!("{base}/rooms/{}", row.room_id);
            let card_url = format!("{base}/s/{token}/card.png?format=square&v=5");

            let first = fetch_first_session(pool, row.room_id).await.ok().flatten();
            let session_date = first
                .as_ref()
                .map(|s| {
                    if locale == "ar" {
                        format_session_ar(s.scheduled_at, &config.app_display_tz)
                    } else {
                        format_session_time(s.scheduled_at, locale, &config.app_display_tz)
                    }
                })
                .unwrap_or_else(|| match locale {
                    "en" => "soon".into(),
                    "fr" => "bientôt".into(),
                    _ => "قريبًا".into(),
                });

            let weekday = first
                .as_ref()
                .map(|s| weekday_name(locale, s.scheduled_at, &config.app_display_tz))
                .unwrap_or_else(|| session_date.clone());

            let type_label = if locale == "ar" {
                arabic_type_label(&row.halaqah_type).to_string()
            } else {
                row.halaqah_type.clone()
            };
            let riwaya_label = if locale == "ar" {
                arabic_riwaya_label(&row.riwaya).to_string()
            } else {
                row.riwaya.clone()
            };

            let invite_message = match locale {
                "en" => format!(
                    "Join the {} halaqah ({} · {}) on Maqraa. First session {} Mecca time. {}",
                    row.room_name, type_label, riwaya_label, session_date, share_url
                ),
                "fr" => format!(
                    "Rejoins la halaqa {} ({} · {}) sur Maqraa. Première séance {}, heure de La Mecque. {}",
                    row.room_name, type_label, riwaya_label, session_date, share_url
                ),
                _ => format!(
                    "انضمّ إلى حلقة {} ({} · {}) على منصة المقرأة. الحصة الأولى {} بتوقيت مكة. {}",
                    row.room_name, type_label, riwaya_label, session_date, share_url
                ),
            };
            let wa_url = format!("https://wa.me/?text={}", urlencode(&invite_message));

            let png = match resolve_public_halaqah(state, &token).await {
                Ok(h) => render_card_png(&h, CardFormat::Square, base).ok(),
                Err(_) => None,
            };

            let vars = TemplateVars::new()
                .with("teacher_name", &row.teacher_name)
                .with("halaqah_name", &row.room_name)
                .with("session_date", &session_date)
                .with("weekday", &weekday)
                .with("share_url", &share_url)
                .with("room_url", &room_url)
                .with("card_url", &card_url)
                .with("whatsapp_url", &wa_url)
                .with("app_url", base);

            if let Err(e) = enqueue_with_attachment(
                pool,
                config,
                "share_nudge",
                locale,
                &row.email,
                Some(row.teacher_id),
                vars,
                Some("qr-halaqah.png"),
                png.as_deref(),
            )
            .await
            {
                tracing::error!(error = %e, room_id = %row.room_id, "enqueue share_nudge failed");
            }
        }
    }
    Ok(())
}

pub async fn run_onboarding_tick(state: &AppState) {
    let pool = &state.db;
    let config = &state.config;
    if let Err(e) = process_setup_incomplete(pool, config).await {
        tracing::error!(error = %e, "setup_incomplete onboarding tick failed");
    }
    if let Err(e) = process_share_nudge(pool, config, state).await {
        tracing::error!(error = %e, "share_nudge onboarding tick failed");
    }
}

pub fn spawn_onboarding_emails(state: AppState) {
    if !state.config.onboarding_emails_enabled {
        tracing::info!("onboarding emails disabled (ONBOARDING_EMAILS_ENABLED=false)");
        return;
    }
    if !state.config.notifications_enabled {
        tracing::info!("onboarding emails skipped (notifications disabled)");
        return;
    }

    tokio::spawn(async move {
        let mut interval = tokio::time::interval(Duration::from_secs(15 * 60));
        interval.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Skip);
        loop {
            interval.tick().await;
            run_onboarding_tick(&state).await;
        }
    });
    tracing::info!("onboarding email job started (15m interval)");
}
