// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

use anyhow::Result;
use axum::Router;
use chrono::Utc;
use tracing_subscriber::EnvFilter;

use crate::api::ws::signaling::on_session_ended;
use crate::api::AppState;
use crate::config::AppConfig;
use crate::db::create_pool;
use crate::media::LivekitClient;
use crate::notifications::{build_provider, spawn_scheduler, spawn_worker};
use crate::rooms::RoomManager;
use crate::services::storage::StorageService;

/// Initialize tracing (filter: `maqraa=debug`). Idempotent per process.
pub fn init_tracing() -> Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(
            EnvFilter::from_default_env().add_directive("maqraa=debug".parse()?),
        )
        .init();
    Ok(())
}

/// Run embedded migrations. Single `sqlx::migrate!("./migrations")` site for
/// the whole workspace — core's bin and the cloud bin both go through here.
pub async fn run_migrations(pool: &sqlx::PgPool) -> Result<()> {
    sqlx::migrate!("./migrations").run(pool).await?;
    Ok(())
}

/// Build a fully-wired AppState: recordings dir, pool, migrations, storage,
/// RoomManager, LiveKit client. Returns the state with the default
/// (community) entitlements provider — callers may override via
/// `AppState::with_entitlements(...)` before serving.
pub async fn build_app_state(config: AppConfig) -> Result<AppState> {
    std::fs::create_dir_all(&config.recordings_path)?;

    let db_pool = create_pool(&config.database_url).await?;

    run_migrations(&db_pool).await?;

    let storage = StorageService::new(&config.recordings_path);

    let rooms = std::sync::Arc::new(RoomManager::new());
    let livekit = std::sync::Arc::new(
        LivekitClient::new(config.livekit.clone())
            .expect("failed to initialize LiveKit client"),
    );
    tracing::info!("LiveKit client initialized: {}", livekit.ws_url());
    Ok(AppState::new(
        db_pool,
        storage,
        config,
        rooms,
        livekit,
    ))
}

/// Spawn all long-running background tasks: notifications worker + scheduler
/// (when enabled, else the same warn), QF content-token pre-warm, OAuth-state
/// cleanup (300s), idle-session auto-complete (60s, via on_session_ended).
/// Reads everything it needs from `state` (and `state.config`).
pub fn spawn_background_tasks(state: AppState) -> Result<()> {
    if state.config.notifications_enabled {
        let provider = build_provider(&state.config)?;
        spawn_worker(state.db.clone(), provider, state.config.clone());
        spawn_scheduler(state.db.clone(), state.config.clone());
    } else {
        if !state.config.resend_api_key.is_empty() {
            tracing::warn!(
                "NOTIFICATIONS_ENABLED=false but RESEND_API_KEY is set — no emails will be sent until enabled"
            );
        }
        tracing::info!("notifications disabled (NOTIFICATIONS_ENABLED=false)");
    }

    let warm = state.content_api.clone();
    tokio::spawn(async move {
        match warm.get_access_token().await {
            Ok(_) => tracing::info!("QF content token pre-warmed"),
            Err(e) => tracing::warn!(
                error = %e,
                "QF content token pre-warm failed (will retry on first use)"
            ),
        }
    });
    let cleanup_state = state.clone();
    tokio::spawn(async move {
        let mut interval = tokio::time::interval(tokio::time::Duration::from_secs(300));
        loop {
            interval.tick().await;
            match sqlx::query("DELETE FROM qf_oauth_states WHERE expires_at < NOW()")
                .execute(&cleanup_state.db)
                .await
            {
                Ok(done) => tracing::debug!(
                    rows_deleted = done.rows_affected(),
                    "deleted expired qf oauth states"
                ),
                Err(err) => tracing::debug!(error = %err, "failed to cleanup qf oauth states"),
            }
        }
    });

    let idle_state = state.clone();
    tokio::spawn(async move {
        let mut interval = tokio::time::interval(tokio::time::Duration::from_secs(60));
        loop {
            interval.tick().await;
            let cutoff = Utc::now() - chrono::Duration::minutes(10);
            let ids = idle_state.rooms.inactive_empty_sessions(cutoff).await;
            for sid in ids {
                tracing::info!(session_id = %sid, "Session auto-completed due to inactivity");
                let r = sqlx::query(
                    "UPDATE sessions SET status = 'completed'::session_status \
                     WHERE id = $1 AND status::text = 'in_progress'",
                )
                .bind(sid)
                .execute(&idle_state.db)
                .await;
                if let Err(e) = r {
                    tracing::warn!(error = %e, "failed to mark session completed (idle)");
                    continue;
                }
                on_session_ended(&idle_state, sid).await;
            }
        }
    });
    Ok(())
}

/// Bind and serve the composed router. Caller passes the final Router (core
/// passes build_router(state); cloud passes build_router(state).merge(...)).
pub async fn serve(app: Router, host: &str, port: u16) -> Result<()> {
    let addr = format!("{host}:{port}");
    tracing::info!(
        "Al-Maqraa listening on {} (set HOST=127.0.0.1 to block LAN; default 0.0.0.0 accepts all interfaces)",
        addr
    );
    let listener = tokio::net::TcpListener::bind(&addr).await?;
    axum::serve(listener, app).await?;
    Ok(())
}
