// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

import { getApiBaseUrl } from "./api";

export interface PublicConfig {
  google_client_id: string | null;
}

let cached: Promise<PublicConfig> | null = null;

/** Public backend config (`GET /api/config`). Cached for the session. */
export function loadPublicConfig(): Promise<PublicConfig> {
  if (!cached) {
    cached = fetch(`${getApiBaseUrl()}/config`)
      .then(async (res) => {
        if (!res.ok) {
          return { google_client_id: null };
        }
        const data = (await res.json()) as { google_client_id?: string | null };
        const id = data.google_client_id?.trim() || null;
        return { google_client_id: id };
      })
      .catch(() => ({ google_client_id: null }));
  }
  return cached;
}
