// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

use axum::http::StatusCode;
use chrono::{DateTime, Datelike, Duration, NaiveDate, Utc};
use sqlx::FromRow;
use std::collections::HashMap;

use super::types::*;

fn map_err(e: sqlx::Error, ctx: &str) -> StatusCode {
    tracing::error!(error = %e, "{ctx}");
    StatusCode::INTERNAL_SERVER_ERROR
}

#[derive(FromRow)]
struct TotalsUsers {
    users: i64,
    students: i64,
    teachers: i64,
    admins: i64,
}

#[derive(FromRow)]
struct TotalsRooms {
    rooms: i64,
    rooms_active: i64,
    rooms_archived: i64,
}

#[derive(FromRow)]
struct TotalsSessions {
    sessions: i64,
    sessions_completed: i64,
    sessions_scheduled: i64,
    sessions_in_progress: i64,
    sessions_cancelled: i64,
}

#[derive(FromRow)]
struct TotalsEnrollments {
    enrollments_approved: i64,
    enrollments_pending: i64,
}

#[derive(FromRow)]
struct TotalsRecitations {
    recitations: i64,
    pages_recited: Option<f64>,
}

#[derive(FromRow)]
struct TotalsAnnotations {
    annotations: i64,
    annotations_open: i64,
}

#[derive(FromRow)]
struct TotalsShare {
    share_links: i64,
    share_link_joins: Option<i64>,
}

pub async fn load_totals(db: &sqlx::PgPool) -> Result<DashboardTotals, StatusCode> {
    let (users, rooms, sessions, enrollments, recitations, annotations, share) = tokio::try_join!(
        sqlx::query_as::<_, TotalsUsers>(
            "SELECT COUNT(*)::bigint AS users, \
             COUNT(*) FILTER (WHERE role = 'student')::bigint AS students, \
             COUNT(*) FILTER (WHERE role = 'teacher')::bigint AS teachers, \
             COUNT(*) FILTER (WHERE role = 'admin')::bigint AS admins \
             FROM users",
        )
        .fetch_one(db),
        sqlx::query_as::<_, TotalsRooms>(
            "SELECT COUNT(*)::bigint AS rooms, \
             COUNT(*) FILTER (WHERE is_active)::bigint AS rooms_active, \
             COUNT(*) FILTER (WHERE NOT is_active)::bigint AS rooms_archived \
             FROM rooms",
        )
        .fetch_one(db),
        sqlx::query_as::<_, TotalsSessions>(
            "SELECT COUNT(*)::bigint AS sessions, \
             COUNT(*) FILTER (WHERE status::text = 'completed')::bigint AS sessions_completed, \
             COUNT(*) FILTER (WHERE status::text = 'scheduled')::bigint AS sessions_scheduled, \
             COUNT(*) FILTER (WHERE status::text = 'in_progress')::bigint AS sessions_in_progress, \
             COUNT(*) FILTER (WHERE status::text = 'cancelled')::bigint AS sessions_cancelled \
             FROM sessions",
        )
        .fetch_one(db),
        sqlx::query_as::<_, TotalsEnrollments>(
            "SELECT COUNT(*) FILTER (WHERE status = 'approved')::bigint AS enrollments_approved, \
             COUNT(*) FILTER (WHERE status = 'pending')::bigint AS enrollments_pending \
             FROM enrollments",
        )
        .fetch_one(db),
        sqlx::query_as::<_, TotalsRecitations>(
            "SELECT COUNT(*)::bigint AS recitations, \
             COALESCE(SUM(pages_count), 0)::float8 AS pages_recited \
             FROM recitations",
        )
        .fetch_one(db),
        sqlx::query_as::<_, TotalsAnnotations>(
            "SELECT COUNT(*)::bigint AS annotations, \
             COUNT(*) FILTER (WHERE status = 'open')::bigint AS annotations_open \
             FROM error_annotations",
        )
        .fetch_one(db),
        sqlx::query_as::<_, TotalsShare>(
            "SELECT COUNT(*)::bigint AS share_links, \
             COALESCE(SUM(join_count), 0)::bigint AS share_link_joins \
             FROM share_links",
        )
        .fetch_one(db),
    )
    .map_err(|e| map_err(e, "admin dashboard totals failed"))?;

    Ok(DashboardTotals {
        users: users.users,
        students: users.students,
        teachers: users.teachers,
        admins: users.admins,
        rooms: rooms.rooms,
        rooms_active: rooms.rooms_active,
        rooms_archived: rooms.rooms_archived,
        sessions: sessions.sessions,
        sessions_completed: sessions.sessions_completed,
        sessions_scheduled: sessions.sessions_scheduled,
        sessions_in_progress: sessions.sessions_in_progress,
        sessions_cancelled: sessions.sessions_cancelled,
        enrollments_approved: enrollments.enrollments_approved,
        enrollments_pending: enrollments.enrollments_pending,
        recitations: recitations.recitations,
        pages_recited: recitations.pages_recited.unwrap_or(0.0),
        annotations: annotations.annotations,
        annotations_open: annotations.annotations_open,
        share_links: share.share_links,
        share_link_joins: share.share_link_joins.unwrap_or(0),
    })
}

#[derive(FromRow)]
struct ActivityRow {
    new_users_7d: i64,
    new_users_30d: i64,
    active_teachers_7d: i64,
    active_teachers_30d: i64,
    active_students_7d: i64,
    active_students_30d: i64,
    sessions_7d: i64,
    sessions_30d: i64,
    avg_star_rating: Option<f64>,
    avg_session_duration_minutes: Option<f64>,
}

pub async fn load_activity(db: &sqlx::PgPool) -> Result<DashboardActivity, StatusCode> {
    let row = sqlx::query_as::<_, ActivityRow>(
        "SELECT \
         (SELECT COUNT(*)::bigint FROM users WHERE created_at > NOW() - INTERVAL '7 days') AS new_users_7d, \
         (SELECT COUNT(*)::bigint FROM users WHERE created_at > NOW() - INTERVAL '30 days') AS new_users_30d, \
         (SELECT COUNT(DISTINCT r.teacher_id)::bigint FROM sessions s \
            JOIN rooms r ON r.id = s.room_id \
            WHERE s.status::text IN ('completed', 'in_progress') \
              AND s.scheduled_at > NOW() - INTERVAL '7 days') AS active_teachers_7d, \
         (SELECT COUNT(DISTINCT r.teacher_id)::bigint FROM sessions s \
            JOIN rooms r ON r.id = s.room_id \
            WHERE s.status::text IN ('completed', 'in_progress') \
              AND s.scheduled_at > NOW() - INTERVAL '30 days') AS active_teachers_30d, \
         (SELECT COUNT(DISTINCT student_id)::bigint FROM recitations \
            WHERE student_id IS NOT NULL AND created_at > NOW() - INTERVAL '7 days') AS active_students_7d, \
         (SELECT COUNT(DISTINCT student_id)::bigint FROM recitations \
            WHERE student_id IS NOT NULL AND created_at > NOW() - INTERVAL '30 days') AS active_students_30d, \
         (SELECT COUNT(*)::bigint FROM sessions WHERE scheduled_at > NOW() - INTERVAL '7 days') AS sessions_7d, \
         (SELECT COUNT(*)::bigint FROM sessions WHERE scheduled_at > NOW() - INTERVAL '30 days') AS sessions_30d, \
         (SELECT AVG(star_rating)::float8 FROM recitations WHERE star_rating IS NOT NULL) AS avg_star_rating, \
         (SELECT AVG(duration_minutes)::float8 FROM sessions WHERE status::text = 'completed') AS avg_session_duration_minutes",
    )
    .fetch_one(db)
    .await
    .map_err(|e| map_err(e, "admin dashboard activity failed"))?;

    Ok(DashboardActivity {
        new_users_7d: row.new_users_7d,
        new_users_30d: row.new_users_30d,
        active_teachers_7d: row.active_teachers_7d,
        active_teachers_30d: row.active_teachers_30d,
        active_students_7d: row.active_students_7d,
        active_students_30d: row.active_students_30d,
        sessions_7d: row.sessions_7d,
        sessions_30d: row.sessions_30d,
        avg_star_rating: row.avg_star_rating,
        avg_session_duration_minutes: row.avg_session_duration_minutes,
    })
}

pub async fn load_demographics(db: &sqlx::PgPool) -> Result<DashboardDemographics, StatusCode> {
    let (gender, age_buckets, countries, login_method) = tokio::try_join!(
        sqlx::query_as::<_, GenderRow>(
            "SELECT COALESCE(gender, 'unknown') AS gender, \
             COUNT(*) FILTER (WHERE role = 'student')::bigint AS students, \
             COUNT(*) FILTER (WHERE role = 'teacher')::bigint AS teachers \
             FROM users \
             WHERE role IN ('student', 'teacher') \
             GROUP BY COALESCE(gender, 'unknown') \
             ORDER BY gender",
        )
        .fetch_all(db),
        sqlx::query_as::<_, AgeBucketRow>(
            "SELECT \
             CASE \
               WHEN birth_year IS NULL THEN 'unknown' \
               WHEN EXTRACT(YEAR FROM NOW())::int - birth_year < 12 THEN 'under_12' \
               WHEN EXTRACT(YEAR FROM NOW())::int - birth_year BETWEEN 12 AND 17 THEN '12_17' \
               WHEN EXTRACT(YEAR FROM NOW())::int - birth_year BETWEEN 18 AND 24 THEN '18_24' \
               WHEN EXTRACT(YEAR FROM NOW())::int - birth_year BETWEEN 25 AND 34 THEN '25_34' \
               WHEN EXTRACT(YEAR FROM NOW())::int - birth_year BETWEEN 35 AND 44 THEN '35_44' \
               WHEN EXTRACT(YEAR FROM NOW())::int - birth_year BETWEEN 45 AND 54 THEN '45_54' \
               ELSE '55_plus' \
             END AS bucket, \
             COUNT(*) FILTER (WHERE role = 'student')::bigint AS students, \
             COUNT(*) FILTER (WHERE role = 'teacher')::bigint AS teachers \
             FROM users \
             WHERE role IN ('student', 'teacher') \
             GROUP BY 1 \
             ORDER BY 1",
        )
        .fetch_all(db),
        sqlx::query_as::<_, CountryRow>(
            "WITH grouped AS ( \
               SELECT COALESCE(NULLIF(UPPER(TRIM(country_code)), ''), 'unknown') AS country_code, \
                      COUNT(*)::bigint AS users, \
                      COUNT(*) FILTER (WHERE role = 'student')::bigint AS students, \
                      COUNT(*) FILTER (WHERE role = 'teacher')::bigint AS teachers \
               FROM users \
               GROUP BY 1 \
             ), \
             top AS ( \
               SELECT * FROM grouped \
               WHERE country_code <> 'unknown' \
               ORDER BY users DESC \
               LIMIT 15 \
             ), \
             unk AS ( \
               SELECT * FROM grouped WHERE country_code = 'unknown' \
             ) \
             SELECT country_code, users, students, teachers FROM top \
             UNION ALL \
             SELECT country_code, users, students, teachers FROM unk",
        )
        .fetch_all(db),
        sqlx::query_as::<_, LoginMethodRow>(
            "SELECT \
             CASE \
               WHEN password_hash IS NOT NULL AND google_sub IS NOT NULL THEN 'both' \
               WHEN google_sub IS NOT NULL THEN 'google' \
               ELSE 'password' \
             END AS method, \
             COUNT(*)::bigint AS count \
             FROM users \
             GROUP BY 1 \
             ORDER BY 1",
        )
        .fetch_all(db),
    )
    .map_err(|e| map_err(e, "admin dashboard demographics failed"))?;

    Ok(DashboardDemographics {
        gender,
        age_buckets,
        countries,
        login_method,
    })
}

#[derive(FromRow)]
struct AvgFill {
    avg: Option<f64>,
}

pub async fn load_halaqat(db: &sqlx::PgPool) -> Result<DashboardHalaqat, StatusCode> {
    let (by_type, by_riwaya, by_enrollment_mode, fill_rate, avg) = tokio::try_join!(
        sqlx::query_as::<_, HalaqahTypeRow>(
            "SELECT halaqah_type::text AS halaqah_type, COUNT(*)::bigint AS count \
             FROM rooms GROUP BY 1 ORDER BY count DESC",
        )
        .fetch_all(db),
        sqlx::query_as::<_, RiwayaRow>(
            "SELECT riwaya, COUNT(*)::bigint AS count \
             FROM rooms GROUP BY 1 ORDER BY count DESC",
        )
        .fetch_all(db),
        sqlx::query_as::<_, EnrollmentModeRow>(
            "SELECT \
             CASE \
               WHEN NOT enrollment_open THEN 'closed' \
               WHEN is_public AND requires_approval THEN 'public_approval' \
               WHEN is_public THEN 'public_open' \
               WHEN requires_approval THEN 'private_approval' \
               ELSE 'private_open' \
             END AS mode, \
             COUNT(*)::bigint AS count \
             FROM rooms \
             GROUP BY 1 \
             ORDER BY count DESC",
        )
        .fetch_all(db),
        sqlx::query_as::<_, FillRateRow>(
            "SELECT r.id AS room_id, r.name, u.name AS teacher_name, \
             COUNT(e.id) FILTER (WHERE e.status = 'approved')::bigint AS enrolled, \
             r.max_students \
             FROM rooms r \
             JOIN users u ON u.id = r.teacher_id \
             LEFT JOIN enrollments e ON e.room_id = r.id \
             WHERE r.is_active \
             GROUP BY r.id, r.name, u.name, r.max_students \
             ORDER BY enrolled DESC \
             LIMIT 10",
        )
        .fetch_all(db),
        sqlx::query_as::<_, AvgFill>(
            "SELECT AVG(cnt)::float8 AS avg FROM ( \
               SELECT COUNT(e.id) FILTER (WHERE e.status = 'approved')::float8 AS cnt \
               FROM rooms r \
               LEFT JOIN enrollments e ON e.room_id = r.id \
               WHERE r.is_active \
               GROUP BY r.id \
             ) t",
        )
        .fetch_one(db),
    )
    .map_err(|e| map_err(e, "admin dashboard halaqat failed"))?;

    Ok(DashboardHalaqat {
        by_type,
        by_riwaya,
        by_enrollment_mode,
        fill_rate,
        avg_students_per_room: avg.avg,
    })
}

pub async fn load_teaching(db: &sqlx::PgPool) -> Result<DashboardTeaching, StatusCode> {
    let (grade_distribution, turn_type, annotation_categories, annotation_kind, top_surahs, top_teachers) =
        tokio::try_join!(
            sqlx::query_as::<_, GradeRow>(
                "SELECT grade::text AS grade, COUNT(*)::bigint AS count \
                 FROM recitations WHERE grade IS NOT NULL \
                 GROUP BY 1 ORDER BY count DESC",
            )
            .fetch_all(db),
            sqlx::query_as::<_, TurnTypeRow>(
                "SELECT turn_type::text AS turn_type, COUNT(*)::bigint AS count \
                 FROM recitations GROUP BY 1 ORDER BY count DESC",
            )
            .fetch_all(db),
            sqlx::query_as::<_, AnnotationCategoryRow>(
                "SELECT error_category::text AS category, error_severity::text AS severity, COUNT(*)::bigint AS count \
                 FROM error_annotations \
                 WHERE annotation_kind = 'error' \
                 GROUP BY 1, 2 \
                 ORDER BY count DESC \
                 LIMIT 10",
            )
            .fetch_all(db),
            sqlx::query_as::<_, AnnotationKindRow>(
                "SELECT annotation_kind::text AS kind, COUNT(*)::bigint AS count \
                 FROM error_annotations GROUP BY 1 ORDER BY count DESC",
            )
            .fetch_all(db),
            sqlx::query_as::<_, SurahCountRow>(
                "SELECT surah, COUNT(*)::bigint AS count \
                 FROM recitations GROUP BY 1 ORDER BY count DESC LIMIT 10",
            )
            .fetch_all(db),
            sqlx::query_as::<_, TopTeacherRow>(
                "SELECT u.id AS teacher_id, u.name, u.email, \
                 COALESCE(s.sessions, 0)::bigint AS sessions, \
                 COALESCE(r.recitations, 0)::bigint AS recitations, \
                 COALESCE(e.students, 0)::bigint AS students \
                 FROM users u \
                 LEFT JOIN ( \
                   SELECT rm.teacher_id, COUNT(*)::bigint AS sessions \
                   FROM sessions ses JOIN rooms rm ON rm.id = ses.room_id \
                   GROUP BY rm.teacher_id \
                 ) s ON s.teacher_id = u.id \
                 LEFT JOIN ( \
                   SELECT teacher_id, COUNT(*)::bigint AS recitations \
                   FROM recitations WHERE teacher_id IS NOT NULL \
                   GROUP BY teacher_id \
                 ) r ON r.teacher_id = u.id \
                 LEFT JOIN ( \
                   SELECT rm.teacher_id, COUNT(DISTINCT en.student_id)::bigint AS students \
                   FROM enrollments en \
                   JOIN rooms rm ON rm.id = en.room_id \
                   WHERE en.status = 'approved' \
                   GROUP BY rm.teacher_id \
                 ) e ON e.teacher_id = u.id \
                 WHERE u.role = 'teacher' \
                   AND (COALESCE(s.sessions, 0) > 0 OR COALESCE(r.recitations, 0) > 0) \
                 ORDER BY sessions DESC, recitations DESC \
                 LIMIT 10",
            )
            .fetch_all(db),
        )
        .map_err(|e| map_err(e, "admin dashboard teaching failed"))?;

    Ok(DashboardTeaching {
        grade_distribution,
        turn_type,
        annotation_categories,
        annotation_kind,
        top_surahs,
        top_teachers,
    })
}

#[derive(FromRow)]
struct SignupDbRow {
    week: NaiveDate,
    students: i64,
    teachers: i64,
}

#[derive(FromRow)]
struct SessionDbRow {
    week: NaiveDate,
    completed: i64,
    cancelled: i64,
}

#[derive(FromRow)]
struct RecitationDbRow {
    week: NaiveDate,
    count: i64,
    pages: Option<f64>,
}

#[derive(FromRow)]
struct AnnotationDbRow {
    week: NaiveDate,
    count: i64,
}

fn week_start_monday(d: NaiveDate) -> NaiveDate {
    let wd = d.weekday().num_days_from_monday() as i64;
    d - Duration::days(wd)
}

fn format_week(d: NaiveDate) -> String {
    d.format("%Y-%m-%d").to_string()
}

fn week_keys(range_days: i32, earliest: Option<NaiveDate>) -> Vec<NaiveDate> {
    let today = Utc::now().date_naive();
    let end = week_start_monday(today);
    let start = if range_days == 0 {
        week_start_monday(earliest.unwrap_or(today))
    } else {
        week_start_monday(today - Duration::days(range_days as i64))
    };
    let mut weeks = Vec::new();
    let mut cur = start;
    while cur <= end {
        weeks.push(cur);
        cur += Duration::days(7);
    }
    weeks
}

pub async fn load_timeseries(
    db: &sqlx::PgPool,
    range_days: i32,
) -> Result<DashboardTimeseries, StatusCode> {
    // 0 = all time (epoch). Otherwise bind an explicit timestamptz lower bound.
    let since = if range_days == 0 {
        DateTime::<Utc>::UNIX_EPOCH
    } else {
        Utc::now() - Duration::days(range_days as i64)
    };

    let (signups_raw, sessions_raw, recitations_raw, annotations_raw) = tokio::try_join!(
        sqlx::query_as::<_, SignupDbRow>(
            "SELECT date_trunc('week', created_at AT TIME ZONE 'UTC')::date AS week, \
             COUNT(*) FILTER (WHERE role = 'student')::bigint AS students, \
             COUNT(*) FILTER (WHERE role = 'teacher')::bigint AS teachers \
             FROM users \
             WHERE created_at >= $1 \
               AND role IN ('student', 'teacher') \
             GROUP BY 1 ORDER BY 1",
        )
        .bind(since)
        .fetch_all(db),
        sqlx::query_as::<_, SessionDbRow>(
            "SELECT date_trunc('week', scheduled_at AT TIME ZONE 'UTC')::date AS week, \
             COUNT(*) FILTER (WHERE status::text = 'completed')::bigint AS completed, \
             COUNT(*) FILTER (WHERE status::text = 'cancelled')::bigint AS cancelled \
             FROM sessions \
             WHERE scheduled_at >= $1 \
               AND status::text IN ('completed', 'cancelled', 'scheduled', 'in_progress') \
             GROUP BY 1 ORDER BY 1",
        )
        .bind(since)
        .fetch_all(db),
        sqlx::query_as::<_, RecitationDbRow>(
            "SELECT date_trunc('week', created_at AT TIME ZONE 'UTC')::date AS week, \
             COUNT(*)::bigint AS count, \
             COALESCE(SUM(pages_count), 0)::float8 AS pages \
             FROM recitations \
             WHERE created_at >= $1 \
             GROUP BY 1 ORDER BY 1",
        )
        .bind(since)
        .fetch_all(db),
        sqlx::query_as::<_, AnnotationDbRow>(
            "SELECT date_trunc('week', created_at AT TIME ZONE 'UTC')::date AS week, \
             COUNT(*)::bigint AS count \
             FROM error_annotations \
             WHERE created_at >= $1 \
             GROUP BY 1 ORDER BY 1",
        )
        .bind(since)
        .fetch_all(db),
    )
    .map_err(|e| map_err(e, "admin dashboard timeseries failed"))?;

    let earliest = [
        signups_raw.first().map(|r| r.week),
        sessions_raw.first().map(|r| r.week),
        recitations_raw.first().map(|r| r.week),
        annotations_raw.first().map(|r| r.week),
    ]
    .into_iter()
    .flatten()
    .min();

    let weeks = week_keys(range_days, earliest);

    let signup_map: HashMap<NaiveDate, &SignupDbRow> = signups_raw
        .iter()
        .map(|r| (week_start_monday(r.week), r))
        .collect();
    let session_map: HashMap<NaiveDate, &SessionDbRow> = sessions_raw
        .iter()
        .map(|r| (week_start_monday(r.week), r))
        .collect();
    let rec_map: HashMap<NaiveDate, &RecitationDbRow> = recitations_raw
        .iter()
        .map(|r| (week_start_monday(r.week), r))
        .collect();
    let ann_map: HashMap<NaiveDate, &AnnotationDbRow> = annotations_raw
        .iter()
        .map(|r| (week_start_monday(r.week), r))
        .collect();

    let signups = weeks
        .iter()
        .map(|w| {
            let row = signup_map.get(w);
            SignupWeekRow {
                week: format_week(*w),
                students: row.map(|r| r.students).unwrap_or(0),
                teachers: row.map(|r| r.teachers).unwrap_or(0),
            }
        })
        .collect();

    let sessions = weeks
        .iter()
        .map(|w| {
            let row = session_map.get(w);
            SessionWeekRow {
                week: format_week(*w),
                completed: row.map(|r| r.completed).unwrap_or(0),
                cancelled: row.map(|r| r.cancelled).unwrap_or(0),
            }
        })
        .collect();

    let recitations = weeks
        .iter()
        .map(|w| {
            let row = rec_map.get(w);
            RecitationWeekRow {
                week: format_week(*w),
                count: row.map(|r| r.count).unwrap_or(0),
                pages: row.and_then(|r| r.pages).unwrap_or(0.0),
            }
        })
        .collect();

    let annotations = weeks
        .iter()
        .map(|w| {
            let row = ann_map.get(w);
            AnnotationWeekRow {
                week: format_week(*w),
                count: row.map(|r| r.count).unwrap_or(0),
            }
        })
        .collect();

    Ok(DashboardTimeseries {
        signups,
        sessions,
        recitations,
        annotations,
    })
}
