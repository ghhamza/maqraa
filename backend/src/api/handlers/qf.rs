// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

use std::collections::HashMap;

use axum::{
    extract::{Path, State},
    http::{header::CACHE_CONTROL, HeaderMap, HeaderValue, StatusCode},
    Json,
};
use serde::Serialize;

use crate::api::AppState;
use crate::qf::content::{DEFAULT_RECITATION_ID, QF_CHAPTER_AUDIO_NOT_FOUND};

#[derive(Serialize)]
pub struct QfErrorBody {
    pub code: String,
    pub message: String,
}

type QfResult<T> = Result<T, (StatusCode, Json<QfErrorBody>)>;

fn qf_err(
    status: StatusCode,
    code: impl Into<String>,
    message: impl Into<String>,
) -> (StatusCode, Json<QfErrorBody>) {
    (
        status,
        Json(QfErrorBody {
            code: code.into(),
            message: message.into(),
        }),
    )
}

#[derive(Serialize)]
pub struct ChapterAudioResponse {
    pub chapter: i32,
    pub recitation_id: i32,
    /// Map of verse_key ("1:1") -> full CDN URL
    pub audio_files: HashMap<String, String>,
}

pub async fn get_chapter_audio(
    State(state): State<AppState>,
    Path((recitation_id, chapter)): Path<(i32, i32)>,
) -> QfResult<(HeaderMap, Json<ChapterAudioResponse>)> {
    if !(1..=114).contains(&chapter) {
        return Err(qf_err(
            StatusCode::BAD_REQUEST,
            "invalid_chapter",
            "chapter must be 1-114",
        ));
    }
    if recitation_id < 1 || recitation_id > 200 {
        return Err(qf_err(
            StatusCode::BAD_REQUEST,
            "invalid_recitation",
            "recitation_id out of range",
        ));
    }

    let candidates: Vec<i32> = if recitation_id == DEFAULT_RECITATION_ID {
        vec![DEFAULT_RECITATION_ID, 6, 7]
    } else {
        vec![recitation_id]
    };
    let mut chosen_recitation_id = recitation_id;
    let mut map_opt: Option<HashMap<String, String>> = None;
    let mut fetch_errors: Vec<anyhow::Error> = Vec::new();
    for candidate in &candidates {
        match state
            .content_api
            .get_chapter_audio_files(chapter, *candidate)
            .await
        {
            Ok(map) => {
                chosen_recitation_id = *candidate;
                map_opt = Some(map);
                break;
            }
            Err(e) => {
                fetch_errors.push(e);
            }
        }
    }
    let map = match map_opt {
        Some(m) => m,
        None => {
            let all_not_found = !fetch_errors.is_empty()
                && fetch_errors
                    .iter()
                    .all(|e| e.to_string() == QF_CHAPTER_AUDIO_NOT_FOUND);
            if all_not_found {
                tracing::debug!(
                    chapter,
                    requested_recitation_id = recitation_id,
                    candidates = ?candidates,
                    "QF chapter audio not available for any recitation fallback (404)"
                );
                return Err(qf_err(
                    StatusCode::NOT_FOUND,
                    "qf_audio_not_found",
                    "Audio not available for this chapter from Quran Foundation",
                ));
            }
            if let Some(e) = fetch_errors.last() {
                tracing::error!(
                    error = %e,
                    chapter,
                    requested_recitation_id = recitation_id,
                    "QF audio fetch failed"
                );
            }
            return Err(qf_err(
                StatusCode::BAD_GATEWAY,
                "qf_upstream_error",
                "failed to fetch audio from Quran Foundation",
            ));
        }
    };

    let mut headers = HeaderMap::new();
    headers.insert(
        CACHE_CONTROL,
        HeaderValue::from_static("public, max-age=86400"),
    );
    Ok((
        headers,
        Json(ChapterAudioResponse {
            chapter,
            recitation_id: chosen_recitation_id,
            audio_files: map,
        }),
    ))
}
