// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuthStore } from "../../stores/authStore";
import { peekProfileDeferLive } from "../../lib/safeNext";

export function ProfileCompletionGuard({ children }: { children: ReactNode }) {
  const user = useAuthStore((s) => s.user);
  const location = useLocation();

  if (!user?.profile_completion_pending || location.pathname === "/profile/complete") {
    return <>{children}</>;
  }

  // Share accept must run so live session_id can be resolved before the gate.
  if (location.pathname.startsWith("/share/")) {
    return <>{children}</>;
  }

  // Deferred live-join path only (أكمل لاحقًا); gate returns on any other route.
  const deferredLive = peekProfileDeferLive();
  if (deferredLive && location.pathname === deferredLive) {
    return <>{children}</>;
  }

  return <Navigate to="/profile/complete" replace />;
}
