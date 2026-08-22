// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { Room } from "../../types";
import { Button } from "../ui/Button";
import { ShareCard } from "../share/ShareCard";
import { ShareButton } from "../share/ShareButton";
import { useStartSession } from "../../data/sessions";
import { useAuthStore } from "../../stores/authStore";
import {
  formatRelativeTo,
  formatSessionMecca,
  formatWeekdayMecca,
  startsWithinMinutes,
} from "../../lib/meccaTime";
import { cn } from "@/lib/utils";

export interface ActivationCardProps {
  room: Room;
  onScheduleSession: () => void;
}

export function ActivationCard({ room, onScheduleSession }: ActivationCardProps) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);

  const enrolled = room.enrolled_count ?? 0;
  const completed = room.completed_sessions_count ?? 0;
  const first = room.first_session ?? null;
  const upcoming = first && new Date(first.scheduled_at).getTime() >= Date.now() - 60_000 ? first : null;

  const startMutation = useStartSession(upcoming?.id ?? "", user?.id ?? null, (s) => {
    navigate(`/sessions/${s.id}/live`);
  });

  const canStart = upcoming ? startsWithinMinutes(upcoming.scheduled_at, 15) : false;

  // State A — no students
  if (enrolled === 0) {
    const weekday = upcoming
      ? formatWeekdayMecca(upcoming.scheduled_at, i18n.language)
      : t("share.meccaTime");
    return (
      <div id="activation-card" className="space-y-4">
        <h2 className="text-xl font-semibold text-foreground">
          {t("activation.noStudentsTitle", { weekday })}
        </h2>
        <ShareCard
          roomId={room.id}
          roomName={room.name}
          room={room}
          firstSession={first}
          shareToken={room.share_token}
          variant="full"
          hideTitle
        />
      </div>
    );
  }

  // State B — students, no completed sessions
  if (completed === 0) {
    return (
      <div id="activation-card" className="space-y-4">
        {upcoming ? (
          <div className="rounded-xl border-2 border-[#4CAF50] bg-white p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-sm text-[var(--color-text-muted)]">{t("activation.nextSession")}</p>
                <p className="mt-1 font-[family-name:Amiri,serif] text-2xl text-[#1B5E20]">
                  {formatSessionMecca(upcoming.scheduled_at, i18n.language)}
                </p>
                <p className="mt-2 text-sm text-[var(--color-text-muted)]">
                  {t("activation.enrolledStartsIn", {
                    count: enrolled,
                    relative: formatRelativeTo(upcoming.scheduled_at, i18n.language),
                  })}
                </p>
              </div>
              <Button
                type="button"
                variant="primary"
                size="xl"
                disabled={!canStart || startMutation.isPending}
                loading={startMutation.isPending}
                title={!canStart ? t("activation.startLocked") : undefined}
                onClick={() => startMutation.mutate()}
              >
                {t("activation.start")}
              </Button>
            </div>
            {!canStart ? (
              <p className="mt-3 text-xs text-[var(--color-text-muted)]">{t("activation.startLocked")}</p>
            ) : null}
          </div>
        ) : (
          <div className="rounded-xl border-2 border-[#4CAF50] bg-white p-5 sm:p-6">
            <p className="font-[family-name:Amiri,serif] text-xl text-[#1A1A1A]">
              {t("activation.noUpcoming")}
            </p>
            <Button type="button" variant="primary" className="mt-4" onClick={onScheduleSession}>
              {t("activation.schedule")}
            </Button>
          </div>
        )}
        <ShareCard
          roomId={room.id}
          roomName={room.name}
          room={room}
          firstSession={first}
          shareToken={room.share_token}
          variant="compact"
        />
      </div>
    );
  }

  // State C — has completed sessions
  return (
    <div
      id="activation-card"
      className={cn(
        "flex flex-wrap items-center justify-between gap-3 rounded-lg bg-white px-4 py-3",
        "border-s-4 border-[#1B5E20]",
      )}
    >
      <div className="flex flex-wrap items-center gap-3">
        {upcoming ? (
          <>
            <Button
              type="button"
              variant="primary"
              size="sm"
              disabled={!canStart || startMutation.isPending}
              loading={startMutation.isPending}
              title={!canStart ? t("activation.startLocked") : undefined}
              onClick={() => startMutation.mutate()}
            >
              {t("activation.startNow")}
            </Button>
            <span className="text-sm text-[var(--color-text)]">
              {t("activation.upcoming", {
                date: formatSessionMecca(upcoming.scheduled_at, i18n.language),
              })}
            </span>
          </>
        ) : (
          <Button type="button" variant="secondary" size="sm" onClick={onScheduleSession}>
            {t("activation.schedule")}
          </Button>
        )}
        <span className="text-sm text-[var(--color-text-muted)]">
          {t("activation.counters", { sessions: completed, students: enrolled })}
        </span>
      </div>
      <ShareButton targetType="halaqah" targetId={room.id} displayName={room.name} />
    </div>
  );
}

/** Scroll helper for students empty state CTA. */
export function scrollToActivationCard() {
  document.getElementById("activation-card")?.scrollIntoView({ behavior: "smooth", block: "start" });
}
