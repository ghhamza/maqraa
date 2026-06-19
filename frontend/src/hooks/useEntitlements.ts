// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

import { useAuthStore } from "../stores/authStore";

const EMPTY_CAPS: string[] = [];
const EMPTY_QUOTAS: Record<string, number | null> = {};

/**
 * Read the current user's entitlements.
 * Community / not-yet-loaded → no capabilities, all quotas unlimited.
 */
export function useEntitlements() {
  const entitlements = useAuthStore((s) => s.entitlements);
  const capabilities = entitlements?.capabilities ?? EMPTY_CAPS;
  const quotas = entitlements?.quotas ?? EMPTY_QUOTAS;

  /** True if the capability is granted. */
  const has = (capability: string): boolean => capabilities.includes(capability);

  /** Numeric limit for a quota key; `null` = unlimited (absent or explicit). */
  const quota = (key: string): number | null => {
    const value = quotas[key];
    return value === undefined ? null : value;
  };

  return { has, quota, capabilities, quotas };
}
