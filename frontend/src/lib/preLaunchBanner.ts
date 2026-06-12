// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

/** Routes where the pre-launch strip is hidden (auth, live mushaf, standalone mushaf reader). */
export function shouldShowPreLaunchBanner(pathname: string): boolean {
  if (pathname === "/login" || pathname === "/register") return false;
  if (pathname.startsWith("/auth/")) return false;
  if (/^\/sessions\/[^/]+\/live$/.test(pathname)) return false;
  if (pathname === "/mushaf" || pathname.startsWith("/mushaf/")) return false;
  return true;
}

export const PRE_LAUNCH_BANNER_HEIGHT = "5rem";
