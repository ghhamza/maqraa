// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

import { useEffect, useRef } from "react";
import { api } from "../lib/api";
import { detectBrowserTimezone } from "../lib/sessionTime";
import { normalizeUserFromApi } from "../lib/profileDetails";
import { useAuthStore } from "../stores/authStore";
import type { User } from "../types";

/** Once per session: if profile timezone is null, persist the browser-detected IANA zone. */
export function useSyncDetectedTimezone() {
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);
  const setUser = useAuthStore((s) => s.setUser);
  const inFlight = useRef(false);

  useEffect(() => {
    if (!token || !user) return;
    if (user.timezone) return;
    if (inFlight.current) return;
    inFlight.current = true;
    const tz = detectBrowserTimezone();
    void api
      .request<User>({
        method: "put",
        url: "auth/me",
        data: { name: user.name, email: user.email, timezone: tz },
      })
      .then((res) => {
        setUser(normalizeUserFromApi(res.data));
      })
      .catch(() => {
        inFlight.current = false;
      });
  }, [token, user, setUser]);
}
