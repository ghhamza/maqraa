// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

use axum::{
    extract::{Query, State},
    http::StatusCode,
    Json,
};
use chrono::NaiveDate;
use serde::{Deserialize, Serialize};
use sqlx::FromRow;

use crate::api::extractors::AuthenticatedUser;
use crate::api::AppState;

#[derive(Deserialize)]
pub struct FunnelQuery {
    pub days: Option<i32>,
}

#[derive(Serialize)]
pub struct FunnelStep {
    pub step: String,
    pub count: i64,
}

#[derive(Serialize, FromRow)]
pub struct WathTrendPoint {
    pub week_start: NaiveDate,
    pub count: i64,
}

#[derive(Serialize)]
pub struct AdminFunnelResponse {
    pub window_days: i32,
    pub teacher_funnel: Vec<FunnelStep>,
    pub student_funnel: Vec<FunnelStep>,
    pub weekly_active_teaching_halaqat: i64,
    pub wath_trend: Vec<WathTrendPoint>,
}

fn require_admin(auth: &AuthenticatedUser) -> Result<(), StatusCode> {
    if auth.role != "admin" {
        return Err(StatusCode::FORBIDDEN);
    }
    Ok(())
}

fn parse_funnel_days(raw: Option<i32>) -> i32 {
    match raw {
        Some(7) | Some(30) | Some(90) => raw.unwrap(),
        _ => 30,
    }
}

async fn distinct_event_users(
    db: &sqlx::PgPool,
    event_name: &str,
    role: &str,
    days: i32,
) -> Result<i64, StatusCode> {
    sqlx::query_scalar(
        "SELECT COUNT(DISTINCT user_id)::bigint \
         FROM product_events \
         WHERE event_name = $1 \
           AND user_role = $2 \
           AND user_id IS NOT NULL \
           AND created_at >= NOW() - ($3::int * INTERVAL '1 day')",
    )
    .bind(event_name)
    .bind(role)
    .bind(days)
    .fetch_one(db)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)
}

pub async fn funnel(
    State(state): State<AppState>,
    auth: AuthenticatedUser,
    Query(q): Query<FunnelQuery>,
) -> Result<Json<AdminFunnelResponse>, StatusCode> {
    require_admin(&auth)?;
    let days = parse_funnel_days(q.days);
    let db = &state.db;

    let teacher_steps = [
        ("registered", "user_registered"),
        ("demo_started", "demo_started"),
        ("demo_completed", "demo_completed"),
        ("halaqah_created", "halaqah_created"),
        ("invite_link_created", "invite_link_created"),
        ("session_scheduled", "session_scheduled"),
        ("session_started", "session_started"),
        ("recitation_logged", "recitation_logged"),
        ("session_completed", "session_completed"),
    ];

    let mut teacher_funnel = Vec::with_capacity(teacher_steps.len());
    for (step, event_name) in teacher_steps {
        let count = distinct_event_users(db, event_name, "teacher", days).await?;
        teacher_funnel.push(FunnelStep {
            step: step.to_string(),
            count,
        });
    }

    let student_registered = distinct_event_users(db, "user_registered", "student", days).await?;
    let joined_via_link = distinct_event_users(db, "student_joined_via_link", "student", days).await?;

    let attended_session: i64 = sqlx::query_scalar(
        "SELECT COUNT(DISTINCT sa.student_id)::bigint \
         FROM session_attendance sa \
         INNER JOIN sessions s ON s.id = sa.session_id \
         WHERE sa.attended = true \
           AND s.scheduled_at >= NOW() - ($1::int * INTERVAL '1 day')",
    )
    .bind(days)
    .fetch_one(db)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let student_funnel = vec![
        FunnelStep {
            step: "registered".to_string(),
            count: student_registered,
        },
        FunnelStep {
            step: "joined_via_link".to_string(),
            count: joined_via_link,
        },
        FunnelStep {
            step: "attended_session".to_string(),
            count: attended_session,
        },
    ];

    let weekly_active_teaching_halaqat: i64 = sqlx::query_scalar(
        "SELECT COUNT(DISTINCT s.room_id)::bigint \
         FROM sessions s \
         INNER JOIN recitations r ON r.session_id = s.id \
         WHERE s.scheduled_at >= NOW() - INTERVAL '7 days'",
    )
    .fetch_one(db)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let wath_trend = sqlx::query_as::<_, WathTrendPoint>(
        "WITH weeks AS ( \
             SELECT (date_trunc('week', NOW())::date - (n * 7)) AS week_start \
             FROM generate_series(0, 7) AS n \
         ), \
         wath AS ( \
             SELECT date_trunc('week', s.scheduled_at)::date AS week_start, \
                    COUNT(DISTINCT s.room_id)::bigint AS count \
             FROM sessions s \
             INNER JOIN recitations r ON r.session_id = s.id \
             WHERE s.scheduled_at >= date_trunc('week', NOW()) - INTERVAL '7 weeks' \
             GROUP BY 1 \
         ) \
         SELECT w.week_start, COALESCE(wath.count, 0)::bigint AS count \
         FROM weeks w \
         LEFT JOIN wath ON wath.week_start = w.week_start \
         ORDER BY w.week_start",
    )
    .fetch_all(db)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(AdminFunnelResponse {
        window_days: days,
        teacher_funnel,
        student_funnel,
        weekly_active_teaching_halaqat,
        wath_trend,
    }))
}
