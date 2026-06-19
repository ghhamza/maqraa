# Open-core boundary

Operating rule for the Maqraa split: what lives in public core vs private cloud, and how the two repos relate.

## Editions

| Edition | License | What it is |
|---------|---------|------------|
| **Community** | AGPL-3.0 | Full teaching product — Mushaf, annotations, recitation, progress, live sessions. Free, self-hostable, unlimited. |
| **Cloud** | Core (AGPL) + proprietary operational layer | Multi-org, billing, reporting, white-label, SSO, managed hosting. |

Never charge for teaching. Charge for operating at scale.

## Repo strategy

Two repos, never long-lived branches:

- **`maqraa`** (public, AGPL) — this repository. The `maqraa` library + `maqraa-backend` binary.
- **`maqraa-cloud`** (private, proprietary) — operational layer only. Pins core as a git dependency by tag.

Cloud pins core like this:

```toml
maqraa = { git = "https://github.com/ghhamza/maqraa", tag = "v0.1.0", package = "maqraa" }
```

## Where does a commit go?

| Change | Repo |
|--------|------|
| Teaching feature or bug fix | **Public `maqraa`**, always |
| Operational feature (billing, org, SSO, reporting, white-label) | **Private `maqraa-cloud`**, always |

If a feature seems to need both, the boundary is wrong — add an extension point in core instead of patching handlers in cloud.

## The seam

`EntitlementsProvider` is the **only** thing core exposes for the open/cloud split.

- **Capabilities** — boolean flags (gated by edition). Empty in community.
- **Quotas** — per-plan numeric limits. Absent key or `null` value = unlimited.
- A quota value is **never** a capability.

Enforcement lives in core handlers (`create_room`, `update_room`, …); only the limit values come from the injected provider. Quotas are enforced **server-side**, not just hidden in the UI.

Public surface:

- `maqraa::api::AppState` — `new(...)` + `with_entitlements(...)`
- `maqraa::api::router::build_router(state) -> Router`
- `maqraa::entitlements::{EntitlementsProvider, CommunityEntitlements, Entitlements, EntitlementContext}`

`/api/auth/me` emits `capabilities` + `quotas`; the frontend `useEntitlements()` hook reads them.

## What NOT to do

- No divergent long-lived branches between community and cloud.
- No copy-pasting core into the private repo.
- Core never imports cloud.
- Don't gate teaching features behind payment.
- Don't build npm-package machinery for the frontend prematurely — pro UI is driven by the runtime entitlement flag, not by shipping different code.

## Contributor reflex (CLA)

Core is currently single-author, which keeps open-core / dual-license options open.

The day an **outside developer contributes code**, a CLA / copyright-assignment must be in place **first**, or the ability to build a proprietary cloud layer on top is permanently lost.

Friends helping with marketing or comms only do not need a CLA.

## Phase A definition of done

- Core is a `maqraa` lib + `maqraa-backend` bin with `build_router` + `AppState` as the public surface.
- `EntitlementsProvider` seam exists, community-default, injectable.
- Enforcement call sites baked into room handlers; `/api/auth/me` emits entitlements; `useEntitlements()` consumes them.
- Boundary documented in `backend/src/lib.rs` and this file.
- `main` carries all of it; `v0.1.0` tagged and pinnable from `github.com/ghhamza/maqraa`.
