// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Link, Navigate, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Archive, Globe, MoreHorizontal, Pencil, Radio, RotateCcw, Trash2, UserPlus } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { Enrollment, Room, SessionPublic } from "../../types";
import { useAuthStore } from "../../stores/authStore";
import { Button } from "../../components/ui/Button";
import { WhatsAppReminderButton } from "../../components/reminder/WhatsAppReminderButton";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../../components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../../components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs";
import { Badge } from "../../components/ui/Badge";
import { RoomFormModal } from "../../components/rooms/RoomFormModal";
import { ArchiveRoomModal } from "../../components/rooms/ArchiveRoomModal";
import { DeleteRoomModal } from "../../components/rooms/DeleteRoomModal";
import { EnrollStudentModal } from "../../components/enrollment/EnrollStudentModal";
import { InviteStudentsModal } from "../../components/enrollment/InviteStudentsModal";
import { RoomInvitesCard } from "../../components/enrollment/RoomInvitesCard";
import { RemoveStudentModal } from "../../components/enrollment/RemoveStudentModal";
import { SessionFormModal } from "../../components/sessions/SessionFormModal";
import { RecitationFormModal } from "../../components/recitations/RecitationFormModal";
import { PageShell } from "../../components/layout/PageShell";
import { halaqahBadgeClass } from "../../lib/halaqahUi";
import { riwayaBadgeClass } from "../../lib/riwayaUi";
import { roomKeys } from "../../lib/queryKeys";
import { isSessionTodayOrSoon } from "../../lib/teacherCockpit";
import { sessionNavigatePath } from "../../lib/sessionNav";
import { useLiveSessions } from "../../contexts/LiveSessionsContext";
import { SessionTimeDisplay } from "../../components/time/SessionTimeDisplay";
import { RoomOverviewSection } from "./sections/RoomOverviewSection";
import { RoomStudentsSection } from "./sections/RoomStudentsSection";
import { RoomSessionsSection } from "./sections/RoomSessionsSection";
import { RoomRecitationsSection } from "./sections/RoomRecitationsSection";
import {
  useJoinRoom,
  useInvalidateRoomRecitations,
  useInvalidateRoomSessions,
  useRoom,
  useRoomEnrollments,
  useRoomRecentRecitations,
  useSetWebsiteListing,
  useUnarchiveRoom,
  useWithdrawRoom,
} from "../../data/rooms";
import { useCalendarSessions, useCreateInstantSession, useUpcomingSessions } from "../../data/sessions";

function canManage(user: { id: string; role: string } | null, room: Room): boolean {
  if (!user) return false;
  if (user.role === "admin") return true;
  return user.role === "teacher" && user.id === room.teacher_id;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

type RoomTab = "overview" | "students" | "sessions" | "progress";

function parseTab(raw: string | null): RoomTab {
  if (raw === "students" || raw === "sessions" || raw === "progress" || raw === "overview") return raw;
  return "overview";
}

function sessionStatusLabelKey(status: SessionPublic["status"]): string {
  return status === "in_progress" ? "inProgress" : status;
}

export function RoomDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === "admin";
  const { sessions: liveSessions } = useLiveSessions();

  const activeTab = parseTab(searchParams.get("tab"));

  const [formOpen, setFormOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [enrollOpen, setEnrollOpen] = useState(false);
  const [removeEnrollment, setRemoveEnrollment] = useState<Enrollment | null>(null);
  const [sessionFormOpen, setSessionFormOpen] = useState(false);
  const [recitationFormOpen, setRecitationFormOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [studentConfirm, setStudentConfirm] = useState<"leave" | "cancel" | null>(null);
  const [instantError, setInstantError] = useState<string | null>(null);

  const invalidateRoomSessions = useInvalidateRoomSessions(id ?? "");
  const invalidateRoomRecitations = useInvalidateRoomRecitations(id ?? "");

  const roomQuery = useRoom(id);
  const room = roomQuery.data ?? null;
  const forbidden =
    (roomQuery.error as { response?: { status?: number } } | null)?.response?.status === 403;
  const canManageRoom = !!room && !!user && canManage(user, room);

  const enrollmentsQuery = useRoomEnrollments(id, canManageRoom);
  const enrollments = enrollmentsQuery.data ?? [];

  const sessionsRange = useMemo(() => {
    const now = new Date();
    const from = new Date(now);
    from.setDate(from.getDate() - 30);
    const to = new Date(now);
    to.setDate(to.getDate() + 90);
    return { from: from.toISOString(), to: to.toISOString() };
  }, []);

  const sessionsQuery = useCalendarSessions(
    sessionsRange.from,
    sessionsRange.to,
    id ?? "",
    !!id && !!room,
  );

  useEffect(() => {
    if (!id || !room) return;
    void invalidateRoomSessions();
  }, [id, room, sessionsRange.from, sessionsRange.to, invalidateRoomSessions]);

  const sessions = useMemo(() => {
    const items = sessionsQuery.data ?? [];
    const now = Date.now();
    return [...items].sort((a, b) => {
      const aUpcoming = new Date(a.scheduled_at).getTime() >= now - 60_000;
      const bUpcoming = new Date(b.scheduled_at).getTime() >= now - 60_000;
      if (aUpcoming !== bUpcoming) return aUpcoming ? -1 : 1;
      if (aUpcoming) {
        return new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime();
      }
      return new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime();
    });
  }, [sessionsQuery.data]);
  const sessionsLoading = sessionsQuery.isFetching;

  const upcomingQuery = useUpcomingSessions(!!room);
  const roomUpcoming = useMemo(
    () => (upcomingQuery.data ?? []).filter((s) => s.room_id === id),
    [upcomingQuery.data, id],
  );

  const liveSession = useMemo(
    () => liveSessions.find((s) => s.room_id === id && s.status === "in_progress") ?? null,
    [liveSessions, id],
  );

  const nextSession = liveSession ?? roomUpcoming[0] ?? null;
  const nextThree = useMemo(() => roomUpcoming.slice(0, 3), [roomUpcoming]);

  const recitationsQuery = useRoomRecentRecitations(id, !!room);
  const roomRecitations = recitationsQuery.data ?? [];
  const recitationsLoading = recitationsQuery.isPending;
  const loading = roomQuery.isPending;

  const restoreMutation = useUnarchiveRoom();
  const websiteListingMutation = useSetWebsiteListing(id ?? "", (m) => window.alert(m));
  const joinMutation = useJoinRoom(undefined, (message) => window.alert(message));
  const withdrawMutation = useWithdrawRoom(id ?? "", () => setStudentConfirm(null), (message) =>
    window.alert(message),
  );

  const instantMutation = useCreateInstantSession(
    (data) => {
      setInstantError(null);
      void navigate(`/sessions/${data.session_id}/live`);
    },
    (message) => setInstantError(message),
  );

  const restoreLoading = restoreMutation.isPending;
  const studentActionLoading = joinMutation.isPending || withdrawMutation.isPending;

  function handleRestore() {
    if (!room || restoreLoading) return;
    restoreMutation.mutate(room.id);
  }

  function handleStudentJoin() {
    if (!room || !id || studentActionLoading) return;
    joinMutation.mutate(room.id);
  }

  function confirmStudentWithdrawal() {
    if (!room || !id || studentActionLoading) return;
    withdrawMutation.mutate();
  }

  function setTab(tab: RoomTab) {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (tab === "overview") next.delete("tab");
        else next.set("tab", tab);
        return next;
      },
      { replace: true },
    );
  }

  const showActions = room ? canManage(user, room) : false;
  const enrolledCount = room?.enrolled_count ?? 0;
  const isArchived = room ? !room.is_active : false;

  const showStudentsSection =
    showActions || (user?.role === "student" && room?.my_status === "approved");
  const showRecitationsSection =
    showActions || (user?.role === "student" && room?.my_status === "approved");

  const primaryIsStart =
    !!nextSession &&
    (nextSession.status === "in_progress" || isSessionTodayOrSoon(nextSession.scheduled_at));

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-[var(--color-primary)] border-t-transparent" />
      </div>
    );
  }

  if (forbidden) {
    return (
      <div className="rounded-2xl bg-[var(--color-surface)] p-8 text-center shadow-sm">
        <p className="text-[var(--color-text-muted)]">{t("rooms.forbiddenRoom")}</p>
        <Link to="/rooms" className="mt-4 inline-block text-[var(--color-primary)]">
          {t("rooms.backToRooms")}
        </Link>
      </div>
    );
  }

  if (!room) {
    return (
      <div className="rounded-2xl bg-[var(--color-surface)] p-8 text-center shadow-sm">
        <p className="text-[var(--color-text-muted)]">{t("rooms.roomNotFound")}</p>
        <Link to="/rooms" className="mt-4 inline-block text-[var(--color-primary)]">
          {t("rooms.backToRooms")}
        </Link>
      </div>
    );
  }

  if (canManageRoom && room.setup_completed_at == null) {
    return <Navigate to={`/rooms/${room.id}/setup`} replace />;
  }

  const effectiveTab: RoomTab =
    activeTab === "students" && !showStudentsSection
      ? "overview"
      : activeTab === "progress" && !showRecitationsSection
        ? "overview"
        : activeTab;

  return (
    <PageShell
      breadcrumb={[
        { label: t("nav.home"), to: "/" },
        { label: t("rooms.title"), to: "/rooms" },
        { label: room.name },
      ]}
      title={room.name}
      contentClassName="space-y-6"
    >
      {isArchived ? (
        <div
          className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950"
          role="status"
        >
          {t("rooms.archivedRoomNotice")}
        </div>
      ) : null}

      {/* Action block */}
      <section
        className="rounded-xl bg-white p-5 shadow-sm sm:p-6"
        style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="font-[family-name:var(--font-heading)] text-xl text-[var(--color-text)] sm:text-2xl">
              {room.name}
            </h2>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex rounded-md border px-2 py-0.5 text-xs font-semibold ${riwayaBadgeClass(room.riwaya)}`}
              >
                {t(`mushaf.${room.riwaya}`)}
              </span>
              <span
                className={`inline-flex rounded-md border px-2 py-0.5 text-xs font-semibold ${halaqahBadgeClass(room.halaqah_type)}`}
              >
                {t(`rooms.halaqah${capitalize(room.halaqah_type)}`)}
              </span>
              <span className="text-xs text-[var(--color-text-muted)]">
                {room.is_public ? t("rooms.publicRoom") : t("rooms.enrollmentStatus.not_public")}
              </span>
              {isAdmin && room.is_public && !room.website_listed ? (
                <span className="inline-flex rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-800">
                  {t("rooms.websiteListing.hiddenBadge")}
                </span>
              ) : null}
            </div>
          </div>
          {showActions ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={t("roomTabs.moreMenu")}
                >
                  <MoreHorizontal className="size-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-[12rem]">
                <DropdownMenuItem onClick={() => setFormOpen(true)}>
                  <Pencil className="size-4" />
                  {t("common.edit")}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setFormOpen(true)}>
                  {t("rooms.enrollmentOpen")}
                </DropdownMenuItem>
                {isAdmin && room.is_public && !isArchived ? (
                  <DropdownMenuItem
                    disabled={websiteListingMutation.isPending}
                    onClick={() => websiteListingMutation.mutate(!room.website_listed)}
                  >
                    <Globe className="size-4" />
                    {room.website_listed ? t("rooms.websiteListing.hide") : t("rooms.websiteListing.show")}
                  </DropdownMenuItem>
                ) : null}
                <DropdownMenuSeparator />
                {isArchived ? (
                  <>
                    <DropdownMenuItem
                      disabled={restoreLoading}
                      onClick={() => void handleRestore()}
                    >
                      <RotateCcw className="size-4" />
                      {t("common.restore")}
                    </DropdownMenuItem>
                    <DropdownMenuItem variant="destructive" onClick={() => setDeleteOpen(true)}>
                      <Trash2 className="size-4" />
                      {t("rooms.deletePermanent")}
                    </DropdownMenuItem>
                  </>
                ) : (
                  <DropdownMenuItem variant="destructive" onClick={() => setArchiveOpen(true)}>
                    <Archive className="size-4" />
                    {t("common.archive")}
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>

        <div className="mt-4 border-t border-gray-100 pt-4">
          {nextSession ? (
            <p className="text-sm text-[var(--color-text-muted)]">
              <span className="font-medium text-[var(--color-text)]">{t("home.nextSession")}</span>
              {" · "}
              {nextSession.title?.trim() || t("sessions.untitledTitle")}
              {" · "}
              <SessionTimeDisplay
                scheduledAt={nextSession.scheduled_at}
                roomTz={nextSession.room_timezone || room.timezone}
                userTz={user?.timezone}
                className="inline"
              />
              {nextSession.status === "in_progress" ? (
                <>
                  {" · "}
                  <span className="font-semibold text-[var(--color-primary)]">
                    {t("studentHome.liveNow")}
                  </span>
                </>
              ) : null}
            </p>
          ) : (
            <p className="text-sm text-[var(--color-text-muted)]">{t("studentHome.noUpcoming")}</p>
          )}

          {showActions && !isArchived ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {primaryIsStart && nextSession ? (
                <Button
                  type="button"
                  variant="primary"
                  onClick={() => void navigate(sessionNavigatePath(nextSession))}
                >
                  {nextSession.status === "in_progress"
                    ? t("cockpit.resume")
                    : t("sessions.start")}
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="primary"
                  onClick={() => setSessionFormOpen(true)}
                >
                  {t("activation.schedule")}
                </Button>
              )}
              {primaryIsStart && nextSession && nextSession.status !== "in_progress" ? (
                <WhatsAppReminderButton session={nextSession} room={room} size="default" />
              ) : null}
              <Button
                type="button"
                variant="secondary"
                loading={instantMutation.isPending}
                onClick={() => {
                  setInstantError(null);
                  instantMutation.mutate({ room_id: room.id });
                }}
              >
                <span className="inline-flex items-center gap-2">
                  <Radio className="size-4" />
                  {t("instant.start")}
                </span>
              </Button>
              <Button type="button" variant="secondary" onClick={() => setInviteOpen(true)}>
                <span className="inline-flex items-center gap-2">
                  <UserPlus className="size-4" />
                  {t("invite.inviteStudents")}
                </span>
              </Button>
            </div>
          ) : null}
          {instantError ? (
            <p className="mt-2 text-sm text-red-600" role="alert">
              {instantError}
            </p>
          ) : null}
        </div>
      </section>

      <Tabs
        value={effectiveTab}
        onValueChange={(v) => setTab(parseTab(v))}
        className="space-y-4"
      >
        <TabsList className="h-auto w-full flex-wrap justify-start gap-1 bg-transparent p-0">
          <TabsTrigger
            value="overview"
            className="flex-none rounded-none border-b-2 border-transparent px-3 py-2 data-[state=active]:border-[var(--color-primary)] data-[state=active]:bg-transparent data-[state=active]:shadow-none"
          >
            {t("roomTabs.overview")}
          </TabsTrigger>
          {showStudentsSection ? (
            <TabsTrigger
              value="students"
              className="flex-none rounded-none border-b-2 border-transparent px-3 py-2 data-[state=active]:border-[var(--color-primary)] data-[state=active]:bg-transparent data-[state=active]:shadow-none"
            >
              {t("roomTabs.students")}
            </TabsTrigger>
          ) : null}
          <TabsTrigger
            value="sessions"
            className="flex-none rounded-none border-b-2 border-transparent px-3 py-2 data-[state=active]:border-[var(--color-primary)] data-[state=active]:bg-transparent data-[state=active]:shadow-none"
          >
            {t("roomTabs.sessions")}
          </TabsTrigger>
          {showRecitationsSection ? (
            <TabsTrigger
              value="progress"
              className="flex-none rounded-none border-b-2 border-transparent px-3 py-2 data-[state=active]:border-[var(--color-primary)] data-[state=active]:bg-transparent data-[state=active]:shadow-none"
            >
              {t("roomTabs.progress")}
            </TabsTrigger>
          ) : null}
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <RoomOverviewSection
            room={room}
            user={user}
            isArchived={isArchived}
            studentActionLoading={studentActionLoading}
            onStudentJoin={() => void handleStudentJoin()}
            onLeaveRoom={() => setStudentConfirm("leave")}
            onCancelPendingRequest={() => setStudentConfirm("cancel")}
          />
          {showActions ? <RoomInvitesCard room={room} onInviteOpen={() => setInviteOpen(true)} /> : null}
          {!isArchived ? (
          <div className="rounded-2xl border border-gray-100 bg-[var(--color-surface)] p-5 shadow-sm">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-base font-semibold text-[var(--color-text)]">{t("roomTabs.next3")}</h3>
              <Link
                to={`/calendar?room=${room.id}`}
                className="text-sm font-medium text-[var(--color-primary)] hover:underline"
              >
                {t("roomTabs.viewCalendar")}
              </Link>
            </div>
            {nextThree.length === 0 ? (
              <p className="text-sm text-[var(--color-text-muted)]">{t("studentHome.noUpcoming")}</p>
            ) : (
              <ul className="space-y-2">
                {nextThree.map((s) => (
                  <li key={s.id}>
                    <Link
                      to={sessionNavigatePath(s)}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-gray-100 bg-[var(--color-bg)] px-3 py-2.5 transition hover:border-[var(--color-primary)]/30"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-medium text-[var(--color-text)]">
                          {s.title?.trim() || t("sessions.untitledTitle")}
                        </p>
                        <p className="text-xs text-[var(--color-text-muted)]">
                          <SessionTimeDisplay
                            scheduledAt={s.scheduled_at}
                            roomTz={s.room_timezone || room.timezone}
                            userTz={user?.timezone}
                          />
                        </p>
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
          </div>
          ) : null}
        </TabsContent>

        {showStudentsSection ? (
          <TabsContent value="students">
            <RoomStudentsSection
              room={room}
              user={user}
              enrollments={enrollments}
              enrolledCount={enrolledCount}
              showActions={showActions}
              isArchived={isArchived}
              onRefresh={() => {
                /* PendingRequestsList invalidates its own keys */
              }}
              onInviteOpen={() => setInviteOpen(true)}
              onEnrollOpen={isAdmin ? () => setEnrollOpen(true) : undefined}
              onRemoveEnrollment={(e) => setRemoveEnrollment(e)}
            />
          </TabsContent>
        ) : null}

        <TabsContent value="sessions">
          <RoomSessionsSection
            room={room}
            user={user}
            sessions={sessions}
            sessionsLoading={sessionsLoading}
            isArchived={isArchived}
            onSessionFormOpen={() => setSessionFormOpen(true)}
          />
        </TabsContent>

        {showRecitationsSection ? (
          <TabsContent value="progress">
            <RoomRecitationsSection
              room={room}
              user={user}
              roomRecitations={roomRecitations}
              recitationsLoading={recitationsLoading}
              isArchived={isArchived}
              onRecitationFormOpen={() => setRecitationFormOpen(true)}
            />
          </TabsContent>
        ) : null}
      </Tabs>

      <SessionFormModal
        open={sessionFormOpen}
        mode="create"
        session={null}
        defaultRoomId={room.id}
        defaultDatetime={null}
        presetMorningStart={false}
        onClose={() => setSessionFormOpen(false)}
        onSaved={() => {
          void invalidateRoomSessions();
          void queryClient.invalidateQueries({ queryKey: roomKeys.detail(room.id) });
        }}
      />

      <RecitationFormModal
        open={recitationFormOpen}
        mode="create"
        recitation={null}
        defaultRoomId={room.id}
        defaultRoomName={room.name}
        onClose={() => setRecitationFormOpen(false)}
        onSaved={() => {
          void invalidateRoomRecitations();
        }}
      />

      <RoomFormModal
        open={formOpen}
        mode="edit"
        room={room}
        isAdmin={isAdmin}
        onClose={() => setFormOpen(false)}
        onSaved={() => {
          /* RoomFormModal invalidates room keys */
        }}
      />

      <ArchiveRoomModal
        open={archiveOpen}
        roomId={room.id}
        roomName={room.name}
        onClose={() => setArchiveOpen(false)}
        onArchived={() => navigate("/rooms", { replace: true })}
      />

      <DeleteRoomModal
        open={deleteOpen}
        roomId={room.id}
        roomName={room.name}
        onClose={() => setDeleteOpen(false)}
        onDeleted={() => navigate("/rooms", { replace: true })}
      />

      <EnrollStudentModal
        open={enrollOpen && isAdmin}
        roomId={room.id}
        maxStudents={room.max_students}
        currentCount={enrolledCount}
        onClose={() => setEnrollOpen(false)}
        onEnrolled={() => {
          /* EnrollStudentModal invalidates enrollment keys */
        }}
      />

      <InviteStudentsModal open={inviteOpen} room={room} onClose={() => setInviteOpen(false)} />

      <RemoveStudentModal
        open={removeEnrollment !== null}
        roomId={room.id}
        enrollment={removeEnrollment}
        onClose={() => setRemoveEnrollment(null)}
        onRemoved={() => {
          /* RemoveStudentModal invalidates enrollment keys */
        }}
      />

      <AlertDialog
        open={studentConfirm !== null}
        onOpenChange={(open) => {
          if (!open) setStudentConfirm(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {studentConfirm === "leave"
                ? t("enrollment.leaveRoom")
                : t("enrollment.cancelRequest")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {studentConfirm === "leave"
                ? t("enrollment.leaveConfirm")
                : t("enrollment.cancelRequestConfirm")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button
              type="button"
              variant="outline"
              size="lg"
              fullWidth
              className="sm:w-auto"
              onClick={() => setStudentConfirm(null)}
              disabled={studentActionLoading}
            >
              {t("common.cancel")}
            </Button>
            <Button
              type="button"
              variant="danger"
              size="lg"
              fullWidth
              className="sm:w-auto"
              loading={studentActionLoading}
              onClick={() => void confirmStudentWithdrawal()}
            >
              {t("common.confirm")}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageShell>
  );
}
