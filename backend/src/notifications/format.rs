// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

use chrono::{DateTime, Datelike, Timelike, Utc};
use chrono_tz::Tz;

use super::surah_names::surah_name;

fn to_arabic_numerals(value: &str) -> String {
    value
        .chars()
        .map(|c| match c {
            '0'..='9' => char::from_u32(0x0660 + (c as u32 - u8::from(b'0') as u32)).unwrap_or(c),
            _ => c,
        })
        .collect()
}

fn parse_display_tz(tz: &str) -> Tz {
    tz.parse().unwrap_or(chrono_tz::Asia::Riyadh)
}

fn tz_label(locale: &str, tz: &str) -> String {
    match (locale, tz) {
        ("ar", "Asia/Riyadh") => "توقيت الرياض".to_string(),
        (_, "Asia/Riyadh") => "Riyadh".to_string(),
        ("ar", _) => "التوقيت المحلي".to_string(),
        _ => tz.rsplit('/').next().unwrap_or(tz).replace('_', " "),
    }
}

const AR_WEEKDAYS: [&str; 7] = [
    "الأحد",
    "الإثنين",
    "الثلاثاء",
    "الأربعاء",
    "الخميس",
    "الجمعة",
    "السبت",
];

const AR_MONTHS: [&str; 12] = [
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

const EN_WEEKDAYS: [&str; 7] = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const EN_MONTHS: [&str; 12] = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

const FR_WEEKDAYS: [&str; 7] = ["dim.", "lun.", "mar.", "mer.", "jeu.", "ven.", "sam."];
const FR_MONTHS: [&str; 12] = [
    "janv.",
    "févr.",
    "mars",
    "avr.",
    "mai",
    "juin",
    "juil.",
    "août",
    "sept.",
    "oct.",
    "nov.",
    "déc.",
];

pub fn format_session_time(
    scheduled_at: DateTime<Utc>,
    locale: &str,
    display_tz: &str,
) -> String {
    let tz = parse_display_tz(display_tz);
    let local = scheduled_at.with_timezone(&tz);
    let zone = tz_label(locale, display_tz);

    match locale {
        "ar" => {
            let weekday = AR_WEEKDAYS[local.weekday().num_days_from_sunday() as usize];
            let month = AR_MONTHS[(local.month() as usize).saturating_sub(1)];
            let hour = local.hour();
            let minute = local.minute();
            let (h12, period) = if hour == 0 {
                (12, "ص")
            } else if hour < 12 {
                (hour, "ص")
            } else if hour == 12 {
                (12, "م")
            } else {
                (hour - 12, "م")
            };
            let time = format!("{h12}:{minute:02} {period}");
            let body = format!("{weekday} {} {month}، {time}", local.day());
            format!(
                "{} ({zone})",
                to_arabic_numerals(&body)
            )
        }
        "fr" => {
            let weekday = FR_WEEKDAYS[local.weekday().num_days_from_sunday() as usize];
            let month = FR_MONTHS[(local.month() as usize).saturating_sub(1)];
            format!(
                "{weekday} {} {month}, {:02}:{:02} ({zone})",
                local.day(),
                local.hour(),
                local.minute()
            )
        }
        _ => {
            let weekday = EN_WEEKDAYS[local.weekday().num_days_from_sunday() as usize];
            let month = EN_MONTHS[(local.month() as usize).saturating_sub(1)];
            let hour = local.hour();
            let minute = local.minute();
            let (h12, period) = if hour == 0 {
                (12, "AM")
            } else if hour < 12 {
                (hour, "AM")
            } else if hour == 12 {
                (12, "PM")
            } else {
                (hour - 12, "PM")
            };
            format!(
                "{weekday} {} {month}, {h12}:{minute:02} {period} ({zone})",
                local.day()
            )
        }
    }
}

pub fn format_count(n: usize, locale: &str) -> String {
    let s = n.to_string();
    if locale == "ar" {
        to_arabic_numerals(&s)
    } else {
        s
    }
}

pub fn role_label(role: &str, locale: &str) -> String {
    match (locale, role) {
        ("ar", "student") => "طالب".to_string(),
        ("ar", "teacher") => "معلّم".to_string(),
        ("ar", "admin") => "مشرف".to_string(),
        ("fr", "student") => "Étudiant".to_string(),
        ("fr", "teacher") => "Enseignant".to_string(),
        ("fr", "admin") => "Admin".to_string(),
        (_, "student") => "Student".to_string(),
        (_, "teacher") => "Teacher".to_string(),
        (_, "admin") => "Admin".to_string(),
        _ => role.to_string(),
    }
}

pub fn grade_label(grade: &str, locale: &str) -> String {
    match (locale, grade) {
        ("ar", "excellent") => "ممتاز".to_string(),
        ("ar", "good") => "جيد".to_string(),
        ("ar", "needs_work") => "يحتاج تحسين".to_string(),
        ("ar", "weak") => "ضعيف".to_string(),
        ("fr", "excellent") => "Excellent".to_string(),
        ("fr", "good") => "Bien".to_string(),
        ("fr", "needs_work") => "À améliorer".to_string(),
        ("fr", "weak") => "Faible".to_string(),
        (_, "excellent") => "Excellent".to_string(),
        (_, "good") => "Good".to_string(),
        (_, "needs_work") => "Needs work".to_string(),
        (_, "weak") => "Weak".to_string(),
        _ => grade.to_string(),
    }
}

pub fn recitation_ref(surah: i32, ayah_start: i32, ayah_end: i32, locale: &str) -> String {
    let name = surah_name(surah, locale);
    match locale {
        "ar" => {
            let range = if ayah_start == ayah_end {
                to_arabic_numerals(&ayah_start.to_string())
            } else {
                format!(
                    "{}–{}",
                    to_arabic_numerals(&ayah_start.to_string()),
                    to_arabic_numerals(&ayah_end.to_string())
                )
            };
            format!("سورة {name} {range}")
        }
        _ => {
            if ayah_start == ayah_end {
                format!("{name} {ayah_start}")
            } else {
                format!("{name} {ayah_start}–{ayah_end}")
            }
        }
    }
}
