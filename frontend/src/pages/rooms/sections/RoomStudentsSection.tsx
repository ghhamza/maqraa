// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

import { useTranslation } from "react-i18next";
import { UserPlus, Users } from "lucide-react";
import type { Enrollment, Room, User } from "../../../types";
import { Button } from "../../../components/ui/Button";
import { PageCard } from "../../../components/layout/PageCard";
import { EnrolledStudentsList } from "../../../components/enrollment/EnrolledStudentsList";
import { PendingRequestsList } from "../../../components/enrollment/PendingRequestsList";
import { EmptyState } from "../../../components/ui/EmptyState";

function canManage(user: User | null, room: Room): boolean {
  if (!user) return false;
  if (user.role === "admin") return true;
  return user.role === "teacher" && user.id === room.teacher_id;
}

export interface RoomStudentsSectionProps {
  room: Room;
  user: User | null;
  enrollments: Enrollment[];
  enrolledCount: number;
  showActions: boolean;
  isArchived: boolean;
  onRefresh: () => void;
  onInviteOpen: () => void;
  /** Admin-only direct enrollment of an existing account. */
  onEnrollOpen?: () => void;
  onRemoveEnrollment: (e: Enrollment) => void;
}

export function RoomStudentsSection({
  room,
  user,
  enrollments,
  enrolledCount,
  showActions,
  isArchived,
  onRefresh,
  onInviteOpen,
  onEnrollOpen,
  onRemoveEnrollment,
}: RoomStudentsSectionProps) {
  const { t } = useTranslation();
  const manage = canManage(user, room);
  const isAdmin = user?.role === "admin";

  return (
    <>
      <PageCard>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold text-[var(--color-text)]">
              {t("enrollment.headerCount", { count: enrolledCount, max: room.max_students })}
            </h2>
            {room.pending_count > 0 && showActions ? (
              <span className="rounded-full bg-[var(--color-gold)]/15 px-2 py-0.5 text-xs font-semibold text-[var(--color-gold)]">
                {t("enrollment.pendingCountChip", { count: room.pending_count })}
              </span>
            ) : null}
          </div>
          {showActions && enrolledCount > 0 && !isArchived ? (
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" variant="primary" onClick={() => onInviteOpen()}>
                <span className="inline-flex items-center gap-2">
                  <UserPlus className="h-4 w-4" />
                  {t("invite.inviteStudents")}
                </span>
              </Button>
              {isAdmin && onEnrollOpen ? (
                <Button
                  type="button"
                  variant="secondary"
                  disabled={enrolledCount >= room.max_students}
                  onClick={() => onEnrollOpen()}
                >
                  {t("invite.adminDirectAdd")}
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>
        {showActions ? (
          enrolledCount === 0 ? (
            <EmptyState
              icon={<Users className="h-12 w-12" />}
              title={t("enrollment.emptyStudentsTitle")}
              description={t("enrollment.emptyStudentsHint")}
              primaryAction={
                !isArchived
                  ? { label: t("invite.inviteStudents"), onClick: () => onInviteOpen() }
                  : undefined
              }
              secondaryAction={
                !isArchived && isAdmin && onEnrollOpen
                  ? {
                      label: t("invite.adminDirectAdd"),
                      onClick: () => onEnrollOpen(),
                    }
                  : undefined
              }
            />
          ) : (
            <EnrolledStudentsList
              enrollments={enrollments}
              maxStudents={room.max_students}
              canManage={manage}
              onRemove={(e) => onRemoveEnrollment(e)}
            />
          )
        ) : (
          <div className="space-y-2">
            <p className="text-sm text-[var(--color-text)]">
              {t("enrollment.studentCount", { count: enrolledCount })}
            </p>
            <p className="text-sm text-[var(--color-text-muted)]">{t("enrollment.listRestricted")}</p>
          </div>
        )}
      </PageCard>

      {showActions && room.pending_count > 0 && !isArchived ? (
        <PageCard>
          <h2 className="mb-4 text-lg font-semibold text-[var(--color-text)]">
            {t("enrollment.pendingSectionTitle")}
          </h2>
          <PendingRequestsList roomId={room.id} onChanged={() => void onRefresh()} />
        </PageCard>
      ) : null}
    </>
  );
}
