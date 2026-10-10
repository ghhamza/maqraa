// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

use axum::{
    http::{header, HeaderValue, Method},
    routing::{delete, get, post, put},
    Router,
};
use tower_http::cors::{AllowOrigin, Any, CorsLayer};
use tower_http::trace::TraceLayer;

use super::handlers;
use super::ws;
use super::AppState;

fn website_cors(origins: &[String]) -> CorsLayer {
    let allowed: Vec<HeaderValue> = origins
        .iter()
        .filter_map(|o| HeaderValue::from_str(o).ok())
        .collect();
    CorsLayer::new()
        .allow_origin(AllowOrigin::list(allowed))
        .allow_methods([Method::GET, Method::OPTIONS])
        .vary([header::ORIGIN])
}

pub fn build_router(state: AppState) -> Router {
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    let website = Router::new()
        .route(
            "/api/public/halaqat",
            get(handlers::public_halaqat::list_public_halaqat),
        )
        .with_state(state.clone())
        .layer(website_cors(&state.config.website_origins));

    Router::new()
        .route(
            "/health",
            get(|| async { "بسم الله — Al-Maqraa is running" }),
        )
        .route("/s/{token}", get(handlers::share::share_landing))
        .route("/s/{token}/card.png", get(handlers::share_card::share_card_png))
        .route("/s/{token}/ics", get(handlers::share::share_ics))
        .route("/api/auth/register", post(handlers::auth::register))
        .route("/api/auth/login", post(handlers::auth::login))
        .route("/api/auth/google", post(handlers::auth::google_auth))
        .route("/api/config", get(handlers::auth::public_config))
        .route("/api/auth/verify-email", post(handlers::auth::verify_email))
        .route(
            "/api/auth/resend-verification",
            post(handlers::auth::resend_verification),
        )
        .route("/api/auth/password/forgot", post(handlers::auth::forgot_password))
        .route("/api/auth/password/reset", post(handlers::auth::reset_password))
        .route(
            "/api/auth/me",
            get(handlers::auth::me).put(handlers::auth::update_profile),
        )
        .route("/api/auth/profile", put(handlers::auth::update_auth_profile))
        .route("/api/me/whats-new", get(handlers::auth::whats_new))
        .route("/api/auth/password", put(handlers::auth::change_password))
        .route("/api/profile", put(handlers::profile::complete_profile))
        .route(
            "/api/quran/recitations/{recitation_id}/by_chapter/{chapter}",
            get(handlers::qf::get_chapter_audio),
        )
        .route("/api/users/stats", get(handlers::users::stats))
        .route("/api/admin/dashboard", get(handlers::admin::dashboard))
        .route("/api/admin/funnel", get(handlers::admin::funnel))
        .route(
            "/api/admin/rooms/{id}/website-listing",
            put(handlers::public_halaqat::set_website_listing),
        )
        .route(
            "/api/product-events",
            post(handlers::product_events::track_client_event),
        )
        .route(
            "/api/users",
            get(handlers::users::list_users).post(handlers::users::create_user),
        )
        .route(
            "/api/users/{id}",
            get(handlers::users::get_user)
                .put(handlers::users::update_user)
                .delete(handlers::users::delete_user),
        )
        .route(
            "/api/users/{id}/send-session-guide",
            post(handlers::users::send_session_guide),
        )
        .route(
            "/api/users/{id}/send-profile-reminder",
            post(handlers::users::send_profile_reminder),
        )
        .route(
            "/api/users/{id}/preview-custom-email",
            post(handlers::users::preview_custom_email),
        )
        .route(
            "/api/users/{id}/send-custom-email",
            post(handlers::users::send_custom_email),
        )
        .route(
            "/api/users/{id}/notifications",
            get(handlers::users::list_user_notifications),
        )
        .route(
            "/api/users/{id}/notifications/{notification_id}/resend",
            post(handlers::users::resend_user_notification),
        )
        .route(
            "/api/students/{student_id}/recitations",
            get(handlers::recitations::list_by_student),
        )
        .route(
            "/api/students/{student_id}/progress",
            get(handlers::recitations::student_progress),
        )
        .route("/api/students", get(handlers::enrollments::list_students))
        .route("/api/recitations/stats", get(handlers::recitations::stats))
        .route(
            "/api/recitations",
            get(handlers::recitations::list_recitations)
                .post(handlers::recitations::create_recitation),
        )
        .route(
            "/api/recitations/{id}",
            get(handlers::recitations::get_recitation)
                .put(handlers::recitations::update_recitation)
                .delete(handlers::recitations::delete_recitation),
        )
        .route(
            "/api/recitations/{id}/start",
            post(handlers::recitations::start_plan),
        )
        .route(
            "/api/recitations/{id}/pause",
            post(handlers::recitations::pause_plan),
        )
        .route(
            "/api/recitations/{id}/skip",
            post(handlers::recitations::skip_plan),
        )
        .route(
            "/api/recitations/{id}/reopen",
            post(handlers::recitations::reopen_plan),
        )
        .route(
            "/api/recitations/{id}/complete",
            post(handlers::recitations::complete_plan),
        )
        .route(
            "/api/error-annotations/summary",
            get(handlers::error_annotations::annotation_summary),
        )
        .route(
            "/api/error-annotations",
            get(handlers::error_annotations::list_annotations)
                .post(handlers::error_annotations::create_annotation),
        )
        .route(
            "/api/error-annotations/{id}",
            delete(handlers::error_annotations::delete_annotation),
        )
        .route("/api/rooms/stats", get(handlers::rooms::room_stats))
        .route("/api/teachers", get(handlers::rooms::list_teachers))
        .route(
            "/api/rooms/{room_id}/enrollments/count",
            get(handlers::enrollments::enrollment_count),
        )
        .route(
            "/api/rooms/{room_id}/join",
            post(handlers::enrollments::join_room),
        )
        .route(
            "/api/rooms/{room_id}/my-enrollment",
            get(handlers::enrollments::my_enrollment)
                .delete(handlers::enrollments::cancel_my_enrollment),
        )
        .route(
            "/api/rooms/{room_id}/enrollments/pending",
            get(handlers::enrollments::list_pending_enrollments),
        )
        .route(
            "/api/rooms/{room_id}/enrollments/{enrollment_id}/approve",
            put(handlers::enrollments::approve_enrollment),
        )
        .route(
            "/api/rooms/{room_id}/enrollments/{enrollment_id}/reject",
            put(handlers::enrollments::reject_enrollment),
        )
        .route(
            "/api/rooms/{room_id}/enrollments/{enrollment_id}",
            axum::routing::delete(handlers::enrollments::delete_enrollment),
        )
        .route(
            "/api/rooms/{room_id}/enrollments",
            get(handlers::enrollments::list_enrollments)
                .post(handlers::enrollments::create_enrollment),
        )
        .route(
            "/api/rooms/{room_id}/sessions",
            get(handlers::sessions::list_for_room),
        )
        .route(
            "/api/rooms/{room_id}/schedules",
            get(handlers::schedules::list_schedules),
        )
        .route(
            "/api/schedules/batch",
            post(handlers::schedules::create_batch_schedules),
        )
        .route(
            "/api/schedules/generate",
            post(handlers::schedules::generate_sessions),
        )
        .route("/api/schedules", post(handlers::schedules::create_schedule))
        .route(
            "/api/schedules/{id}",
            put(handlers::schedules::update_schedule).delete(handlers::schedules::delete_schedule),
        )
        .route(
            "/api/sessions/stats",
            get(handlers::sessions::session_stats),
        )
        .route("/api/sessions/upcoming", get(handlers::sessions::upcoming))
        .route(
            "/api/sessions/live-public",
            get(handlers::sessions::list_live_public_sessions),
        )
        .route(
            "/api/sessions/instant",
            post(handlers::sessions::create_instant_session),
        )
        .route(
            "/api/sessions/group/{group_id}",
            delete(handlers::sessions::delete_recurrence_group),
        )
        .route(
            "/api/sessions",
            get(handlers::sessions::list_sessions).post(handlers::sessions::create_session),
        )
        .route(
            "/api/sessions/{id}",
            get(handlers::sessions::get_session)
                .put(handlers::sessions::update_session)
                .delete(handlers::sessions::delete_session),
        )
        .route(
            "/api/sessions/{id}/ics",
            get(handlers::sessions::session_ics),
        )
        .route(
            "/api/sessions/{id}/attendance",
            put(handlers::sessions::update_attendance),
        )
        .route(
            "/api/sessions/{id}/plans/reorder",
            put(handlers::recitations::reorder_session_plans),
        )
        .route(
            "/api/sessions/{id}/strokes",
            get(handlers::session_strokes::list_session_strokes),
        )
        .route(
            "/api/rooms",
            get(handlers::rooms::list_rooms).post(handlers::rooms::create_room),
        )
        .route(
            "/api/rooms/{id}",
            get(handlers::rooms::get_room)
                .put(handlers::rooms::update_room)
                .delete(handlers::rooms::delete_room),
        )
        .route(
            "/api/rooms/{id}/permanent",
            delete(handlers::rooms::purge_room),
        )
        .route(
            "/api/rooms/{id}/setup-complete",
            put(handlers::rooms::complete_room_setup),
        )
        .route(
            "/api/rooms/{id}/student-memory",
            get(handlers::rooms::student_memory),
        )
        .route(
            "/api/ws/session/{session_id}",
            get(ws::signaling::ws_session_handler),
        )
        .route("/api/livekit/token", post(handlers::livekit::mint_token))
        .route(
            "/api/rooms/{room_id}/invites",
            post(handlers::share::send_room_invites),
        )
        .route(
            "/api/share-links",
            get(handlers::share::list_links).post(handlers::share::create_link),
        )
        .route(
            "/api/share-links/{id}",
            delete(handlers::share::revoke_link),
        )
        .route(
            "/api/share-links/{id}/resend",
            post(handlers::share::resend_invite),
        )
        .route(
            "/api/public/share/{token}",
            get(handlers::share::resolve_public),
        )
        .route(
            "/api/share-links/{token}/accept",
            post(handlers::share::accept_share),
        )
        .with_state(state)
        .layer(cors)
        .merge(website)
        .layer(TraceLayer::new_for_http())
}
