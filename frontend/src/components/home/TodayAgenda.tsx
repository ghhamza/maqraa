// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ChevronLeft, ChevronRight, Radio } from "lucide-react";
import type { SessionPublic } from "../../types";
import { Button } from "../ui/Button";
import { Badge } from "../ui/Badge";
import { SessionTimeDisplay } from "../time/SessionTimeDisplay";
import { NewSessionMenu } from "../sessions/NewSessionMenu";
import { useCalendarSessions } from "../../data/sessions";
import { useAuthStore } from "../../stores/authStore";
import { toYmdLocal } from "../../lib/calendarUtils";
import { intlLocaleForAppLanguage } from "../../lib/intlLocale";
import { canStartScheduledSession } from "../../lib/teacherCockpit";
import { liveSessionPath, sessionNavigatePath } from "../../lib/sessionNav";
import { cn } from "@/lib/utils";

function startOfLocalDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function statusBadgeVariant(
  status: SessionPublic["status"],
): "green" | "blue" | "gold" | "gray" {
  switch (status) {
    case "in_progress":
      return "green";
    case "scheduled":
      return "blue";
    case "completed":
      return "gray";
    case "cancelled":
      return "gold";
    default:
      return "gray";
  }
}

function statusLabelKey(status: SessionPublic["status"]): string {
  return status === "in_progress" ? "sessions.inProgress" : `sessions.${status}`;
}

/** Meet-style 7-day strip + day session list for the teacher home. */
export function TodayAgenda() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const locale = intlLocaleForAppLanguage(i18n.language);
  const isRtl = (i18n.language || "ar").split("-")[0] === "ar";

  const today = useMemo(() => startOfLocalDay(new Date()), []);
  const todayYmd = toYmdLocal(today);

  /** Window: 1 past day + today + 5 future (index 0 = yesterday by default). */
  const [windowStart, setWindowStart] = useState(() => addDays(today, -1));
  const [selectedYmd, setSelectedYmd] = useState(todayYmd);

  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(windowStart, i)),
    [windowStart],
  );

  const fromIso = startOfLocalDay(days[0]!).toISOString();
  const toIso = addDays(startOfLocalDay(days[6]!), 1).toISOString();

  const sessionsQuery = useCalendarSessions(fromIso, toIso, "", true);
  const sessions = sessionsQuery.data ?? [];

  const daySessions = useMemo(() => {
    return sessions
      .filter((s) => toYmdLocal(new Date(s.scheduled_at)) === selectedYmd)
      .slice()
      .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime());
  }, [sessions, selectedYmd]);

  const PrevIcon = isRtl ? ChevronRight : ChevronLeft;
  const NextIcon = isRtl ? ChevronLeft : ChevronRight;

  function shiftWindow(deltaWeeks: number) {
    setWindowStart((prev) => addDays(prev, deltaWeeks * 7));
  }

  function selectDay(d: Date) {
    setSelectedYmd(toYmdLocal(d));
  }

  return (
    <section
      className="rounded-xl border border-gray-100 bg-[var(--color-surface)] p-4 shadow-sm sm:p-5"
      aria-label={t("agenda.today")}
    >
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={t("sessions.calendarPrevMonth")}
          onClick={() => shiftWindow(-1)}
        >
          <PrevIcon className="h-4 w-4" />
        </Button>

        <div className="grid min-w-0 flex-1 grid-cols-7 gap-1">
          {days.map((d) => {
            const ymd = toYmdLocal(d);
            const isToday = ymd === todayYmd;
            const selected = ymd === selectedYmd;
            const weekday = new Intl.DateTimeFormat(locale, { weekday: "short" }).format(d);
            const dayNum = new Intl.DateTimeFormat(locale, { day: "numeric" }).format(d);
            return (
              <button
                key={ymd}
                type="button"
                onClick={() => selectDay(d)}
                className={cn(
                  "flex flex-col items-center gap-0.5 rounded-lg px-1 py-2 text-center transition",
                  isToday && "bg-[var(--color-primary)] text-white",
                  !isToday && selected && "bg-[var(--color-primary)]/10 text-[var(--color-primary)]",
                  !isToday && !selected && "text-[#6B7280] hover:bg-gray-50",
                )}
              >
                <span className="text-[0.65rem] font-medium leading-none">{weekday}</span>
                <span className="text-sm font-bold tabular-nums leading-none">{dayNum}</span>
              </button>
            );
          })}
        </div>

        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={t("sessions.calendarNextMonth")}
          onClick={() => shiftWindow(1)}
        >
          <NextIcon className="h-4 w-4" />
        </Button>
      </div>

      <div className="mt-4 space-y-2">
        {sessionsQuery.isPending ? (
          <div className="flex justify-center py-8">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--color-primary)] border-t-transparent" />
          </div>
        ) : daySessions.length === 0 ? (
          <div className="flex flex-col items-center gap-4 rounded-lg border border-dashed border-gray-200 px-4 py-10 text-center">
            <div className="space-y-1">
              <p className="text-base font-medium text-[var(--color-text)]">{t("agenda.emptyDay")}</p>
              <p className="mx-auto max-w-md text-sm text-[#6B7280]">{t("agenda.emptySubtitle")}</p>
            </div>
            <NewSessionMenu size="lg" />
          </div>
        ) : (
          <ul className="space-y-2">
            {daySessions.map((s) => {
              const isLive = s.status === "in_progress";
              const canJoin =
                isLive || (s.status === "scheduled" && canStartScheduledSession(s.scheduled_at));
              const title = s.title?.trim() || t("sessions.untitledTitle");
              return (
                <li key={s.id}>
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => void navigate(sessionNavigatePath(s))}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        void navigate(sessionNavigatePath(s));
                      }
                    }}
                    className="flex cursor-pointer flex-col gap-2 rounded-lg border border-gray-100 bg-white p-3 transition hover:border-[var(--color-primary)]/30 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <SessionTimeDisplay
                          scheduledAt={s.scheduled_at}
                          roomTz={s.room_timezone}
                          userTz={user?.timezone}
                          primaryClassName="text-sm font-semibold text-[var(--color-text)]"
                        />
                        <Badge variant={statusBadgeVariant(s.status)}>{t(statusLabelKey(s.status))}</Badge>
                      </div>
                      <p className="truncate text-sm font-medium text-[var(--color-text)]">{title}</p>
                      <Link
                        to={`/rooms/${s.room_id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex max-w-full truncate rounded-md bg-[var(--color-primary)]/8 px-2 py-0.5 text-xs font-medium text-[var(--color-primary)] hover:underline"
                      >
                        {t("session.halaqahChip", { name: s.room_name })}
                      </Link>
                    </div>
                    {canJoin ? (
                      <Button
                        type="button"
                        variant="primary"
                        size="sm"
                        className="shrink-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          void navigate(isLive ? liveSessionPath(s.id) : sessionNavigatePath(s));
                        }}
                      >
                        <span className="inline-flex items-center gap-1.5">
                          <Radio className="h-3.5 w-3.5" />
                          {isLive ? t("cockpit.resume") : t("sessions.start")}
                        </span>
                      </Button>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
