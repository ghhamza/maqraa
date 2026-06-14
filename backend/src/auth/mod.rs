// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

mod email_tokens;
pub mod jwt;
pub mod password;

pub use email_tokens::{
    consume_reset_token, consume_verification_token, create_reset_token, create_verification_token,
    invalidate_reset_tokens, invalidate_verification_tokens, recent_verification_token_exists,
};
