// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

use sqlx::{FromRow, PgPool};
use uuid::Uuid;

use crate::config::AppConfig;

use super::format::{corrections_summary_line, grade_label, recitation_ref};
use super::queue::enqueue_in_tx;
use super::templates::TemplateVars;

#[derive(FromRow)]
struct QualifyingStudent {
    student_id: Uuid,
    email: String,
    preferred_language: String,
    name: String,
}

#[derive(FromRow)]
struct RecitedRow {
    surah: i32,
    ayah_start: i32,
    ayah_end: i32,
    grade: Option<String>,
}

#[derive(FromRow)]
struct CategoryCount {
    category: String,
    count: i64,
}

#[derive(FromRow)]
struct PlannedTarget {
    surah: i32,
    ayah_start: i32,
    ayah_end: i32,
}

/// Enqueue end-of-session summary emails for students with graded/completed work.
/// Never panics; callers should ignore errors (log only).
pub async fn enqueue_session_summaries(
    pool: &PgPool,
    config: &AppConfig,
    session_id: Uuid,
    room_id: Uuid,
    room_name: &str,
) -> Result<(), sqlx::Error> {
    let students: Vec<QualifyingStudent> = sqlx::query_as(
        "SELECT DISTINCT u.id AS student_id, u.email, u.preferred_language, u.name \
         FROM recitations r \
         INNER JOIN users u ON u.id = r.student_id \
         WHERE r.session_id = $1 \
           AND (r.grade IS NOT NULL OR r.plan_status = 'completed')",
    )
    .bind(session_id)
    .fetch_all(pool)
    .await?;

    if students.is_empty() {
        return Ok(());
    }

    let base = config.app_base_url.trim_end_matches('/');

    for student in students {
        if let Err(e) = enqueue_one(
            pool,
            config,
            session_id,
            room_id,
            room_name,
            base,
            &student,
        )
        .await
        {
            tracing::error!(
                error = %e,
                session_id = %session_id,
                student_id = %student.student_id,
                "failed to enqueue session_summary email"
            );
        }
    }

    Ok(())
}

async fn enqueue_one(
    pool: &PgPool,
    config: &AppConfig,
    session_id: Uuid,
    room_id: Uuid,
    room_name: &str,
    base: &str,
    student: &QualifyingStudent,
) -> Result<(), sqlx::Error> {
    let mut tx = pool.begin().await?;

    let inserted = sqlx::query(
        "INSERT INTO session_reminder_log (session_id, recipient_user_id, kind) \
         VALUES ($1, $2, 'session_summary') \
         ON CONFLICT (session_id, recipient_user_id, kind) DO NOTHING",
    )
    .bind(session_id)
    .bind(student.student_id)
    .execute(&mut *tx)
    .await?
    .rows_affected();

    if inserted == 0 {
        // Already sent for this session/student
        tx.rollback().await?;
        return Ok(());
    }

    let locale = student.preferred_language.as_str();

    let recited: Vec<RecitedRow> = sqlx::query_as(
        "SELECT surah, ayah_start, ayah_end, grade::text AS grade \
         FROM recitations \
         WHERE session_id = $1 AND student_id = $2 \
           AND (grade IS NOT NULL OR plan_status = 'completed') \
         ORDER BY created_at ASC",
    )
    .bind(session_id)
    .bind(student.student_id)
    .fetch_all(&mut *tx)
    .await?;

    if recited.is_empty() {
        tx.rollback().await?;
        return Ok(());
    }

    let sep = if locale == "ar" { "، " } else { ", " };
    let recited_line = recited
        .iter()
        .map(|r| recitation_ref(r.surah, r.ayah_start, r.ayah_end, locale))
        .collect::<Vec<_>>()
        .join(sep);

    let grade_lbl = recited
        .iter()
        .rev()
        .find_map(|r| r.grade.as_deref())
        .map(|g| grade_label(g, locale));

    let cats: Vec<CategoryCount> = sqlx::query_as(
        "SELECT ea.error_category::text AS category, COUNT(*)::bigint AS count \
         FROM error_annotations ea \
         INNER JOIN recitations r ON r.id = ea.recitation_id \
         WHERE r.session_id = $1 \
           AND r.student_id = $2 \
           AND ea.annotation_kind = 'error' \
         GROUP BY ea.error_category \
         ORDER BY COUNT(*) DESC \
         LIMIT 2",
    )
    .bind(session_id)
    .bind(student.student_id)
    .fetch_all(&mut *tx)
    .await?;

    let corrections = if cats.is_empty() {
        String::new()
    } else {
        let pairs: Vec<(String, i64)> = cats
            .into_iter()
            .map(|c| (c.category, c.count))
            .collect();
        corrections_summary_line(&pairs, locale)
    };

    let next: Option<PlannedTarget> = sqlx::query_as(
        "SELECT surah, ayah_start, ayah_end \
         FROM recitations \
         WHERE room_id = $1 AND student_id = $2 AND plan_status = 'planned' \
         ORDER BY order_index ASC, created_at ASC \
         LIMIT 1",
    )
    .bind(room_id)
    .bind(student.student_id)
    .fetch_optional(&mut *tx)
    .await?;

    let next_target_line = next
        .map(|n| recitation_ref(n.surah, n.ayah_start, n.ayah_end, locale))
        .unwrap_or_default();

    let mut vars = TemplateVars::new()
        .with("name", student.name.clone())
        .with("halaqah_name", room_name)
        .with("recited_line", recited_line)
        .with("corrections_summary", corrections)
        .with("next_target_line", next_target_line)
        .with(
            "app_url",
            format!("{base}/students/{}/progress", student.student_id),
        );

    if let Some(label) = grade_lbl {
        vars = vars.with("grade_label", label);
    }

    enqueue_in_tx(
        &mut *tx,
        config,
        "session_summary",
        locale,
        &student.email,
        Some(student.student_id),
        vars,
    )
    .await?;

    tx.commit().await?;
    Ok(())
}
