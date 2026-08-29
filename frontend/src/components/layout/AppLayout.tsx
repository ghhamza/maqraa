// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

import { useMemo, type CSSProperties } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuthStore } from "../../stores/authStore";
import { LanguageSwitcher } from "../ui/LanguageSwitcher";
import { cn } from "@/lib/utils";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "../ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { LiveSessionBanner } from "./LiveSessionBanner";
import { LiveSessionsErrorToast } from "./LiveSessionsErrorToast";
import { VerifyEmailBanner } from "../VerifyEmailBanner";
import { DemographicsBanner } from "../DemographicsBanner";
import { useRoomsStats } from "../../data/rooms";
import { useLiveSessions } from "../../contexts/LiveSessionsContext";

/** YouTube-style LIVE chip — colors from `.live-nav-chip` in `index.css`. */
function liveNavLinkClassName(isActive: boolean) {
  return cn(
    "live-nav-chip inline-flex min-h-8 min-w-[2.75rem] shrink-0 items-center justify-center rounded-sm px-3 py-1.5 text-xs font-bold shadow-sm outline-none transition-[box-shadow,transform] hover:scale-[1.02] active:scale-[0.98]",
    isActive && "ring-2 ring-white/40 ring-offset-2 ring-offset-[var(--color-surface)]",
  );
}

function LiveNavChipLabel() {
  const { t, i18n } = useTranslation();
  const base = (i18n.language || "ar").split("-")[0] ?? "ar";
  const isLatin = base !== "ar";
  return (
    <span
      className={cn(
        "leading-none text-inherit",
        isLatin ? "uppercase tracking-[0.12em]" : "font-extrabold tracking-tight",
      )}
    >
      {t("nav.liveBadge")}
    </span>
  );
}

export function AppLayout() {
  const { t, i18n } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const location = useLocation();
  const isMushafRoute = location.pathname.startsWith("/mushaf");
  const { hasLiveSession } = useLiveSessions();

  const roomStatsQuery = useRoomsStats(!!user);
  const pendingTotal = roomStatsQuery.data?.pending_count_total ?? null;

  const localeBase = (i18n.language || "ar").split("-")[0] ?? "ar";
  const isRtl = localeBase === "ar";
  const contentDir = isRtl ? "rtl" : "ltr";
  /** Physical side for shadcn (layout shell is forced LTR so flex does not reverse). */
  const sidebarSide = isRtl ? "right" : "left";

  const showPendingDot =
    (user?.role === "teacher" || user?.role === "admin") && (pendingTotal ?? 0) > 0;

  const liveActive = useMemo(() => location.pathname === "/live", [location.pathname]);

  /** Centered reading width on large viewports; mushaf stays edge-to-edge. */
  const contentShell = "mx-auto w-full min-w-0 max-w-7xl";

  const sidebar = (
    <AppSidebar
      side={sidebarSide}
      dir={contentDir}
      user={user}
      showPendingDot={showPendingDot}
      onLogout={logout}
    />
  );

  const main = (
    <SidebarInset dir={contentDir} className="min-w-0 overflow-x-hidden bg-[var(--color-bg)]">
      <header className="sticky top-0 z-50 flex h-14 shrink-0 items-center gap-2 border-b border-border bg-[var(--color-surface)] ps-1.5 pe-3 shadow-sm sm:gap-3 sm:pe-4 md:pe-6">
        <SidebarTrigger className="size-8 shrink-0" aria-label={t("common.openMenu")} />

        <div className="ms-auto flex shrink-0 items-center gap-2 sm:gap-3">
          {hasLiveSession ? (
            <NavLink
              to="/live"
              className={liveNavLinkClassName(liveActive)}
              aria-label={t("nav.live")}
              title={t("nav.live")}
            >
              <LiveNavChipLabel />
            </NavLink>
          ) : null}
          <LanguageSwitcher className="shrink-0" />
        </div>
      </header>

      <LiveSessionsErrorToast />
      <VerifyEmailBanner />
      <DemographicsBanner />
      <LiveSessionBanner />

      <div
        className={cn(
          "w-full min-w-0 max-w-full flex-1",
            isMushafRoute
              ? "flex min-h-0 flex-col overflow-hidden p-1 sm:p-2 md:p-3 lg:p-4"
              : "px-4 pb-4 pt-5 sm:p-4 md:p-6 lg:p-8",
        )}
      >
        {isMushafRoute ? (
          <Outlet />
        ) : (
          <div className={contentShell}>
            <Outlet />
          </div>
        )}
      </div>
    </SidebarInset>
  );

  return (
    <SidebarProvider
      defaultOpen
      // Keep flex geometry physical (LTR). Content/sidebar restore locale dir below.
      dir="ltr"
      className="flex h-full min-h-0 w-full min-w-0 flex-1 bg-[var(--color-bg)] !min-h-0"
      style={
        {
          minHeight: 0,
        } as CSSProperties
      }
    >
      {sidebarSide === "left" ? (
        <>
          {sidebar}
          {main}
        </>
      ) : (
        <>
          {main}
          {sidebar}
        </>
      )}
    </SidebarProvider>
  );
}
