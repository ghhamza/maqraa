// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::api::types::{ErrorAnnotationPublic, SessionStrokePublic};

/// Client → server messages.
#[derive(Deserialize)]
#[serde(tag = "type")]
#[allow(dead_code)]
pub enum ClientMessage {
    #[serde(rename = "mute")]
    Mute { muted: bool },

    #[serde(rename = "set-reciter")]
    SetReciter { user_id: Uuid },

    #[serde(rename = "clear-reciter")]
    ClearReciter,

    #[serde(rename = "current-ayah")]
    CurrentAyah { surah: i32, ayah: i32 },

    #[serde(rename = "clear-ayah")]
    ClearAyah,

    #[serde(rename = "current-page")]
    CurrentPage { page: i32 },

    #[serde(rename = "set-content-mode")]
    SetContentMode { mode: String },

    #[serde(rename = "grade-notification")]
    GradeNotification {
        student_id: Uuid,
        grade: String,
        notes: Option<String>,
    },

    #[serde(rename = "create-annotation")]
    CreateAnnotation {
        recitation_id: Uuid,
        surah: i32,
        ayah: i32,
        word_position: Option<i32>,
        error_severity: String,
        error_category: String,
        teacher_comment: Option<String>,
        annotation_kind: String,
    },

    #[serde(rename = "remove-annotation")]
    RemoveAnnotation { annotation_id: Uuid },

    /// Teacher freehand stroke (completed). `page` null = board surface.
    #[serde(rename = "stroke-add")]
    StrokeAdd {
        page: Option<i32>,
        points: serde_json::Value,
        color: String,
        width: f32,
    },

    /// Teacher: undo own most recent stroke on a surface (`page` null = board).
    /// Client sends the surface it is viewing — must not rely on broadcast `current_page`
    /// (teacher may have page-broadcast off or be ahead of room state).
    #[serde(rename = "stroke-undo")]
    StrokeUndo {
        #[serde(default)]
        page: Option<i32>,
    },

    /// Teacher: clear all strokes on a surface (`page` null = board).
    #[serde(rename = "strokes-clear")]
    StrokesClear { page: Option<i32> },

    #[serde(rename = "raise-hand")]
    RaiseHand,

    #[serde(rename = "lower-hand")]
    LowerHand,

    #[serde(rename = "ping")]
    Ping,
}

#[derive(Serialize, Clone)]
#[serde(tag = "type")]
pub enum ServerMessage {
    #[serde(rename = "room-state")]
    RoomState {
        participants: Vec<ParticipantInfo>,
        active_reciter_id: Option<Uuid>,
        current_ayah: Option<AyahPosition>,
        current_page: Option<i32>,
        /// Live content surface: `"mushaf"` | `"board"`.
        content_mode: String,
        /// Student user ids with hand raised (raise-time order).
        raised_hands: Vec<Uuid>,
        session_id: Uuid,
        room_id: Uuid,
    },

    #[serde(rename = "user-joined")]
    UserJoined { user: ParticipantInfo },

    #[serde(rename = "user-left")]
    UserLeft { user_id: Uuid },

    #[serde(rename = "reciter-changed")]
    ReciterChanged { user_id: Option<Uuid> },

    #[serde(rename = "mute-changed")]
    MuteChanged { user_id: Uuid, muted: bool },

    #[serde(rename = "current-ayah")]
    CurrentAyah { surah: i32, ayah: i32 },

    #[serde(rename = "ayah-cleared")]
    AyahCleared,

    #[serde(rename = "current-page")]
    CurrentPage { page: i32 },

    #[serde(rename = "content-mode-changed")]
    ContentModeChanged { mode: String },

    #[serde(rename = "error")]
    Error { message: String },

    #[serde(rename = "pong")]
    Pong,

    #[serde(rename = "session-ended")]
    SessionEnded,

    #[serde(rename = "grade-notification")]
    GradeNotification { grade: String, notes: Option<String> },

    #[serde(rename = "annotation-added")]
    AnnotationAdded { annotation: ErrorAnnotationPublic },

    #[serde(rename = "annotation-removed")]
    AnnotationRemoved { annotation_id: Uuid },

    #[serde(rename = "plan-status-changed")]
    PlanStatusChanged {
        recitation_id: Uuid,
        plan_status: String,
        /// Active reciter after this transition (`Some` when moving to in_progress).
        active_reciter_id: Option<Uuid>,
    },

    #[serde(rename = "stroke-added")]
    StrokeAdded { stroke: SessionStrokePublic },

    #[serde(rename = "stroke-removed")]
    StrokeRemoved { stroke_id: Uuid },

    #[serde(rename = "strokes-cleared")]
    StrokesCleared { page: Option<i32> },

    #[serde(rename = "hand-changed")]
    HandChanged { user_id: Uuid, raised: bool },
}

#[derive(Serialize, Clone)]
pub struct ParticipantInfo {
    pub user_id: Uuid,
    pub name: String,
    pub role: String,
    pub is_muted: bool,
    pub joined_at: DateTime<Utc>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct AyahPosition {
    pub surah: i32,
    pub ayah: i32,
}

impl ServerMessage {
    pub fn to_ws_text(&self) -> Result<String, serde_json::Error> {
        serde_json::to_string(self)
    }
}
