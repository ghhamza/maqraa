// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

use chrono_tz::Tz;

const DEFAULT_TZ: &str = "Asia/Riyadh";

/// Returns the IANA name if `s` parses as a valid chrono_tz zone; rejects malformed input.
pub fn validate_iana_timezone(s: &str) -> Option<&str> {
    let trimmed = s.trim();
    if trimmed.is_empty() {
        return None;
    }
    trimmed.parse::<Tz>().ok().map(|_| trimmed)
}

/// Parse an IANA timezone, falling back to Asia/Riyadh only when invalid.
pub fn parse_tz(s: &str) -> Tz {
    validate_iana_timezone(s)
        .and_then(|name| name.parse().ok())
        .unwrap_or(chrono_tz::Asia::Riyadh)
}

/// City label for common zones; otherwise the IANA city segment (underscores → spaces).
pub fn tz_city_label(locale: &str, tz: &str) -> String {
    let is_ar = locale == "ar";
    match tz.trim() {
        "Asia/Riyadh" => {
            if is_ar {
                "الرياض".to_string()
            } else {
                "Riyadh".to_string()
            }
        }
        "Africa/Cairo" => {
            if is_ar {
                "القاهرة".to_string()
            } else {
                "Cairo".to_string()
            }
        }
        "Africa/Algiers" => {
            if is_ar {
                "الجزائر".to_string()
            } else {
                "Algiers".to_string()
            }
        }
        "Africa/Casablanca" => {
            if is_ar {
                "الدار البيضاء".to_string()
            } else {
                "Casablanca".to_string()
            }
        }
        "Europe/Paris" => {
            if is_ar {
                "باريس".to_string()
            } else {
                "Paris".to_string()
            }
        }
        other => other
            .rsplit('/')
            .next()
            .unwrap_or(other)
            .replace('_', " "),
    }
}

/// Default IANA zone used when none is provided.
pub fn default_timezone() -> &'static str {
    DEFAULT_TZ
}
