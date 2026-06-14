// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuthStore } from "../../stores/authStore";

export function ProfileCompletionGuard({ children }: { children: ReactNode }) {
  const user = useAuthStore((s) => s.user);
  const location = useLocation();

  if (user?.profile_completion_pending && location.pathname !== "/profile/complete") {
    return <Navigate to="/profile/complete" replace />;
  }

  return <>{children}</>;
}
