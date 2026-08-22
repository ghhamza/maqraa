// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router-dom";
import { X } from "lucide-react";
import { useLiveSessions } from "../../contexts/LiveSessionsContext";
import { liveSessionPath } from "../../lib/sessionNav";
import { Button } from "../ui/Button";

function minutesSinceScheduled(iso: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60_000));
}

export function LiveSessionBanner() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { hasLiveSession, primaryLiveSession, pollVersion } = useLiveSessions();
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    setDismissed(false);
  }, [pollVersion]);

  if (location.pathname.includes("/live")) return null;
  if (!hasLiveSession || !primaryLiveSession || dismissed) return null;

  const title = primaryLiveSession.title?.trim() || t("sessions.untitledTitle");
  const minutes = minutesSinceScheduled(primaryLiveSession.scheduled_at);

  return (
    <div
      role="status"
      className="sticky top-14 z-30 w-full min-w-0 border-b border-[#1B5E20]/20 bg-[#E8F5E9] px-4 py-3.5 sm:px-6 sm:py-4 md:px-8"
    >
      <div className="flex w-full min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
        <div className="min-w-0 flex-1 space-y-1 text-start">
          <p className="text-sm font-semibold text-[var(--color-primary)]">
            {t("liveSession.banner.title")}
          </p>
          <p className="text-xs leading-relaxed text-[var(--color-text-muted)]">
            {title} · {primaryLiveSession.room_name} ·{" "}
            {t("liveSession.banner.startedAgo", { minutes })}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2 self-stretch sm:self-auto">
          <Button
            type="button"
            size="sm"
            variant="primary"
            className="min-h-9 flex-1 sm:flex-none"
            onClick={() => navigate(liveSessionPath(primaryLiveSession.id))}
          >
            {t("liveSession.banner.join")}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="shrink-0"
            aria-label={t("liveSession.banner.dismiss")}
            onClick={() => setDismissed(true)}
          >
            <X className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
