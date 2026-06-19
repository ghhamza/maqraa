// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

use std::collections::BTreeMap;

use serde::Serialize;
use uuid::Uuid;

/// An opaque capability flag, e.g. "multi_teacher". Strings keep the set open
/// while the open/cloud capability list is still undecided.
pub type Capability = String;

/// A numeric plan limit. `None` (or an absent key) means unlimited.
pub type QuotaLimit = Option<i64>;

/// The resolved entitlement set for one subject. Serializes directly into the
/// `/api/auth/me` payload in a later prompt.
#[derive(Debug, Clone, Default, Serialize)]
pub struct Entitlements {
    /// Pro/operational features that are ON. Empty in community.
    pub capabilities: Vec<Capability>,
    /// Numeric limits keyed by quota name. Empty map = all unlimited.
    pub quotas: BTreeMap<String, QuotaLimit>,
}

impl Entitlements {
    /// True if the capability is present.
    pub fn has(&self, capability: &str) -> bool {
        self.capabilities.iter().any(|c| c == capability)
    }

    /// The limit for a quota key. Returns `None` (unlimited) if the key is
    /// absent OR explicitly unlimited. `Some(n)` is a hard limit.
    pub fn quota(&self, key: &str) -> QuotaLimit {
        self.quotas.get(key).copied().flatten()
    }
}

/// What a provider needs to resolve entitlements. In community it is ignored;
/// in cloud the provider uses `user_id` to look up the org and its plan.
/// Core stays org-agnostic — it carries no `org_id`.
pub struct EntitlementContext {
    pub user_id: Uuid,
    pub role: String,
}

/// The single extension seam core exposes for the open-core split.
#[async_trait::async_trait]
pub trait EntitlementsProvider: Send + Sync {
    /// Resolve the full entitlement set for the given subject.
    async fn resolve(&self, ctx: &EntitlementContext) -> Entitlements;
}

/// Default community/self-host provider: no pro capabilities, no quota limits.
/// This is the honest "every line open, full teaching product, free forever"
/// behavior — self-hosters are never gated.
pub struct CommunityEntitlements;

#[async_trait::async_trait]
impl EntitlementsProvider for CommunityEntitlements {
    async fn resolve(&self, _ctx: &EntitlementContext) -> Entitlements {
        Entitlements::default() // empty capabilities + empty quotas = unlimited
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn community_entitlements_are_unlimited() {
        let provider = CommunityEntitlements;
        let ctx = EntitlementContext {
            user_id: Uuid::new_v4(),
            role: "teacher".to_string(),
        };
        let ent = provider.resolve(&ctx).await;
        assert!(ent.capabilities.is_empty());
        assert!(ent.quotas.is_empty());
        assert!(!ent.has("anything"));
        assert_eq!(ent.quota("anything"), None);
    }

    #[test]
    fn entitlements_accessors() {
        let mut ent = Entitlements::default();
        ent.capabilities.push("multi_teacher".to_string());
        ent.quotas.insert("max_halaqat".to_string(), Some(10));
        ent.quotas.insert("unlimited_key".to_string(), None);

        assert!(ent.has("multi_teacher"));
        assert!(!ent.has("sso"));
        assert_eq!(ent.quota("max_halaqat"), Some(10));
        assert_eq!(ent.quota("unlimited_key"), None);
        assert_eq!(ent.quota("absent"), None);
    }
}
