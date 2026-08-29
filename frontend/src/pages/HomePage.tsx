// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { BookMarked, TrendingUp, Users } from "lucide-react";
import { useAuthStore } from "../stores/authStore";
import type {
  Room,
  User,
} from "../types";
import { Button } from "../components/ui/Button";
import { UpcomingSessionsWidget } from "../components/sessions/UpcomingSessionsWidget";
import { NewSessionMenu } from "../components/sessions/NewSessionMenu";
import { RecentRecitationsList } from "../components/recitations/RecentRecitationsList";
import { GradeDistributionBar } from "../components/recitations/GradeDistributionBar";
import { SurahProgressRing } from "../components/recitations/SurahProgressRing";
import { SurahProgressGrid } from "../components/recitations/SurahProgressGrid";
import { intlLocaleForAppLanguage } from "../lib/intlLocale";
import { riwayaBadgeClass } from "../lib/riwayaUi";
import { PageShell } from "../components/layout/PageShell";
import { EmptyState } from "../components/ui/EmptyState";
import { LiveNowDashboardCard } from "../components/home/LiveNowDashboardCard";
import { WhatsNewStrip } from "../components/home/WhatsNewStrip";
import { CombinedStreakCard } from "../components/home/CombinedStreakCard";
import { GettingStartedChecklist } from "../components/home/GettingStartedChecklist";
import { TodayAgenda } from "../components/home/TodayAgenda";
import { DemoEntry } from "../components/home/DemoEntry";
import { StudentEmptyHero } from "../components/home/StudentEmptyHero";
import { TeacherActionCard } from "../components/home/TeacherActionCard";
import { StudentNextSessionCard } from "../components/home/StudentNextSessionCard";
import { StudentReviewCard } from "../components/home/StudentReviewCard";
import { InstantHalaqahPickerModal } from "../components/sessions/InstantHalaqahPickerModal";
import { InviteStudentsModal } from "../components/enrollment/InviteStudentsModal";
import { isTeacherActivated, selectTeacherCockpitState } from "../lib/teacherCockpit";
import { useLiveSessions } from "../contexts/LiveSessionsContext";
import { useStudentProgress, useStudentRecitations, useUsersStats } from "../data/users";
import {
  useMyNextTarget,
  useRecitationsFeed,
  useRecitationsStats,
  useSessionRecitations,
} from "../data/recitations";
import { getSurahNameWithArabic } from "../lib/quranService";
import { useOpenErrorAnnotations } from "../data/annotations";
import { useRoomsList, useRoomsStats } from "../data/rooms";
import {
  useCreateInstantSession,
  useSessionStats,
  useSessionsList,
  useUpcomingSessions,
} from "../data/sessions";

function useTodayDateLine(): string {
  const { i18n } = useTranslation();
  return useMemo(() => {
    const locale = intlLocaleForAppLanguage(i18n.language);
    return new Intl.DateTimeFormat(locale, {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    }).format(new Date());
  }, [i18n.language]);
}

export function HomePage() {
  const user = useAuthStore((s) => s.user);
  const isLoading = useAuthStore((s) => s.isLoading);
  const { t } = useTranslation();
  const homeGreeting = useMemo(
    () => (user ? t("home.welcome", { name: user.name }) : ""),
    [t, user],
  );

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-[var(--color-primary)] border-t-transparent" />
      </div>
    );
  }
  if (!user) {
    return null;
  }
  if (user.role === "admin") return <AdminDashboard homeGreeting={homeGreeting} />;
  if (user.role === "teacher") return <TeacherDashboard user={user} homeGreeting={homeGreeting} />;
  return <StudentDashboard user={user} homeGreeting={homeGreeting} />;
}

function AdminDashboard({ homeGreeting }: { homeGreeting: string }) {
  const { t } = useTranslation();
  const statsQuery = useUsersStats();

  const stats = statsQuery.data ?? null;
  const loading = statsQuery.isPending;

  return (
    <PageShell
      title={t("common.appName")}
      description={homeGreeting}
      meta={t("home.dashboardSubtitle")}
      contentClassName="space-y-8"
    >
      <WhatsNewStrip role="admin" />
      <LiveNowDashboardCard />
      <div>
        <h2 className="mb-4 text-lg font-semibold text-[var(--color-text)]">{t("home.adminStatsTitle")}</h2>
        {loading ? (
          <div className="flex justify-center py-8">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--color-primary)] border-t-transparent" />
          </div>
        ) : stats ? (
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {[
              { label: t("home.totalUsers"), value: stats.total },
              { label: t("home.students"), value: stats.students },
              { label: t("home.teachers"), value: stats.teachers },
              { label: t("home.admins"), value: stats.admins },
            ].map((s) => (
              <div
                key={s.label}
                className="rounded-2xl border border-gray-100 bg-[var(--color-surface)] p-5 shadow-sm"
              >
                <p className="text-sm text-[var(--color-text-muted)]">{s.label}</p>
                <p className="mt-1 text-3xl font-bold" style={{ color: "var(--color-gold)" }}>
                  {s.value}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-[var(--color-text-muted)]">{t("home.statsLoadError")}</p>
        )}
      </div>

      <UpcomingSessionsWidget />
    </PageShell>
  );
}

function TeacherDashboard({ user, homeGreeting }: { user: User; homeGreeting: string }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const dateLine = useTodayDateLine();
  const { sessions: liveSessions } = useLiveSessions();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [instantError, setInstantError] = useState<string | null>(null);
  const [inviteRoom, setInviteRoom] = useState<Room | null>(null);
  const [newSessionMenuOpen, setNewSessionMenuOpen] = useState(false);

  const roomsQuery = useRoomsList("teacher-home", { active: true }, {
    select: (items) => items.filter((r) => r.teacher_id === user.id && r.is_active),
    staleTime: 60_000,
  });

  const roomStatsQuery = useRoomsStats(true);
  const recStatsQuery = useRecitationsStats();
  const recentRecsQuery = useRecitationsFeed("teacher-home-recent", { limit: 5, staleTime: 30_000 });
  const upcomingQuery = useUpcomingSessions(true);
  const sessionStatsQuery = useSessionStats(true);

  const fortyEightHoursAgo = useMemo(
    () => new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
    [],
  );
  const completedRecentQuery = useSessionsList(
    "teacher-cockpit-completed-48h",
    {
      status: "completed",
      from: fortyEightHoursAgo,
      limit: 20,
    },
    true,
  );

  const recentCompleted = useMemo(() => {
    const items = completedRecentQuery.data?.items ?? [];
    return (
      items
        .filter((s) => s.teacher_id === user.id)
        .slice()
        .sort((a, b) => new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime())[0] ??
      null
    );
  }, [completedRecentQuery.data?.items, user.id]);

  const sessionRecsQuery = useSessionRecitations(
    recentCompleted?.id,
    1,
    !!recentCompleted,
  );

  const instantMutation = useCreateInstantSession(
    (data) => {
      setPickerOpen(false);
      setInstantError(null);
      void navigate(`/sessions/${data.session_id}/live`);
    },
    (message, code) => {
      if (code === "room_required") {
        setPickerOpen(true);
        return;
      }
      setInstantError(message);
    },
  );

  const rooms = roomsQuery.data ?? [];
  const roomStats = roomStatsQuery.data ?? null;
  const recStats = recStatsQuery.data ?? null;
  const sessionStats = sessionStatsQuery.data ?? null;
  const recentRecs = recentRecsQuery.data ?? [];
  const upcoming = upcomingQuery.data ?? [];

  const loading =
    roomsQuery.isPending ||
    roomStatsQuery.isPending ||
    recStatsQuery.isPending ||
    recentRecsQuery.isPending ||
    upcomingQuery.isPending ||
    sessionStatsQuery.isPending;

  const myStudents = useMemo(() => rooms.reduce((a, r) => a + r.enrolled_count, 0), [rooms]);
  const hasEnrolledStudent = rooms.some((r) => r.enrolled_count > 0);
  const hasAnyRecitation = useMemo(() => {
    if (!recStats) return false;
    const g = recStats.by_grade;
    return g.excellent + g.good + g.needs_work + g.weak > 0 || recStats.recent_count > 0;
  }, [recStats]);
  /** Checklist step 3 matches “complete a session” — logging recitations is a separate cockpit prompt. */
  const firstSessionDone = (sessionStats?.completed ?? 0) > 0;
  const hasAnySession = (sessionStats?.total ?? 0) > 0;
  const activeRoomCount = roomStats?.active ?? rooms.length;
  const activated = isTeacherActivated({
    roomTotal: activeRoomCount,
    hasEnrolledStudent,
    completedSessions: sessionStats?.completed ?? 0,
    hasAnyRecitation,
  });

  const recentCompletedHasZeroRecitations =
    !!recentCompleted &&
    !sessionRecsQuery.isPending &&
    (sessionRecsQuery.data?.length ?? 0) === 0;

  // Ignore live sessions whose room is no longer in the active list (e.g. just archived).
  const liveForActiveRooms = useMemo(() => {
    if (rooms.length === 0) return [];
    const ids = new Set(rooms.map((r) => r.id));
    return liveSessions.filter((s) => ids.has(s.room_id));
  }, [liveSessions, rooms]);

  const cockpitState = useMemo(
    () =>
      selectTeacherCockpitState({
        teacherId: user.id,
        rooms,
        liveSessions: liveForActiveRooms,
        upcomingScheduled: upcoming,
        recentCompleted,
        recentCompletedHasZeroRecitations,
      }),
    [user.id, rooms, liveForActiveRooms, upcoming, recentCompleted, recentCompletedHasZeroRecitations],
  );

  const hideLiveNowCard = cockpitState.kind === "live";

  function startInstant(roomId: string | null, createNew = false) {
    setInstantError(null);
    instantMutation.mutate({ room_id: roomId, create_new: createNew });
  }

  function handleInstantClick() {
    setInstantError(null);
    if (rooms.length >= 2) {
      setPickerOpen(true);
      return;
    }
    startInstant(rooms.length === 1 ? rooms[0]!.id : null);
  }

  function openInviteForFirstRoom() {
    const room = rooms[0];
    if (room) setInviteRoom(room);
  }

  const headerActions = (
    <NewSessionMenu open={newSessionMenuOpen} onOpenChange={setNewSessionMenuOpen} />
  );

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-[var(--color-primary)] border-t-transparent" />
      </div>
    );
  }

  return (
    <PageShell
      titleSize="hero"
      title={homeGreeting}
      meta={dateLine}
      description={t("home.teacherDashboard")}
      contentClassName="space-y-8"
      actions={headerActions}
    >
      <InstantHalaqahPickerModal
        open={pickerOpen}
        rooms={rooms}
        loading={instantMutation.isPending}
        onClose={() => setPickerOpen(false)}
        onPick={(roomId) => startInstant(roomId)}
        onNewHalaqah={() => startInstant(null, true)}
      />
      {inviteRoom ? (
        <InviteStudentsModal open room={inviteRoom} onClose={() => setInviteRoom(null)} />
      ) : null}
      {instantError ? (
        <p className="text-sm text-red-600" role="alert">
          {instantError}
        </p>
      ) : null}

      {/* Action zone */}
      {hasAnySession && !activated ? (
        <GettingStartedChecklist
          hasAnySession={hasAnySession}
          hasEnrolledStudent={hasEnrolledStudent}
          firstSessionDone={firstSessionDone}
          firstRoomId={rooms[0]?.id ?? null}
          onCreateFirstSession={() => setNewSessionMenuOpen(true)}
          onInvite={openInviteForFirstRoom}
          onCompleteFirstSession={handleInstantClick}
        />
      ) : null}

      <TeacherActionCard
        state={cockpitState}
        rooms={rooms}
        instantLoading={instantMutation.isPending}
        onInstantStart={handleInstantClick}
        onInvite={(room) => setInviteRoom(room)}
        onSchedule={(room) => void navigate(`/rooms/${room.id}`)}
      />
      {!hideLiveNowCard ? <LiveNowDashboardCard /> : null}

      {!hasAnySession ? (
        <DemoEntry variant="card" hasCompletedSession={(sessionStats?.completed ?? 0) > 0} />
      ) : null}

      <TodayAgenda />

      {hasAnySession ? (
        <DemoEntry variant="strip" hasCompletedSession={(sessionStats?.completed ?? 0) > 0} />
      ) : null}

      {activated ? <WhatsNewStrip role="teacher" /> : null}

      {/* Stats demoted below the fold */}
      {activeRoomCount > 0 ? (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <button
              type="button"
              onClick={() => void navigate("/rooms")}
              className="rounded-2xl border border-gray-100 bg-[var(--color-surface)] p-4 text-start shadow-sm transition hover:border-[var(--color-primary)]/30"
            >
              <div className="flex items-center gap-3">
                <Users className="h-8 w-8 text-[var(--color-primary)]" />
                <p className="text-xs text-[var(--color-text-muted)]">{t("home.stats.myHalaqat")}</p>
              </div>
              <div className="mt-2 flex items-end gap-2 text-sm text-[var(--color-text-muted)]">
                <span className="text-2xl font-bold text-[var(--color-gold)]">{activeRoomCount}</span>
                <span>{t("home.stats.rooms")}</span>
                <span aria-hidden>·</span>
                <span className="text-2xl font-bold text-[var(--color-gold)]">{myStudents}</span>
                <span>{t("home.stats.students")}</span>
              </div>
            </button>

            <button
              type="button"
              onClick={() => void navigate("/recitations")}
              className="rounded-2xl border border-gray-100 bg-[var(--color-surface)] p-4 text-start shadow-sm transition hover:border-[var(--color-primary)]/30"
            >
              <div className="flex items-center gap-3">
                <TrendingUp className="h-8 w-8 text-[var(--color-gold)]" />
                <p className="text-xs text-[var(--color-text-muted)]">{t("home.stats.thisWeek")}</p>
              </div>
              <div className="mt-1 flex items-end gap-2">
                <span className="text-2xl font-bold text-[var(--color-gold)]">{recStats?.recent_count ?? 0}</span>
                <span className="text-sm text-[var(--color-text-muted)]">{t("home.stats.recitationsLabel")}</span>
              </div>
              <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                {t("home.stats.completedSessions", { count: sessionStats?.completed ?? 0 })} ·{" "}
                {t("home.stats.attendanceRate", {
                  rate: sessionStats != null ? sessionStats.avg_attendance_pct.toFixed(1) : "0.0",
                })}
              </p>
            </button>

            <section className="rounded-2xl border border-gray-100 bg-[var(--color-surface)] p-4 shadow-sm">
              <h2 className="mb-3 text-xs text-[var(--color-text-muted)]">{t("home.gradeDistribution")}</h2>
              <GradeDistributionBar
                excellent={recStats?.by_grade.excellent ?? 0}
                good={recStats?.by_grade.good ?? 0}
                needs_work={recStats?.by_grade.needs_work ?? 0}
                weak={recStats?.by_grade.weak ?? 0}
              />
            </section>
          </div>

          <section className="rounded-2xl border border-gray-100 bg-[var(--color-surface)] p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-[var(--color-text)]">
              {t("home.teacherRecentRecitationsTitle")}
            </h2>
            <div className="mt-4">
              <RecentRecitationsList items={recentRecs} showStudent />
            </div>
            <div className="mt-4 text-center">
              <Link to="/recitations" className="text-sm font-medium text-[var(--color-primary)] hover:underline">
                {t("home.viewAll")}
              </Link>
            </div>
          </section>
        </>
      ) : null}
    </PageShell>
  );
}

function StudentDashboard({ user, homeGreeting }: { user: User; homeGreeting: string }) {
  const { t, i18n } = useTranslation();
  const dateLine = useTodayDateLine();
  const { sessions: liveSessions } = useLiveSessions();
  const loc = i18n.language === "ar" ? "ar" : i18n.language === "fr" ? "fr" : "en";

  const progressQuery = useStudentProgress(user?.id, !!user?.id);

  const enrolledRoomsQuery = useRoomsList("student-home-enrolled", undefined, {
    enabled: !!user?.id,
    staleTime: 60_000,
  });

  const recentRecsQuery = useStudentRecitations(user?.id, { enabled: !!user?.id, limit: 3 });

  const upcomingQuery = useUpcomingSessions(!!user?.id);

  const publicRoomsQuery = useRoomsList(
    "student-home-public-discovery",
    { is_public: true, my_status: "none", limit: 4 },
    {
      enabled: !!user?.id,
      staleTime: 5 * 60_000,
    },
  );

  const openAnnotationsQuery = useOpenErrorAnnotations(user?.id, !!user?.id);
  const nextTargetQuery = useMyNextTarget(!!user?.id);

  const progress = progressQuery.data ?? null;
  const rooms = enrolledRoomsQuery.data ?? [];
  const recentRecs = recentRecsQuery.data ?? [];
  const upcoming = upcomingQuery.data ?? [];
  const publicRooms = publicRoomsQuery.data ?? [];
  const openAnnotations = openAnnotationsQuery.data ?? [];
  const nextTarget = nextTargetQuery.data ?? null;

  const loading =
    !!user?.id &&
    (progressQuery.isPending ||
      enrolledRoomsQuery.isPending ||
      recentRecsQuery.isPending ||
      upcomingQuery.isPending ||
      publicRoomsQuery.isPending);

  const liveSession = useMemo(() => {
    const enrolledRoomIds = new Set(rooms.map((r) => r.id));
    return (
      liveSessions.find(
        (s) => s.status === "in_progress" && enrolledRoomIds.has(s.room_id),
      ) ?? null
    );
  }, [liveSessions, rooms]);

  const nextSession = useMemo(() => {
    if (liveSession) return null;
    return upcoming.find((s) => s.status === "scheduled" || s.status === "in_progress") ?? upcoming[0] ?? null;
  }, [upcoming, liveSession]);

  const latestOpenSurah = useMemo(() => {
    if (openAnnotations.length === 0) return null;
    const latest = [...openAnnotations].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    )[0];
    return latest?.surah ?? null;
  }, [openAnnotations]);

  const lastRecitation = recentRecs[0] ?? null;
  const hasNoRecitations = (progress?.total_recitations ?? 0) === 0;
  const gd = progress?.grade_distribution;
  const surahCount = progress?.surahs_covered.length ?? 0;
  const gradeSum =
    (gd?.excellent ?? 0) + (gd?.good ?? 0) + (gd?.needs_work ?? 0) + (gd?.weak ?? 0);

  const actionZone = (
    <>
      <StudentNextSessionCard liveSession={liveSession} nextSession={nextSession} />
      <StudentReviewCard
        count={openAnnotations.length}
        latestSurah={latestOpenSurah}
        reviewTo={`/students/${user.id}/progress`}
      />
      {lastRecitation ? (
        <section className="rounded-xl bg-white p-4 shadow-sm" style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
          <h2 className="mb-3 text-sm font-semibold text-[var(--color-text)]">
            {t("studentHome.lastRecitation")}
          </h2>
          <RecentRecitationsList items={[lastRecitation]} />
          {nextTarget ? (
            <p className="mt-3 text-sm font-semibold" style={{ color: "#D4A843" }}>
              {t("memory.nextTarget", {
                range: `${getSurahNameWithArabic(nextTarget.surah, loc)} ${
                  nextTarget.ayah_start === nextTarget.ayah_end
                    ? nextTarget.ayah_start
                    : `${nextTarget.ayah_start}–${nextTarget.ayah_end}`
                }`,
              })}
            </p>
          ) : null}
        </section>
      ) : null}
    </>
  );

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-[var(--color-primary)] border-t-transparent" />
      </div>
    );
  }

  if (rooms.length === 0) {
    return (
      <PageShell
        titleSize="hero"
        title={homeGreeting}
        meta={dateLine}
        description={t("home.studentSubtitle")}
        contentClassName="space-y-8"
      >
        <WhatsNewStrip role="student" />
        <StudentEmptyHero />
      </PageShell>
    );
  }

  if (rooms.length > 0 && hasNoRecitations) {
    return (
      <PageShell
        titleSize="hero"
        title={homeGreeting}
        meta={dateLine}
        description={t("home.studentSubtitle")}
        contentClassName="space-y-8"
      >
        {actionZone}
        <EmptyState
          size="large"
          icon={<BookMarked className="h-16 w-16" />}
          title={t("home.studentStartingTitle")}
          description={t("home.studentStartingDescription")}
        />

        <section className="rounded-2xl border border-gray-100 bg-[var(--color-surface)] p-6 shadow-sm">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-lg font-semibold text-[var(--color-text)]">{t("home.discoverHalaqatTitle")}</h2>
              <p className="mt-0.5 text-sm text-[var(--color-text-muted)]">{t("home.discoverHalaqatDescription")}</p>
            </div>
            {publicRooms.length > 0 ? (
              <Link to="/rooms" className="text-sm font-medium text-[var(--color-primary)] hover:underline">
                {t("home.discoverHalaqatSeeAll")}
              </Link>
            ) : null}
          </div>
          {publicRooms.length === 0 ? (
            <p className="text-sm text-[var(--color-text-muted)]">{t("home.discoverHalaqatEmpty")}</p>
          ) : (
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {publicRooms.map((r) => (
                <li key={r.id}>
                  <Link
                    to={`/rooms/${r.id}`}
                    className="block rounded-xl border border-gray-100 bg-[var(--color-bg)] p-4 transition hover:border-[var(--color-primary)]/30"
                  >
                    <p className="font-medium text-[var(--color-text)]">{r.name}</p>
                    <p className="mt-0.5 text-sm text-[var(--color-text-muted)]">{r.teacher_name}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <span
                        className={`inline-flex rounded-md border px-1.5 py-0.5 text-[0.65rem] font-semibold ${riwayaBadgeClass(r.riwaya)}`}
                      >
                        {t(`mushaf.${r.riwaya}`)}
                      </span>
                      <span className="text-xs text-[var(--color-text-muted)]">
                        · {t("rooms.enrolledFraction", { enrolled: r.enrolled_count, max: r.max_students })}
                      </span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-2xl border border-gray-100 bg-[var(--color-surface)] p-6 shadow-sm">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-[var(--color-text)]">{t("home.quranMapTitle")}</h2>
            <p className="mt-0.5 text-sm text-[var(--color-text-muted)]">{t("home.quranMapDescription")}</p>
          </div>
          <SurahProgressGrid surahBestGrades={progress?.surah_best_grades ?? []} />
        </section>
      </PageShell>
    );
  }

  return (
    <PageShell
      titleSize="hero"
      title={homeGreeting}
      meta={dateLine}
      description={t("home.studentSubtitle")}
      contentClassName="space-y-8"
      actions={
        <Button asChild variant="primary" size="lg">
          <Link to={`/students/${user.id}/progress`}>{t("home.myProgress")}</Link>
        </Button>
      }
    >
      {actionZone}

      <WhatsNewStrip role="student" />

      {progress ? (
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-[var(--color-text)]">{t("home.progressOverview")}</h2>
            <Button asChild variant="secondary" size="sm">
              <Link to={`/students/${user.id}/progress`}>{t("home.viewFullProgress")}</Link>
            </Button>
          </div>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="flex items-center gap-4 rounded-2xl border border-gray-100 bg-[var(--color-surface)] p-5 shadow-sm">
              <SurahProgressRing covered={surahCount} />
              <div>
                <p className="text-sm text-[var(--color-text-muted)]">{t("recitations.surahsCovered")}</p>
                <p className="mt-1 text-lg font-semibold text-[var(--color-text)]">
                  {t("home.surahsCoveredCount", { count: surahCount })}
                </p>
              </div>
            </div>
            <CombinedStreakCard maqraaStreakDays={progress.streak_days} />
            <div className="rounded-2xl border border-gray-100 bg-[var(--color-surface)] p-5 shadow-sm">
              <p className="text-sm text-[var(--color-text-muted)]">{t("home.totalRecitations")}</p>
              <p className="mt-1 text-2xl font-bold" style={{ color: "var(--color-gold)" }}>
                {progress.total_recitations}
              </p>
            </div>
          </div>
        </section>
      ) : (
        <p className="text-sm text-[var(--color-text-muted)]">{t("home.statsLoadError")}</p>
      )}

      {progress && gd ? (
        <section className="rounded-2xl border border-gray-100 bg-[var(--color-surface)] p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-[var(--color-text)]">{t("home.gradeDistribution")}</h2>
          {gradeSum === 0 ? (
            <p className="text-sm text-[var(--color-text-muted)]">{t("home.noGradesYet")}</p>
          ) : (
            <GradeDistributionBar
              excellent={gd.excellent}
              good={gd.good}
              needs_work={gd.needs_work}
              weak={gd.weak}
            />
          )}
        </section>
      ) : null}

      {progress && progress.surahs_covered.length > 0 ? (
        <section className="rounded-2xl border border-gray-100 bg-[var(--color-surface)] p-6 shadow-sm">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-[var(--color-text)]">{t("recitations.surahsCovered")}</h2>
            <Link
              to={`/students/${user.id}/progress`}
              className="text-sm font-medium text-[var(--color-primary)] hover:underline"
            >
              {t("home.viewFullProgress")}
            </Link>
          </div>
          <SurahProgressGrid surahBestGrades={progress.surah_best_grades} />
        </section>
      ) : null}

      <section className="rounded-2xl border border-gray-100 bg-[var(--color-surface)] p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-[var(--color-text)]">{t("home.studentRooms")}</h2>
        <ul className="mt-4 space-y-3">
          {rooms.map((r) => (
            <li key={r.id}>
              <Link
                to={`/rooms/${r.id}`}
                className="block rounded-xl border border-gray-100 bg-[var(--color-bg)] p-4 transition hover:border-[var(--color-primary)]/30"
              >
                <p className="font-medium text-[var(--color-text)]">{r.name}</p>
                <p className="text-sm text-[var(--color-text-muted)]">{r.teacher_name}</p>
                <span
                  className={`mt-2 inline-flex rounded-lg border px-2 py-0.5 text-xs font-semibold ${riwayaBadgeClass(r.riwaya)}`}
                >
                  {t(`mushaf.${r.riwaya}`)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-2xl border border-gray-100 bg-[var(--color-surface)] p-6 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold text-[var(--color-text)]">{t("home.discoverHalaqatTitle")}</h2>
            <p className="mt-0.5 text-sm text-[var(--color-text-muted)]">{t("home.discoverHalaqatDescription")}</p>
          </div>
          {publicRooms.length > 0 ? (
            <Link to="/rooms" className="text-sm font-medium text-[var(--color-primary)] hover:underline">
              {t("home.discoverHalaqatSeeAll")}
            </Link>
          ) : null}
        </div>
        {publicRooms.length === 0 ? (
          <p className="text-sm text-[var(--color-text-muted)]">{t("home.discoverHalaqatEmpty")}</p>
        ) : (
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {publicRooms.map((r) => (
              <li key={r.id}>
                <Link
                  to={`/rooms/${r.id}`}
                  className="block rounded-xl border border-gray-100 bg-[var(--color-bg)] p-4 transition hover:border-[var(--color-primary)]/30"
                >
                  <p className="font-medium text-[var(--color-text)]">{r.name}</p>
                  <p className="mt-0.5 text-sm text-[var(--color-text-muted)]">{r.teacher_name}</p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </PageShell>
  );
}
