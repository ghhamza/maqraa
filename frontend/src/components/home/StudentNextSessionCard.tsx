// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { SessionPublic } from "../../types";
import { Button } from "../ui/Button";
import { SessionTimeDisplay } from "../time/SessionTimeDisplay";
import { useAuthStore } from "../../stores/authStore";
import { intlLocaleForAppLanguage } from "../../lib/intlLocale";
import { liveSessionPath, sessionNavigatePath } from "../../lib/sessionNav";
import { sessionCountdownLabel } from "../sessions/UpcomingSessionsWidget";

export interface StudentNextSessionCardProps {
  liveSession: SessionPublic | null;
  nextSession: SessionPublic | null;
}

/** Primary action card: live join or next upcoming session. */
export function StudentNextSessionCard({ liveSession, nextSession }: StudentNextSessionCardProps) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);

  if (liveSession) {
    return (
      <div
        className="rounded-2xl border border-[var(--color-primary)]/20 p-5 shadow-sm"
        style={{ backgroundColor: "#E8F5E9" }}
      >
        <p className="text-sm font-semibold text-[var(--color-primary)]">{t("studentHome.liveNow")}</p>
        <p className="mt-1 font-medium text-[var(--color-text)]">{liveSession.room_name}</p>
        <p className="text-sm text-[var(--color-text-muted)]">
          {liveSession.title?.trim() || t("sessions.untitledTitle")}
        </p>
        <div className="mt-4">
          <Button
            type="button"
            variant="primary"
            onClick={() => void navigate(liveSessionPath(liveSession.id))}
          >
            {t("studentHome.joinNow")}
          </Button>
        </div>
      </div>
    );
  }

  if (nextSession) {
    return (
      <div
        className="rounded-2xl border border-[var(--color-primary)]/20 p-5 shadow-sm"
        style={{ backgroundColor: "#E8F5E9" }}
      >
        <p className="text-sm font-semibold text-[var(--color-primary)]">{t("home.nextSession")}</p>
        <p className="mt-1 font-medium text-[var(--color-text)]">{nextSession.room_name}</p>
        <p className="text-sm text-[var(--color-text-muted)]">
          <SessionTimeDisplay
            scheduledAt={nextSession.scheduled_at}
            roomTz={nextSession.room_timezone}
            userTz={user?.timezone}
          />
        </p>
        <p className="mt-1 text-xs text-[var(--color-primary)]">
          {sessionCountdownLabel(
            nextSession.scheduled_at,
            t,
            intlLocaleForAppLanguage(i18n.language),
          )}
        </p>
        <div className="mt-4">
          <Button
            type="button"
            variant="primary"
            onClick={() => void navigate(sessionNavigatePath(nextSession))}
          >
            {t("sessions.start")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <p className="text-sm text-[var(--color-text-muted)]">
      {t("studentHome.noUpcoming")}
      {" · "}
      <Link to="/rooms" className="font-medium text-[var(--color-primary)] hover:underline">
        {t("home.studentRooms")}
      </Link>
    </p>
  );
}
