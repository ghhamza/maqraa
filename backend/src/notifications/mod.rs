// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

mod provider;
mod queue;
mod templates;
mod worker;

pub use provider::build_provider;
pub use queue::enqueue;
pub use templates::TemplateVars;
pub use worker::spawn_worker;
