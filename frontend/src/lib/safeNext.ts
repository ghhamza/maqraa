// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

import type { User } from "../types";

export const SHARE_NEXT_KEY = "share_next";
/** Live session path allowed while profile_completion_pending (share join deferral). */
export const PROFILE_DEFER_LIVE_KEY = "profile_defer_live";
/** User chose أكمل لاحقًا — skip bouncing back to profile after share-accept. */
export const PROFILE_DEFER_OPTED_KEY = "profile_defer_opted";

/** Accept only same-origin relative paths (single leading slash). */
export function safeNext(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) return null;
  if (/^https?:/i.test(trimmed)) return null;
  return trimmed;
}

export function stashShareNext(raw: string | null | undefined): void {
  const next = safeNext(raw);
  if (next) {
    sessionStorage.setItem(SHARE_NEXT_KEY, next);
  }
}

export function consumeShareNext(): string | null {
  const next = safeNext(sessionStorage.getItem(SHARE_NEXT_KEY));
  sessionStorage.removeItem(SHARE_NEXT_KEY);
  return next;
}

export function peekShareNext(): string | null {
  return safeNext(sessionStorage.getItem(SHARE_NEXT_KEY));
}

/** Allow staying on a live session while profile completion is still pending. */
export function stashProfileDeferLive(raw: string | null | undefined): void {
  const next = safeNext(raw);
  if (next && /^\/sessions\/[^/]+\/live\/?$/.test(next.split("?")[0] ?? "")) {
    sessionStorage.setItem(PROFILE_DEFER_LIVE_KEY, next.split("?")[0]!);
  }
}

export function peekProfileDeferLive(): string | null {
  return safeNext(sessionStorage.getItem(PROFILE_DEFER_LIVE_KEY));
}

export function clearProfileDeferLive(): void {
  sessionStorage.removeItem(PROFILE_DEFER_LIVE_KEY);
}

export function markProfileDeferOpted(): void {
  sessionStorage.setItem(PROFILE_DEFER_OPTED_KEY, "1");
}

export function consumeProfileDeferOpted(): boolean {
  const opted = sessionStorage.getItem(PROFILE_DEFER_OPTED_KEY) === "1";
  if (opted) sessionStorage.removeItem(PROFILE_DEFER_OPTED_KEY);
  return opted;
}

/** Extract share token from a `/share/{token}` next path. */
export function shareTokenFromNext(raw: string | null | undefined): string | null {
  const next = safeNext(raw);
  if (!next?.startsWith("/share/")) return null;
  const token = next.slice("/share/".length).split("/")[0]?.trim();
  if (!token || !/^[A-Za-z0-9_-]+$/.test(token)) return null;
  return token;
}

/** Resolve share token from URL `?next=` or stashed share next after teaser CTA. */
export function resolveShareTokenForRegister(searchNext: string | null): string | null {
  const fromUrl = shareTokenFromNext(searchNext);
  if (fromUrl) return fromUrl;
  return shareTokenFromNext(sessionStorage.getItem(SHARE_NEXT_KEY));
}

export function navigateAfterAuth(navigate: (path: string, opts?: { replace?: boolean }) => void): boolean {
  const next = consumeShareNext();
  if (next) {
    navigate(next, { replace: true });
    return true;
  }
  return false;
}

/** After login/register: honor onboarding guards before consuming share_next. */
export function finishAuthNavigation(
  navigate: (path: string, opts?: { replace?: boolean }) => void,
  user: User,
): void {
  if (user.profile_completion_pending) {
    navigate("/profile/complete", { replace: true });
    return;
  }
  if (!navigateAfterAuth(navigate)) {
    navigate("/", { replace: true });
  }
}
