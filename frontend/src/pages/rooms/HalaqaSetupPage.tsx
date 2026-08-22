// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

import { useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuthStore } from "../../stores/authStore";
import { PageShell } from "../../components/layout/PageShell";
import { PageCard } from "../../components/layout/PageCard";
import { Button } from "../../components/ui/Button";
import { SessionForm } from "../../components/sessions/SessionForm";
import { SetupWizardStepper } from "../../components/rooms/CreateHalaqaWizard";
import { ShareCard } from "../../components/share/ShareCard";
import { useCompleteRoomSetup, useRoom } from "../../data/rooms";
import { formatSessionMecca } from "../../lib/meccaTime";

/** Next calendar day at 20:00 Asia/Riyadh (UTC+3 year-round). */
function nextDayMecca20(): Date {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Riyadh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  const y = get("year");
  const m = get("month");
  const d = get("day");
  // tomorrow 20:00 Riyadh = 17:00 UTC
  return new Date(Date.UTC(y, m - 1, d + 1, 17, 0, 0));
}

export function HalaqaSetupPage() {
  const { id } = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const user = useAuthStore((s) => s.user);

  const roomQuery = useRoom(id);
  const room = roomQuery.data ?? null;
  const completeSetup = useCompleteRoomSetup(id ?? "");

  const [formPending, setFormPending] = useState(false);
  const defaultSessionAt = useMemo(() => nextDayMecca20(), []);

  const canManage =
    !!room &&
    !!user &&
    (user.role === "admin" || (user.role === "teacher" && user.id === room.teacher_id));

  const hasSession = !!room?.first_session || (room?.sessions_count ?? 0) > 0;
  const requested = searchParams.get("step");
  const step: "session" | "share" =
    requested === "share" && hasSession
      ? "share"
      : requested === "session"
        ? "session"
        : hasSession
          ? "share"
          : "session";

  useEffect(() => {
    if (!room || !canManage) return;
    if (room.setup_completed_at) {
      // Allow share step after setup; only bounce if they finished and somehow opened session without needing it
      return;
    }
  }, [room, canManage]);

  useEffect(() => {
    if (!room) return;
    const desired = hasSession ? (requested === "session" ? "session" : "share") : "session";
    if (!requested || (requested === "share" && !hasSession)) {
      setSearchParams({ step: desired }, { replace: true });
    }
  }, [room, hasSession, requested, setSearchParams]);

  if (roomQuery.isPending) {
    return (
      <PageShell title={t("wizard.createHalaqaTitle")}>
        <div className="flex justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#1B5E20]/20 border-t-[#1B5E20]" />
        </div>
      </PageShell>
    );
  }

  if (!room) {
    return <Navigate to="/rooms" replace />;
  }

  if (!canManage) {
    return <Navigate to={`/rooms/${room.id}`} replace />;
  }

  if (room.setup_completed_at && searchParams.get("step") !== "share") {
    return <Navigate to={`/rooms/${room.id}`} replace />;
  }

  async function handleSessionSuccess() {
    try {
      await completeSetup.mutateAsync();
      setSearchParams({ step: "share" }, { replace: true });
    } catch {
      // mutation surfaces toast via useApiMutation if configured
      setSearchParams({ step: "share" }, { replace: true });
    }
  }

  function goToRoom() {
    navigate(`/rooms/${room!.id}`, { replace: true });
  }

  const firstDate = room.first_session
    ? formatSessionMecca(room.first_session.scheduled_at, i18n.language)
    : null;

  return (
    <PageShell
      title={room.name}
      backTo={{ to: "/rooms", label: t("rooms.title") }}
      breadcrumb={[
        { label: t("rooms.title"), to: "/rooms" },
        { label: room.name },
      ]}
      contentClassName="mx-auto max-w-3xl"
    >
      <PageCard>
        <SetupWizardStepper step={step} sessionDone={hasSession || !!room.setup_completed_at} />

        {step === "session" ? (
          <>
            <h2 className="font-[family-name:Amiri,serif] text-2xl text-[#1B5E20]">
              {t("wizard.sessionTitle", { name: room.name })}
            </h2>
            <p className="mt-2 mb-6 text-sm text-[var(--color-text-muted)]">
              {t("wizard.sessionSubtitle")}
            </p>
            <SessionForm
              active
              mode="create"
              session={null}
              lockedRoomId={room.id}
              lockedRoomName={room.name}
              defaultTitle={t("wizard.firstSessionTitle")}
              defaultDatetime={defaultSessionAt}
              formId="setup-session-form"
              showFooter={false}
              onSuccess={() => void handleSessionSuccess()}
              onPendingChange={setFormPending}
            />
            <div className="mt-8 space-y-3 border-t border-gray-100 pt-6">
              <div className="flex justify-end">
                <Button
                  type="submit"
                  form="setup-session-form"
                  variant="primary"
                  size="xl"
                  loading={formPending || completeSetup.isPending}
                >
                  {t("wizard.sessionSubmit")}
                </Button>
              </div>
              <p className="text-center text-xs text-[var(--color-text-muted)]">
                {t("wizard.sessionLocked")}
              </p>
            </div>
          </>
        ) : (
          <>
            <ShareCard
              roomId={room.id}
              roomName={room.name}
              room={room}
              firstSession={room.first_session ?? null}
              shareToken={room.share_token ?? null}
              variant="full"
            />
            {firstDate ? (
              <p className="mt-2 text-center text-sm text-[var(--color-text-muted)]">
                {t("share.firstSession", { date: firstDate })} · {t("share.meccaTime")}
              </p>
            ) : null}
            <div className="mt-8 flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 pt-6">
              <Button type="button" variant="ghost" onClick={goToRoom}>
                {t("wizard.shareSkip")}
              </Button>
              <Button type="button" variant="primary" size="xl" onClick={goToRoom}>
                {t("wizard.shareDone")}
              </Button>
            </div>
          </>
        )}
      </PageCard>
    </PageShell>
  );
}
