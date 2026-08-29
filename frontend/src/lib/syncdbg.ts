// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

/**
 * Live-session sync diagnostic logs. Active only in Vite DEV builds;
 * production builds dead-code-eliminate the body via `import.meta.env.DEV`.
 */
export function syncdbg(...args: unknown[]): void {
  if (import.meta.env.DEV) {
    console.log("[SYNCDBG]", ...args);
  }
}
