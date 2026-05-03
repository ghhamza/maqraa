// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

import { X } from "lucide-react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "../ui/Button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "../ui/sheet";
import type { SessionParticipant } from "../../hooks/useSessionState";
import type { RecitationPublic } from "../../types";
import { SessionRecitationsSortableList } from "../sessions/SessionRecitationsSortableList";
import { userFacingApiError } from "../../lib/api";
import { ZoneSection } from "./plan-rows/ZoneSection";
import { TeacherRow } from "./plan-rows/TeacherRow";
import { DonePlanRow } from "./plan-rows/DonePlanRow";
import { NowRecitingCard } from "./plan-rows/NowRecitingCard";
import { PausedPlanRow } from "./plan-rows/PausedPlanRow";
import { NotInPlanRow } from "./plan-rows/NotInPlanRow";
import { OfflineStudentRow } from "./plan-rows/OfflineStudentRow";

interface ParticipantDrawerProps {
  open: boolean;
  onClose: () => void;
  participants: SessionParticipant[];
  teacherId: string;
  isTeacher: boolean;
  /** Same pattern as mushaf navigator: LTR → right edge, RTL → left edge. */
  side?: "left" | "right";

  /** Enrolled students not in the live room (from session attendance); no session plan row for them. */
  offlineStudents: { student_id: string; student_name: string }[];
  sessionId: string;
  plans: RecitationPublic[];
  onPlansChange: (next: RecitationPublic[]) => void;
  onStartPlan: (planId: string) => Promise<void>;
  onPausePlan: (planId: string) => Promise<void>;
  onSkipPlan: (planId: string) => Promise<void>;
  onReopenPlan: (planId: string, clearGrade: boolean) => Promise<void>;
  onAdHocStart: (studentId: string) => void;
  onEndGradeForPlan: (planId: string) => void;
  onPlanTransitionError: (message: string) => void;
}

export function ParticipantDrawer({
  open,
  onClose,
  participants,
  teacherId,
  isTeacher,
  offlineStudents,
  side: sideProp,
  sessionId,
  plans,
  onPlansChange,
  onStartPlan,
  onPausePlan,
  onSkipPlan,
  onReopenPlan,
  onAdHocStart,
  onEndGradeForPlan,
  onPlanTransitionError,
}: ParticipantDrawerProps) {
  const { t, i18n } = useTranslation();
  const loc = i18n.language === "ar" ? "ar" : i18n.language === "fr" ? "fr" : "en";

  const sheetSide = sideProp ?? (i18n.language?.startsWith("ar") ? "left" : "right");

  const sorted = useMemo(
    () =>
      [...participants].sort((a, b) => {
        if (a.userId === teacherId) return -1;
        if (b.userId === teacherId) return 1;
        return a.name.localeCompare(b.name, "ar");
      }),
    [participants, teacherId],
  );

  const teacher = sorted.find((p) => p.userId === teacherId);
  const onlineStudents = sorted.filter((p) => p.userId !== teacherId);

  const participantById = useMemo(() => {
    const m = new Map<string, SessionParticipant>();
    for (const p of sorted) m.set(p.userId, p);
    return m;
  }, [sorted]);

  const donePlans = useMemo(
    () =>
      plans
        .filter((p) => p.plan_status === "completed" || p.plan_status === "skipped")
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
    [plans],
  );

  const activePlan = useMemo(() => plans.find((p) => p.plan_status === "in_progress") ?? null, [plans]);

  const pausedPlans = useMemo(
    () => plans.filter((p) => p.plan_status === "paused").sort((a, b) => a.order_index - b.order_index),
    [plans],
  );

  const plannedPlans = useMemo(() => {
    const list = plans.filter((p) => p.plan_status === "planned");
    const onlineIds = new Set(onlineStudents.map((s) => s.userId));
    return [...list].sort((a, b) => {
      const aLive = Boolean(a.student_id && onlineIds.has(a.student_id));
      const bLive = Boolean(b.student_id && onlineIds.has(b.student_id));
      if (aLive !== bLive) return aLive ? -1 : 1;
      return a.order_index - b.order_index;
    });
  }, [plans, onlineStudents]);

  const studentsWithAnyPlan = useMemo(() => {
    const s = new Set<string>();
    for (const p of plans) {
      if (p.student_id) s.add(p.student_id);
    }
    return s;
  }, [plans]);

  const onlineNotInPlan = useMemo(
    () => onlineStudents.filter((p) => !studentsWithAnyPlan.has(p.userId)),
    [onlineStudents, studentsWithAnyPlan],
  );

  const connectedStudentIds = useMemo(
    () => new Set(onlineStudents.map((p) => p.userId)),
    [onlineStudents],
  );

  const wrapPlanOp = (fn: () => Promise<void>) => {
    void fn().catch((e: unknown) => {
      onPlanTransitionError(userFacingApiError(e));
    });
  };

  const plannedToolbar = isTeacher
    ? {
        isTeacher: true,
        onStartPlan: (planId: string) => wrapPlanOp(() => onStartPlan(planId)),
        onSkipPlan: (planId: string) => wrapPlanOp(() => onSkipPlan(planId)),
      }
    : undefined;

  return (
    <Sheet open={open} onOpenChange={(next) => !next && onClose()}>
      <SheetContent
        side={sheetSide}
        showCloseButton={false}
        className="flex h-full max-h-[100dvh] w-full max-w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-sm"
      >
        <SheetHeader className="flex shrink-0 flex-row items-center gap-3 space-y-0 border-b border-border px-4 py-3">
          <SheetClose asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="shrink-0"
              aria-label={t("common.close")}
            >
              <X className="size-4" strokeWidth={2.25} />
            </Button>
          </SheetClose>
          <div className="min-w-0 flex-1 space-y-0.5">
            <SheetTitle className="text-start font-heading text-base font-semibold leading-tight text-foreground">
              {t("liveSession.participants")}
            </SheetTitle>
            <SheetDescription className="sr-only">
              {t("liveSession.participantsSheetDescription")}
            </SheetDescription>
          </div>
        </SheetHeader>

        <div
          className="flex min-h-0 flex-1 flex-col gap-0 overflow-y-auto px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3"
          style={{ fontFamily: "var(--font-ui)" }}
        >
          <div className="space-y-4 pb-4">
            {teacher ? <TeacherRow participant={teacher} /> : null}

            {donePlans.length > 0 ? (
              <ZoneSection title={t("liveSession.zoneDone")}>
                {donePlans.map((plan) => (
                  <DonePlanRow
                    key={plan.id}
                    plan={plan}
                    studentName={participantById.get(plan.student_id ?? "")?.name ?? plan.student_name ?? "—"}
                    isTeacher={isTeacher}
                    locale={loc}
                    onReopen={(clearGrade) => {
                      wrapPlanOp(() => onReopenPlan(plan.id, clearGrade));
                    }}
                  />
                ))}
              </ZoneSection>
            ) : null}

            {activePlan ? (
              <ZoneSection title={t("liveSession.zoneNow")}>
                <NowRecitingCard
                  plan={activePlan}
                  studentName={
                    participantById.get(activePlan.student_id ?? "")?.name ?? activePlan.student_name ?? "—"
                  }
                  locale={loc}
                  isTeacher={isTeacher}
                  onPause={() => wrapPlanOp(() => onPausePlan(activePlan.id))}
                  onSkip={() => wrapPlanOp(() => onSkipPlan(activePlan.id))}
                  onEndGrade={() => onEndGradeForPlan(activePlan.id)}
                />
              </ZoneSection>
            ) : null}

            {pausedPlans.length > 0 ? (
              <ZoneSection title={t("liveSession.zonePaused")}>
                {pausedPlans.map((plan) => (
                  <PausedPlanRow
                    key={plan.id}
                    plan={plan}
                    studentName={participantById.get(plan.student_id ?? "")?.name ?? plan.student_name ?? "—"}
                    locale={loc}
                    isTeacher={isTeacher}
                    onResume={() => wrapPlanOp(() => onStartPlan(plan.id))}
                    onMarkDone={() => onEndGradeForPlan(plan.id)}
                    onSkip={() => wrapPlanOp(() => onSkipPlan(plan.id))}
                  />
                ))}
              </ZoneSection>
            ) : null}

            {plannedPlans.length > 0 ? (
              <ZoneSection title={t("liveSession.zoneNext")}>
                <SessionRecitationsSortableList
                  items={plannedPlans}
                  fullPlansForReorderMerge={plans}
                  sessionId={sessionId}
                  showStudent
                  liveConnectedStudentIds={connectedStudentIds}
                  plannedToolbar={plannedToolbar}
                  onItemsChange={onPlansChange}
                  onPersistFailed={() => onPlanTransitionError(t("plan.reorderFailed"))}
                  onEditItem={undefined}
                />
              </ZoneSection>
            ) : null}

            {onlineNotInPlan.length > 0 ? (
              <ZoneSection title={t("liveSession.zoneOnlineNotInPlan")}>
                {onlineNotInPlan.map((p) => (
                  <NotInPlanRow key={p.userId} participant={p} isTeacher={isTeacher} onGiveMic={() => onAdHocStart(p.userId)} />
                ))}
              </ZoneSection>
            ) : null}

            {offlineStudents.length > 0 ? (
              <ZoneSection title={t("liveSession.zoneNotConnected")}>
                {offlineStudents.map((s) => (
                  <OfflineStudentRow key={s.student_id} studentName={s.student_name} />
                ))}
              </ZoneSection>
            ) : null}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
