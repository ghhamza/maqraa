// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

import { api } from "../lib/api";

export type DemoProductEvent = "demo_started" | "demo_completed";

export type ClientProductEvent = DemoProductEvent | "reminder_whatsapp_opened";

/** Fire-and-forget demo funnel events. Never throws to the caller. */
export async function trackDemoEvent(eventName: DemoProductEvent): Promise<void> {
  return trackProductEvent(eventName);
}

/** Fire-and-forget whitelisted client product events. Never throws. */
export async function trackProductEvent(eventName: ClientProductEvent): Promise<void> {
  try {
    await api.post("product-events", { event_name: eventName });
  } catch {
    // Tracking must never break the UI.
  }
}
