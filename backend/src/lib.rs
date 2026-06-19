// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

//! `maqraa` is the open-source (AGPL-3.0) core: the full Qur'an teaching product —
//! Mushaf, annotations, recitation logging, progress, and live sessions. It runs
//! standalone with no knowledge that any commercial layer exists.
//!
//! **Public composition surface** for downstream binaries (including the private
//! `maqraa-cloud`): [`api::AppState`] and [`api::router::build_router`].
//!
//! **The one extension seam** is [`entitlements::EntitlementsProvider`], defaulting to
//! [`entitlements::CommunityEntitlements`] (no capabilities, unlimited quotas). Downstreams
//! inject their own provider via [`api::AppState::with_entitlements`] and add routes via
//! Axum [`Router::merge`](axum::Router::merge).
//!
//! **Golden rule:** `maqraa-cloud` depends on `maqraa`; never the reverse. Core must
//! never import, reference, or be modified for the cloud layer. If core needs to vary
//! behavior for a commercial feature, add an extension point in core (a trait, a slot)
//! that the cloud layer fills — extend, never patch.

pub mod api;
pub mod auth;
pub mod bootstrap;
pub mod config;
pub mod db;
pub mod entitlements;
pub mod models;
pub mod media;
pub mod notifications;
pub mod qf;
pub mod quran_ayah_counts;
pub mod riwaya;
pub mod rooms;
pub mod services;

pub use bootstrap::{build_app_state, init_tracing, run_migrations, serve, spawn_background_tasks};
