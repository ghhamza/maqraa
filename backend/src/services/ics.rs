// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

use axum::{
    http::{header, HeaderMap, HeaderValue, StatusCode},
    response::{IntoResponse, Response},
};
use chrono::{DateTime, Duration, Utc};
use uuid::Uuid;

/// Input for a single-session calendar export (no student data).
pub struct SessionIcsInput {
    pub session_id: Uuid,
    pub title: Option<String>,
    pub room_name: String,
    pub teacher_name: String,
    pub scheduled_at: DateTime<Utc>,
    pub duration_minutes: i32,
    pub join_url: String,
}

/// Escape free-text values per RFC 5545 (backslash, comma, semicolon, newlines).
pub fn escape_ics_text(value: &str) -> String {
    value
        .replace('\\', "\\\\")
        .replace(';', "\\;")
        .replace(',', "\\,")
        .replace('\r', "")
        .replace('\n', "\\n")
}

fn format_ics_utc(dt: DateTime<Utc>) -> String {
    dt.format("%Y%m%dT%H%M%SZ").to_string()
}

/// Fold a single content line to 75 octets max (RFC 5545).
fn fold_ics_line(line: &str) -> Vec<String> {
    if line.len() <= 75 {
        return vec![line.to_string()];
    }

    let mut lines = Vec::new();
    let mut start = 0;

    while start < line.len() {
        let max_bytes = if lines.is_empty() { 75 } else { 74 };
        let mut end = start;
        let mut used = 0usize;

        while end < line.len() {
            let ch = line[end..].chars().next().expect("valid utf-8");
            let nbytes = ch.len_utf8();
            if used + nbytes > max_bytes {
                break;
            }
            used += nbytes;
            end += nbytes;
        }

        if end == start {
            // Single codepoint wider than max — emit one char to avoid infinite loop.
            let ch = line[start..].chars().next().expect("valid utf-8");
            end = start + ch.len_utf8();
        }

        let segment = &line[start..end];
        if lines.is_empty() {
            lines.push(segment.to_string());
        } else {
            lines.push(format!(" {segment}"));
        }
        start = end;
    }

    lines
}

fn push_property(out: &mut Vec<String>, name: &str, value: &str) {
    out.extend(fold_ics_line(&format!("{name}:{value}")));
}

pub fn build_session_ics(input: &SessionIcsInput) -> String {
    let summary_raw = input
        .title
        .as_deref()
        .filter(|t| !t.trim().is_empty())
        .unwrap_or(&input.room_name);
    let summary = escape_ics_text(summary_raw);

    let description_raw = format!(
        "«{}» — {}\n{}",
        input.room_name, input.teacher_name, input.join_url
    );
    let description = escape_ics_text(&description_raw);
    let url = escape_ics_text(&input.join_url);

    let dtstart = format_ics_utc(input.scheduled_at);
    let dtend = format_ics_utc(
        input.scheduled_at
            + Duration::minutes(input.duration_minutes.max(1) as i64),
    );
    let dtstamp = format_ics_utc(Utc::now());
    let uid = format!("{}@maqraa.org", input.session_id);

    let mut lines = Vec::new();
    lines.push("BEGIN:VCALENDAR".to_string());
    push_property(&mut lines, "PRODID", "-//Al-Maqraa//Sessions//AR");
    push_property(&mut lines, "VERSION", "2.0");
    push_property(&mut lines, "METHOD", "PUBLISH");
    lines.push("BEGIN:VEVENT".to_string());
    push_property(&mut lines, "UID", &uid);
    push_property(&mut lines, "DTSTAMP", &dtstamp);
    push_property(&mut lines, "DTSTART", &dtstart);
    push_property(&mut lines, "DTEND", &dtend);
    push_property(&mut lines, "SUMMARY", &summary);
    push_property(&mut lines, "DESCRIPTION", &description);
    push_property(&mut lines, "URL", &url);
    push_property(&mut lines, "SEQUENCE", "0");
    lines.push("END:VEVENT".to_string());
    lines.push("END:VCALENDAR".to_string());

    let mut body = String::new();
    for line in lines {
        body.push_str(&line);
        body.push_str("\r\n");
    }
    body
}

pub fn ics_calendar_response(body: String) -> Response {
    let mut headers = HeaderMap::new();
    headers.insert(
        header::CONTENT_TYPE,
        HeaderValue::from_static("text/calendar; charset=utf-8"),
    );
    headers.insert(
        header::CONTENT_DISPOSITION,
        HeaderValue::from_static("attachment; filename=\"halaqah-session.ics\""),
    );
    (StatusCode::OK, headers, body).into_response()
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::TimeZone;

    #[test]
    fn escapes_special_characters_in_summary() {
        let input = SessionIcsInput {
            session_id: Uuid::nil(),
            title: Some("Test, part; one\\two\nthree".to_string()),
            room_name: "Room".to_string(),
            teacher_name: "Teacher".to_string(),
            scheduled_at: Utc.with_ymd_and_hms(2026, 6, 19, 10, 0, 0).unwrap(),
            duration_minutes: 60,
            join_url: "https://app.maqraa.org/sessions/abc".to_string(),
        };
        let ics = build_session_ics(&input);
        assert!(ics.contains("SUMMARY:Test\\, part\\; one\\\\two\\nthree"));
        assert!(ics.contains("BEGIN:VCALENDAR"));
        assert!(ics.contains("END:VEVENT"));
    }
}
