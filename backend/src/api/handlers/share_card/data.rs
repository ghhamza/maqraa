// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

use chrono::{DateTime, Datelike, Timelike, Utc};
use chrono_tz::Tz;
use sqlx::FromRow;
use uuid::Uuid;

use crate::api::AppState;
use crate::models::share_link::ShareLink;

#[derive(Debug, Clone)]
pub struct PublicHalaqah {
    pub token: String,
    pub room_id: Uuid,
    pub name: String,
    pub teacher_name: String,
    pub riwaya: String,
    pub halaqah_type: String,
    pub max_students: i32,
    pub enrolled_count: i64,
    pub description: Option<String>,
    pub created_at: DateTime<Utc>,
    pub first_session_at: Option<DateTime<Utc>>,
    pub schedule_days: Vec<i16>,
    pub timezone: String,
}

pub enum ShareCardError {
    NotFound,
    Db(sqlx::Error),
}

#[derive(FromRow)]
struct RoomRow {
    id: Uuid,
    name: String,
    teacher_name: String,
    riwaya: String,
    halaqah_type: String,
    max_students: i32,
    description: Option<String>,
    created_at: DateTime<Utc>,
    enrolled_count: i64,
    is_active: bool,
    timezone: String,
}

const LINK_COLS: &str = "id, token, target_type, target_id, created_by, auto_approve, \
     email_bound, expires_at, max_uses, use_count, join_count, revoked_at, created_at";

/// Resolve a public halaqah share token without incrementing `use_count`.
/// Returns NotFound for revoked/expired links or archived rooms.
pub async fn resolve_public_halaqah(
    state: &AppState,
    token: &str,
) -> Result<PublicHalaqah, ShareCardError> {
    let token = token.trim();
    if token.is_empty() {
        return Err(ShareCardError::NotFound);
    }

    let link: Option<ShareLink> = sqlx::query_as(&format!(
        "SELECT {LINK_COLS} FROM share_links \
         WHERE token = $1 \
         AND revoked_at IS NULL \
         AND (expires_at IS NULL OR expires_at > NOW()) \
         AND (max_uses IS NULL OR use_count < max_uses)"
    ))
    .bind(token)
    .fetch_optional(&state.db)
    .await
    .map_err(ShareCardError::Db)?;

    let link = link.ok_or(ShareCardError::NotFound)?;
    if link.target_type != "halaqah" && link.target_type != "invite" {
        return Err(ShareCardError::NotFound);
    }
    let room_id = link.target_id.ok_or(ShareCardError::NotFound)?;

    let room: Option<RoomRow> = sqlx::query_as(
        "SELECT r.id, r.name, u.name AS teacher_name, r.riwaya, r.halaqah_type::text AS halaqah_type, \
         r.max_students, r.description, r.created_at, r.is_active, r.timezone, \
         (SELECT COUNT(*)::bigint FROM enrollments e \
          WHERE e.room_id = r.id AND e.status = 'approved') AS enrolled_count \
         FROM rooms r \
         INNER JOIN users u ON u.id = r.teacher_id \
         WHERE r.id = $1",
    )
    .bind(room_id)
    .fetch_optional(&state.db)
    .await
    .map_err(ShareCardError::Db)?;

    let room = room.ok_or(ShareCardError::NotFound)?;
    if !room.is_active {
        return Err(ShareCardError::NotFound);
    }

    let first_session_at: Option<DateTime<Utc>> = sqlx::query_scalar(
        "SELECT scheduled_at FROM sessions \
         WHERE room_id = $1 AND status::text = 'scheduled' AND scheduled_at >= NOW() \
         ORDER BY scheduled_at ASC LIMIT 1",
    )
    .bind(room_id)
    .fetch_optional(&state.db)
    .await
    .map_err(ShareCardError::Db)?;

    let first_session_at = match first_session_at {
        Some(at) => Some(at),
        None => {
            sqlx::query_scalar(
                "SELECT scheduled_at FROM sessions \
                 WHERE room_id = $1 AND status::text = 'scheduled' \
                 ORDER BY scheduled_at DESC LIMIT 1",
            )
            .bind(room_id)
            .fetch_optional(&state.db)
            .await
            .map_err(ShareCardError::Db)?
        }
    };

    let schedule_days: Vec<(i16,)> = sqlx::query_as(
        "SELECT day_of_week FROM schedules \
         WHERE room_id = $1 AND is_active = true \
         ORDER BY day_of_week",
    )
    .bind(room_id)
    .fetch_all(&state.db)
    .await
    .map_err(ShareCardError::Db)?;

    Ok(PublicHalaqah {
        token: link.token,
        room_id: room.id,
        name: room.name,
        teacher_name: room.teacher_name,
        riwaya: room.riwaya,
        halaqah_type: room.halaqah_type,
        max_students: room.max_students,
        enrolled_count: room.enrolled_count,
        description: room.description,
        created_at: room.created_at,
        first_session_at,
        schedule_days: schedule_days.into_iter().map(|(d,)| d).collect(),
        timezone: room.timezone,
    })
}

pub fn truncate_chars(s: &str, max: usize) -> String {
    let count = s.chars().count();
    if count <= max {
        return s.to_string();
    }
    let mut out: String = s.chars().take(max.saturating_sub(1)).collect();
    out.push('…');
    out
}

pub fn arabic_type_label(value: &str) -> &str {
    match value {
        "hifz" => "حفظ",
        "tilawa" => "تلاوة",
        "muraja" => "مراجعة",
        "tajweed" => "تجويد",
        _ => value,
    }
}

pub fn arabic_riwaya_label(value: &str) -> &str {
    match value {
        "hafs" => "حفص",
        "warsh" => "ورش",
        _ => value,
    }
}

fn to_arabic_indic(s: &str) -> String {
    s.chars()
        .map(|c| match c {
            '0' => '٠',
            '1' => '١',
            '2' => '٢',
            '3' => '٣',
            '4' => '٤',
            '5' => '٥',
            '6' => '٦',
            '7' => '٧',
            '8' => '٨',
            '9' => '٩',
            _ => c,
        })
        .collect()
}

const WEEKDAYS_AR: [&str; 7] = [
    "الإثنين",
    "الثلاثاء",
    "الأربعاء",
    "الخميس",
    "الجمعة",
    "السبت",
    "الأحد",
];

const MONTHS_AR: [&str; 12] = [
    "يناير",
    "فبراير",
    "مارس",
    "أبريل",
    "مايو",
    "يونيو",
    "يوليو",
    "أغسطس",
    "سبتمبر",
    "أكتوبر",
    "نوفمبر",
    "ديسمبر",
];

/// Format like: `الثلاثاء ٢٥ أغسطس · ٨:٠٠ م` in the given IANA timezone.
pub fn format_session_ar(at: DateTime<Utc>, tz_name: &str) -> String {
    let tz: Tz = tz_name.parse().unwrap_or(chrono_tz::Asia::Riyadh);
    let local = at.with_timezone(&tz);
    // chrono weekday: Mon=0 in our WEEKDAYS_AR (matches schedules day_of_week)
    let wd = local.weekday().num_days_from_monday() as usize;
    let day = to_arabic_indic(&local.day().to_string());
    let month = MONTHS_AR.get(local.month0() as usize).copied().unwrap_or("");
    let weekday = WEEKDAYS_AR.get(wd).copied().unwrap_or("");

    let (hour12, period) = {
        let h = local.hour();
        if h == 0 {
            (12, "ص")
        } else if h < 12 {
            (h, "ص")
        } else if h == 12 {
            (12, "م")
        } else {
            (h - 12, "م")
        }
    };
    let minute = to_arabic_indic(&format!("{:02}", local.minute()));
    let hour = to_arabic_indic(&hour12.to_string());
    format!("{weekday} {day} {month} · {hour}:{minute} {period}")
}

/// Weekly rhythm days only (no timezone label). Empty when no schedule days.
pub fn format_rhythm_ar(days: &[i16]) -> String {
    if days.is_empty() {
        return String::new();
    }
    let names: Vec<&str> = days
        .iter()
        .filter_map(|d| WEEKDAYS_AR.get(*d as usize).copied())
        .collect();
    if names.is_empty() {
        return String::new();
    }
    format!("{} أسبوعيًا", names.join(" و"))
}

pub fn seats_available(h: &PublicHalaqah) -> i64 {
    (h.max_students as i64 - h.enrolled_count).max(0)
}

pub fn short_display_url(base: &str, token: &str) -> String {
    let host = base
        .trim_start_matches("https://")
        .trim_start_matches("http://")
        .trim_end_matches('/');
    let prefix: String = token.chars().take(8).collect();
    format!("{host}/s/{prefix}")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn truncate_adds_ellipsis() {
        let s = "حلقة تجريبية طويلة جداً للاختبار هنا";
        let out = truncate_chars(s, 10);
        assert!(out.ends_with('…'));
        assert_eq!(out.chars().count(), 10);
    }
}
