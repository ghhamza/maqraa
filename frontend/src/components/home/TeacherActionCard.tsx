// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { CalendarPlus, Radio, Users } from "lucide-react";
import type { Room, SessionPublic } from "../../types";
import { Button } from "../ui/Button";
import { SessionTimeDisplay } from "../time/SessionTimeDisplay";
import { WhatsAppReminderButton } from "../reminder/WhatsAppReminderButton";
import { useAuthStore } from "../../stores/authStore";
import { intlLocaleForAppLanguage } from "../../lib/intlLocale";
import { formatSessionTime } from "../../lib/sessionTime";
import { liveSessionPath, sessionNavigatePath } from "../../lib/sessionNav";
import {
  canStartScheduledSession,
  formatCountdownCompact,
  type TeacherCockpitState,
} from "../../lib/teacherCockpit";

export interface TeacherActionCardProps {
  state: TeacherCockpitState;
  instantLoading?: boolean;
  /** Rooms list for resolving share link / name on session cockpit states. */
  rooms?: Room[];
  onInstantStart: () => void;
  onInvite: (room: Room) => void;
  onSchedule: (room: Room) => void;
}

function CardShell({ children }: { children: React.ReactNode }) {
  return (
    <section
      className="rounded-xl bg-white p-5 shadow-sm sm:p-6"
      style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 4px 16px rgba(27,94,32,0.06)" }}
    >
      {children}
    </section>
  );
}

export function TeacherActionCard({
  state,
  instantLoading,
  rooms = [],
  onInstantStart,
  onInvite,
  onSchedule,
}: TeacherActionCardProps) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const locale = intlLocaleForAppLanguage(i18n.language);

  function roomForSession(session: SessionPublic): Room | null {
    return rooms.find((r) => r.id === session.room_id) ?? null;
  }

  const countdown = useMemo(() => {
    if (state.kind !== "starting_soon" && state.kind !== "next_session") return "";
    return formatCountdownCompact(state.session.scheduled_at, locale);
  }, [state, locale]);

  if (state.kind === "live") {
    return (
      <CardShell>
        <p className="text-sm font-semibold text-[var(--color-primary)]">{t("cockpit.liveNow")}</p>
        <h2 className="mt-1 font-[family-name:var(--font-heading)] text-xl text-[var(--color-text)]">
          {state.session.room_name}
        </h2>
        <p className="mt-1 text-sm text-[var(--color-text-muted)]">
          {state.session.title?.trim() || t("sessions.untitledTitle")}
        </p>
        <div className="mt-5">
          <Button
            type="button"
            variant="primary"
            size="lg"
            onClick={() => void navigate(liveSessionPath(state.session.id))}
          >
            {t("cockpit.resume")}
          </Button>
        </div>
      </CardShell>
    );
  }

  if (state.kind === "starting_soon") {
    return (
      <CardShell>
        <p className="text-sm font-semibold text-[var(--color-primary)]">{t("home.todaySession")}</p>
        <h2 className="mt-1 font-[family-name:var(--font-heading)] text-xl text-[var(--color-text)]">
          {state.session.room_name}
        </h2>
        <p className="mt-1 text-sm text-[var(--color-text-muted)]">
          <SessionTimeDisplay
            scheduledAt={state.session.scheduled_at}
            roomTz={state.session.room_timezone}
            userTz={user?.timezone}
          />
        </p>
        {countdown ? (
          <p className="mt-2 text-base font-semibold" style={{ color: "#D4A843" }}>
            {t("cockpit.startsIn", { time: countdown })}
          </p>
        ) : null}
        <div className="mt-5 flex flex-wrap gap-2">
          <Button
            type="button"
            variant="primary"
            size="lg"
            onClick={() => void navigate(sessionNavigatePath(state.session))}
          >
            {t("sessions.start")}
          </Button>
          <WhatsAppReminderButton
            session={state.session}
            room={roomForSession(state.session)}
            size="lg"
          />
        </div>
      </CardShell>
    );
  }

  if (state.kind === "log_recitations") {
    return (
      <CardShell>
        <h2 className="font-[family-name:var(--font-heading)] text-xl text-[var(--color-text)]">
          {t("cockpit.logRecitations")}
        </h2>
        <p className="mt-1 text-sm text-[var(--color-text-muted)]">
          {state.session.room_name}
          {" · "}
          <SessionTimeDisplay
            scheduledAt={state.session.scheduled_at}
            roomTz={state.session.room_timezone}
            userTz={user?.timezone}
            className="inline"
          />
        </p>
        <div className="mt-5">
          <Button
            type="button"
            variant="primary"
            size="lg"
            onClick={() => void navigate(`/sessions/${state.session.id}`)}
          >
            {t("cockpit.logRecitations")}
          </Button>
        </div>
      </CardShell>
    );
  }

  if (state.kind === "no_halaqah") {
    // Agenda empty state + header NewSessionMenu cover create; demo strip covers the tour.
    return null;
  }

  if (state.kind === "invite") {
    return (
      <CardShell>
        <div className="flex items-start gap-3">
          <Users className="mt-0.5 size-6 shrink-0 text-[var(--color-primary)]" aria-hidden />
          <div className="min-w-0">
            <h2 className="font-[family-name:var(--font-heading)] text-xl text-[var(--color-text)]">
              {t("cockpit.inviteTitle")}
            </h2>
            <p className="mt-1 text-sm text-[var(--color-text-muted)]">{state.room.name}</p>
          </div>
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          <Button type="button" variant="primary" size="lg" onClick={() => onInvite(state.room)}>
            {t("invite.invite")}
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="lg"
            loading={instantLoading}
            onClick={onInstantStart}
          >
            <span className="inline-flex items-center gap-2">
              <Radio className="h-4 w-4" />
              {t("instant.start")}
            </span>
          </Button>
        </div>
      </CardShell>
    );
  }

  if (state.kind === "schedule_next") {
    return (
      <CardShell>
        <div className="flex items-start gap-3">
          <CalendarPlus className="mt-0.5 size-6 shrink-0 text-[var(--color-primary)]" aria-hidden />
          <div className="min-w-0">
            <h2 className="font-[family-name:var(--font-heading)] text-xl text-[var(--color-text)]">
              {t("cockpit.scheduleNext")}
            </h2>
            <p className="mt-1 text-sm text-[var(--color-text-muted)]">{state.room.name}</p>
          </div>
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          <Button type="button" variant="primary" size="lg" onClick={() => onSchedule(state.room)}>
            {t("activation.schedule")}
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="lg"
            loading={instantLoading}
            onClick={onInstantStart}
          >
            <span className="inline-flex items-center gap-2">
              <Radio className="h-4 w-4" />
              {t("instant.start")}
            </span>
          </Button>
        </div>
      </CardShell>
    );
  }

  // next_session
  const session: SessionPublic = state.session;
  const startEnabled = canStartScheduledSession(session.scheduled_at);
  const f = formatSessionTime(session.scheduled_at, session.room_timezone, user?.timezone, i18n.language);
  const dateLabel = f.secondaryTime
    ? `${f.primary} · ${t("tz.yourTime", { time: f.secondaryTime })}`
    : f.primary;

  return (
    <CardShell>
      <h2 className="font-[family-name:var(--font-heading)] text-xl text-[var(--color-text)]">
        {t("cockpit.nextSession", { date: dateLabel })}
      </h2>
      <p className="mt-1 text-sm text-[var(--color-text-muted)]">{session.room_name}</p>
      {countdown ? (
        <p className="mt-2 text-base font-semibold" style={{ color: "#D4A843" }}>
          {t("cockpit.startsIn", { time: countdown })}
        </p>
      ) : null}
      {!startEnabled ? (
        <p className="mt-1 text-xs text-[var(--color-text-muted)]">{t("activation.startLocked")}</p>
      ) : null}
      <div className="mt-5 flex flex-wrap gap-2">
        <Button
          type="button"
          variant="primary"
          size="lg"
          disabled={!startEnabled}
          onClick={() => void navigate(sessionNavigatePath(session))}
        >
          {t("sessions.start")}
        </Button>
        <Button type="button" variant="secondary" size="lg" onClick={onInstantStart} loading={instantLoading}>
          <span className="inline-flex items-center gap-2">
            <Radio className="h-4 w-4" />
            {t("instant.start")}
          </span>
        </Button>
      </div>
    </CardShell>
  );
}
