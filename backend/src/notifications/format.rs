// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

use chrono::{DateTime, Datelike, Timelike, Utc};

use crate::timezone::{parse_tz, tz_city_label, validate_iana_timezone};

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

fn your_time_label(locale: &str) -> &'static str {
    match locale {
        "ar" => "بتوقيتك",
        "fr" => "votre heure",
        _ => "your time",
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

fn format_local_body(scheduled_at: DateTime<Utc>, locale: &str, display_tz: &str) -> String {
    let tz = parse_tz(display_tz);
    let local = scheduled_at.with_timezone(&tz);

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
            to_arabic_numerals(&body)
        }
        "fr" => {
            let weekday = FR_WEEKDAYS[local.weekday().num_days_from_sunday() as usize];
            let month = FR_MONTHS[(local.month() as usize).saturating_sub(1)];
            format!(
                "{weekday} {} {month}, {:02}:{:02}",
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
            format!("{weekday} {} {month}, {h12}:{minute:02} {period}", local.day())
        }
    }
}

pub fn format_session_time(
    scheduled_at: DateTime<Utc>,
    locale: &str,
    display_tz: &str,
) -> String {
    let body = format_local_body(scheduled_at, locale, display_tz);
    let zone = tz_city_label(locale, display_tz);
    format!("{body} ({zone})")
}

/// Room time labeled with city; when `user_tz` differs, appends the recipient's local time.
pub fn format_session_time_dual(
    scheduled_at: DateTime<Utc>,
    locale: &str,
    room_tz: &str,
    user_tz: Option<&str>,
) -> String {
    let room = format_session_time(scheduled_at, locale, room_tz);
    let Some(utz) = user_tz.and_then(validate_iana_timezone) else {
        return room;
    };
    if utz == room_tz.trim() {
        return room;
    }
    let user_body = format_local_body(scheduled_at, locale, utz);
    format!("{room} · {user_body} ({})", your_time_label(locale))
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

/// Localized label for `error_category` enum values (matches frontend `error.*` keys).
pub fn error_category_label(category: &str, locale: &str) -> String {
    match (locale, category) {
        ("ar", "harf") => "حرف".to_string(),
        ("ar", "haraka") => "حركة".to_string(),
        ("ar", "kalima") => "كلمة".to_string(),
        ("ar", "waqf_qabih") => "وقف قبيح".to_string(),
        ("ar", "makharij") => "مخارج".to_string(),
        ("ar", "sifat") => "صفات".to_string(),
        ("ar", "tafkhim") => "تفخيم/ترقيق".to_string(),
        ("ar", "madd") => "مدّ".to_string(),
        ("ar", "ghunnah") => "غنّة".to_string(),
        ("ar", "noon_sakin") => "نون ساكنة".to_string(),
        ("ar", "meem_sakin") => "ميم ساكنة".to_string(),
        ("ar", "waqf_ibtida") => "وقف/ابتداء".to_string(),
        ("ar", "shadda") => "شدّة".to_string(),
        ("ar", "other") => "أخرى".to_string(),
        ("fr", "harf") => "Lettre".to_string(),
        ("fr", "haraka") => "Voyelle".to_string(),
        ("fr", "kalima") => "Mot".to_string(),
        ("fr", "waqf_qabih") => "Arrêt interdit".to_string(),
        ("fr", "makharij") => "Articulation".to_string(),
        ("fr", "sifat") => "Caractéristiques".to_string(),
        ("fr", "tafkhim") => "Lourd/léger".to_string(),
        ("fr", "madd") => "Allongement".to_string(),
        ("fr", "ghunnah") => "Nasalisation".to_string(),
        ("fr", "noon_sakin") => "Règles noun".to_string(),
        ("fr", "meem_sakin") => "Règles mim".to_string(),
        ("fr", "waqf_ibtida") => "Arrêt/reprise".to_string(),
        ("fr", "shadda") => "Accentuation".to_string(),
        ("fr", "other") => "Autre".to_string(),
        (_, "harf") => "Letter".to_string(),
        (_, "haraka") => "Vowel".to_string(),
        (_, "kalima") => "Word".to_string(),
        (_, "waqf_qabih") => "Bad stop".to_string(),
        (_, "makharij") => "Articulation".to_string(),
        (_, "sifat") => "Characteristics".to_string(),
        (_, "tafkhim") => "Heavy/light".to_string(),
        (_, "madd") => "Elongation".to_string(),
        (_, "ghunnah") => "Nasalization".to_string(),
        (_, "noon_sakin") => "Noon rules".to_string(),
        (_, "meem_sakin") => "Meem rules".to_string(),
        (_, "waqf_ibtida") => "Stop/start".to_string(),
        (_, "shadda") => "Emphasis".to_string(),
        (_, "other") => "Other".to_string(),
        _ => category.to_string(),
    }
}

/// Format top error categories like `"مدّ (2)، غنّة (1)"`.
pub fn corrections_summary_line(categories: &[(String, i64)], locale: &str) -> String {
    let sep = if locale == "ar" { "، " } else { ", " };
    categories
        .iter()
        .map(|(cat, n)| {
            format!(
                "{} ({})",
                error_category_label(cat, locale),
                format_count(*n as usize, locale)
            )
        })
        .collect::<Vec<_>>()
        .join(sep)
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
