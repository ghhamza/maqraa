// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

use chrono::{DateTime, Utc};
use serde::Serialize;
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Serialize)]
pub struct AdminDashboard {
    pub generated_at: DateTime<Utc>,
    pub range_days: i32,
    pub totals: DashboardTotals,
    pub activity: DashboardActivity,
    pub demographics: DashboardDemographics,
    pub halaqat: DashboardHalaqat,
    pub teaching: DashboardTeaching,
    pub timeseries: DashboardTimeseries,
}

#[derive(Serialize, Default)]
pub struct DashboardTotals {
    pub users: i64,
    pub students: i64,
    pub teachers: i64,
    pub admins: i64,
    pub rooms: i64,
    pub rooms_active: i64,
    pub rooms_archived: i64,
    pub sessions: i64,
    pub sessions_completed: i64,
    pub sessions_scheduled: i64,
    pub sessions_in_progress: i64,
    pub sessions_cancelled: i64,
    pub enrollments_approved: i64,
    pub enrollments_pending: i64,
    pub recitations: i64,
    pub pages_recited: f64,
    pub annotations: i64,
    pub annotations_open: i64,
    pub share_links: i64,
    pub share_link_joins: i64,
}

#[derive(Serialize, Default)]
pub struct DashboardActivity {
    pub new_users_7d: i64,
    pub new_users_30d: i64,
    pub active_teachers_7d: i64,
    pub active_teachers_30d: i64,
    pub active_students_7d: i64,
    pub active_students_30d: i64,
    pub sessions_7d: i64,
    pub sessions_30d: i64,
    pub avg_star_rating: Option<f64>,
    pub avg_session_duration_minutes: Option<f64>,
}

#[derive(Serialize)]
pub struct DashboardDemographics {
    pub gender: Vec<GenderRow>,
    pub age_buckets: Vec<AgeBucketRow>,
    pub countries: Vec<CountryRow>,
    pub login_method: Vec<LoginMethodRow>,
}

#[derive(Serialize, FromRow)]
pub struct GenderRow {
    pub gender: String,
    pub students: i64,
    pub teachers: i64,
}

#[derive(Serialize, FromRow)]
pub struct AgeBucketRow {
    pub bucket: String,
    pub students: i64,
    pub teachers: i64,
}

#[derive(Serialize, FromRow)]
pub struct CountryRow {
    pub country_code: String,
    pub users: i64,
    pub students: i64,
    pub teachers: i64,
}

#[derive(Serialize, FromRow)]
pub struct LoginMethodRow {
    pub method: String,
    pub count: i64,
}

#[derive(Serialize)]
pub struct DashboardHalaqat {
    pub by_type: Vec<HalaqahTypeRow>,
    pub by_riwaya: Vec<RiwayaRow>,
    pub by_enrollment_mode: Vec<EnrollmentModeRow>,
    pub fill_rate: Vec<FillRateRow>,
    pub avg_students_per_room: Option<f64>,
}

#[derive(Serialize, FromRow)]
pub struct HalaqahTypeRow {
    pub halaqah_type: String,
    pub count: i64,
}

#[derive(Serialize, FromRow)]
pub struct RiwayaRow {
    pub riwaya: String,
    pub count: i64,
}

#[derive(Serialize, FromRow)]
pub struct EnrollmentModeRow {
    pub mode: String,
    pub count: i64,
}

#[derive(Serialize, FromRow)]
pub struct FillRateRow {
    pub room_id: Uuid,
    pub name: String,
    pub teacher_name: String,
    pub enrolled: i64,
    pub max_students: i32,
}

#[derive(Serialize)]
pub struct DashboardTeaching {
    pub grade_distribution: Vec<GradeRow>,
    pub turn_type: Vec<TurnTypeRow>,
    pub annotation_categories: Vec<AnnotationCategoryRow>,
    pub annotation_kind: Vec<AnnotationKindRow>,
    pub top_surahs: Vec<SurahCountRow>,
    pub top_teachers: Vec<TopTeacherRow>,
}

#[derive(Serialize, FromRow)]
pub struct GradeRow {
    pub grade: String,
    pub count: i64,
}

#[derive(Serialize, FromRow)]
pub struct TurnTypeRow {
    pub turn_type: String,
    pub count: i64,
}

#[derive(Serialize, FromRow)]
pub struct AnnotationCategoryRow {
    pub category: String,
    pub severity: String,
    pub count: i64,
}

#[derive(Serialize, FromRow)]
pub struct AnnotationKindRow {
    pub kind: String,
    pub count: i64,
}

#[derive(Serialize, FromRow)]
pub struct SurahCountRow {
    pub surah: i32,
    pub count: i64,
}

#[derive(Serialize, FromRow)]
pub struct TopTeacherRow {
    pub teacher_id: Uuid,
    pub name: String,
    pub email: String,
    pub sessions: i64,
    pub recitations: i64,
    pub students: i64,
}

#[derive(Serialize)]
pub struct DashboardTimeseries {
    pub signups: Vec<SignupWeekRow>,
    pub sessions: Vec<SessionWeekRow>,
    pub recitations: Vec<RecitationWeekRow>,
    pub annotations: Vec<AnnotationWeekRow>,
}

#[derive(Serialize, Clone)]
pub struct SignupWeekRow {
    pub week: String,
    pub students: i64,
    pub teachers: i64,
}

#[derive(Serialize, Clone)]
pub struct SessionWeekRow {
    pub week: String,
    pub completed: i64,
    pub cancelled: i64,
}

#[derive(Serialize, Clone)]
pub struct RecitationWeekRow {
    pub week: String,
    pub count: i64,
    pub pages: f64,
}

#[derive(Serialize, Clone)]
pub struct AnnotationWeekRow {
    pub week: String,
    pub count: i64,
}
