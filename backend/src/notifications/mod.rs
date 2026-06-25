// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

mod format;
mod provider;
mod queue;
mod scheduler;
mod smtp;
mod surah_names;
mod templates;
mod worker;

pub use format::{format_session_time, grade_label, recitation_ref};
pub use provider::build_provider;
pub use queue::enqueue;
pub use scheduler::spawn_scheduler;
pub use templates::{render, TemplateVars};
pub use worker::spawn_worker;
