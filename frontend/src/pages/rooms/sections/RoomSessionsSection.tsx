// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

import { Link } from "react-router-dom";
import { Calendar } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { Room, SessionPublic, User } from "../../../types";
import { Badge } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { PageCard } from "../../../components/layout/PageCard";
import { EmptyState } from "../../../components/ui/EmptyState";
import { useLocaleDate } from "../../../hooks/useLocaleDate";
import { sessionNavigatePath } from "../../../lib/sessionNav";

function canManage(user: User | null, room: Room): boolean {
  if (!user) return false;
  if (user.role === "admin") return true;
  return user.role === "teacher" && user.id === room.teacher_id;
}

function sessionStatusLabelKey(status: SessionPublic["status"]): string {
  return status === "in_progress" ? "inProgress" : status;
}

export interface RoomSessionsSectionProps {
  room: Room;
  user: User | null;
  sessions: SessionPublic[];
  sessionsLoading: boolean;
  isArchived: boolean;
  onSessionFormOpen: () => void;
}

/** List of upcoming + recent sessions (no month calendar — use global /calendar). */
export function RoomSessionsSection({
  room,
  user,
  sessions,
  sessionsLoading,
  isArchived,
  onSessionFormOpen,
}: RoomSessionsSectionProps) {
  const { t } = useTranslation();
  const { full } = useLocaleDate();
  const showActions = canManage(user, room);

  return (
    <PageCard>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-[var(--color-text)]">{t("rooms.upcomingSessions")}</h2>
        {showActions ? (
          <Button type="button" variant="primary" disabled={isArchived} onClick={onSessionFormOpen}>
            {t("sessions.addSession")}
          </Button>
        ) : null}
      </div>
      {sessionsLoading ? (
        <div className="flex justify-center py-6">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--color-primary)] border-t-transparent" />
        </div>
      ) : isArchived ? (
        <EmptyState
          size="large"
          icon={<Calendar className="opacity-40" />}
          title={t("rooms.archivedSessionsHiddenTitle")}
          description={t("rooms.archivedSessionsHiddenDescription")}
        />
      ) : sessions.length === 0 ? (
        <EmptyState
          size="large"
          icon={<Calendar className="opacity-40" />}
          title={t("roomDetail.sessionsEmptyTitle")}
          description={t("roomDetail.sessionsEmptyDescription")}
          primaryAction={
            showActions
              ? { label: t("roomDetail.sessionsEmptyCta"), onClick: onSessionFormOpen }
              : undefined
          }
        />
      ) : (
        <ul className="space-y-3">
          {sessions.map((s) => (
            <li key={s.id}>
              <Link
                to={sessionNavigatePath(s)}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-gray-100 bg-[var(--color-bg)] p-4 transition hover:border-[var(--color-primary)]/30"
              >
                <div>
                  <p className="font-medium text-[var(--color-text)]">
                    {s.title?.trim() || t("sessions.untitledTitle")}
                  </p>
                  <p className="text-sm text-[var(--color-text-muted)]">{full(s.scheduled_at)}</p>
                </div>
                <Badge
                  variant={
                    s.status === "in_progress"
                      ? "blue"
                      : s.status === "cancelled" || s.status === "completed"
                        ? "gray"
                        : "green"
                  }
                >
                  {t(`sessions.${sessionStatusLabelKey(s.status)}`)}
                </Badge>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </PageCard>
  );
}
