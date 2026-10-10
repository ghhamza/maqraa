// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

import { useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { safeNext } from "../lib/safeNext";
import { selectIsAuthenticated, useAuthStore } from "../stores/authStore";

/**
 * On /login and /register: if the visitor is ALREADY signed in when the page opens
 * and the URL has ?next=/…, go straight there. Decided ONCE when the initial auth
 * load finishes, so a login/register done on this page still goes through
 * finishAuthNavigation (profile completion etc.) untouched.
 */
export function useRedirectAuthenticatedToNext(): void {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isLoading = useAuthStore((s) => s.isLoading);
  const isAuthenticated = useAuthStore(selectIsAuthenticated);
  const decided = useRef(false);
  useEffect(() => {
    if (decided.current || isLoading) return;
    decided.current = true;
    if (!isAuthenticated) return;
    const next = safeNext(searchParams.get("next"));
    if (next) navigate(next, { replace: true });
  }, [isLoading, isAuthenticated, navigate, searchParams]);
}
