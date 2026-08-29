// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

const DEMO_STRIP_DISMISSED_KEY = "maqraa.demoStripDismissed";
const DEMO_COMPLETED_KEY = "maqraa.demoCompleted";

export function isDemoStripDismissed(): boolean {
  try {
    return localStorage.getItem(DEMO_STRIP_DISMISSED_KEY) === "1";
  } catch {
    return false;
  }
}

export function dismissDemoStrip(): void {
  try {
    localStorage.setItem(DEMO_STRIP_DISMISSED_KEY, "1");
  } catch {
    /* ignore quota / private mode */
  }
}

export function isDemoCompletedLocally(): boolean {
  try {
    return localStorage.getItem(DEMO_COMPLETED_KEY) === "1";
  } catch {
    return false;
  }
}

export function markDemoCompletedLocally(): void {
  try {
    localStorage.setItem(DEMO_COMPLETED_KEY, "1");
  } catch {
    /* ignore */
  }
}
