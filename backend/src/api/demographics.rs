// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

use axum::http::StatusCode;
use chrono::Datelike;
use serde::Deserialize;

/// Optional demographics accepted on register / Google signup / profile / admin update.
#[derive(Debug, Clone, Default, Deserialize)]
pub struct DemographicsInput {
    #[serde(default)]
    pub gender: Option<String>,
    #[serde(default)]
    pub birth_year: Option<i16>,
    #[serde(default)]
    pub country_code: Option<String>,
}

#[derive(Debug, Clone)]
pub struct ValidatedDemographics {
    pub gender: Option<String>,
    pub birth_year: Option<i16>,
    pub country_code: Option<String>,
}

/// Validate optional demographics. Empty / whitespace-only strings are treated as absent.
pub fn validate_demographics(
    input: &DemographicsInput,
) -> Result<ValidatedDemographics, StatusCode> {
    let gender = match input.gender.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        None => None,
        Some("male") => Some("male".to_string()),
        Some("female") => Some("female".to_string()),
        Some(_) => return Err(StatusCode::BAD_REQUEST),
    };

    let birth_year = match input.birth_year {
        None => None,
        Some(y) => {
            let current_year = chrono::Utc::now().year() as i16;
            if y < 1920 || y > current_year {
                return Err(StatusCode::BAD_REQUEST);
            }
            Some(y)
        }
    };

    let country_code = match input
        .country_code
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
    {
        None => None,
        Some(raw) => {
            let upper = raw.to_uppercase();
            if upper.len() != 2 || !upper.chars().all(|c| c.is_ascii_alphabetic()) {
                return Err(StatusCode::BAD_REQUEST);
            }
            Some(upper)
        }
    };

    Ok(ValidatedDemographics {
        gender,
        birth_year,
        country_code,
    })
}
