// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Check } from "lucide-react";
import type { Room } from "../../types";
import { useAuthStore } from "../../stores/authStore";
import { Button } from "../ui/Button";
import { RoomForm } from "./RoomForm";
import { SessionForm } from "../sessions/SessionForm";
import { EnrollStudentForm } from "../enrollment/EnrollStudentForm";
import { cn } from "@/lib/utils";

type WizardStep = "halaqa" | "session" | "students";

const STEPS: WizardStep[] = ["halaqa", "session", "students"];

function WizardStepper({
  step,
  completedSteps,
}: {
  step: WizardStep;
  completedSteps: Set<WizardStep>;
}) {
  const { t } = useTranslation();
  const labels: Record<WizardStep, string> = {
    halaqa: t("wizard.stepHalaqa"),
    session: t("wizard.stepSession"),
    students: t("wizard.stepStudents"),
  };
  const currentIndex = STEPS.indexOf(step);

  return (
    <div className="mb-6">
      <div className="flex items-center justify-center gap-0">
        {STEPS.map((s, i) => {
          const done = completedSteps.has(s);
          const active = s === step;
          const future = i > currentIndex && !done;
          return (
            <div key={s} className="flex items-center">
              <div className="flex flex-col items-center gap-1.5">
                <div
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold transition-colors",
                    done && "bg-[#4CAF50] text-white",
                    active && !done && "bg-[#1B5E20] text-white",
                    future && "bg-[#E5E7EB] text-[var(--color-text-muted)]",
                  )}
                  aria-current={active ? "step" : undefined}
                >
                  {done ? <Check className="h-4 w-4" aria-hidden /> : i + 1}
                </div>
                <span
                  className={cn(
                    "text-xs font-medium",
                    active ? "text-[var(--color-text)]" : "text-[var(--color-text-muted)]",
                  )}
                >
                  {labels[s]}
                </span>
              </div>
              {i < STEPS.length - 1 ? (
                <div
                  className={cn(
                    "mx-2 mb-5 h-0.5 w-8 sm:w-12",
                    completedSteps.has(s) ? "bg-[#4CAF50]" : "bg-[#E5E7EB]",
                  )}
                  aria-hidden
                />
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Wizard body — mount on {@link CreateHalaqaPage} only. */
export function CreateHalaqaWizard() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === "admin";

  const [step, setStep] = useState<WizardStep>("halaqa");
  const [createdRoom, setCreatedRoom] = useState<Room | null>(null);
  const [completedSteps, setCompletedSteps] = useState<Set<WizardStep>>(() => new Set());
  const [enrolledCount, setEnrolledCount] = useState(0);
  const [studentFormKey, setStudentFormKey] = useState(0);
  const [formPending, setFormPending] = useState(false);

  const finish = useCallback(() => {
    if (createdRoom) {
      navigate(`/rooms/${createdRoom.id}`, { replace: true });
    } else {
      navigate("/rooms", { replace: true });
    }
  }, [createdRoom, navigate]);

  function markStepDone(s: WizardStep) {
    setCompletedSteps((prev) => new Set(prev).add(s));
  }

  function handleRoomSuccess(created?: Room) {
    if (created) {
      setCreatedRoom(created);
    }
    markStepDone("halaqa");
    setStep("session");
  }

  function handleSessionSuccess() {
    markStepDone("session");
    setStep("students");
  }

  function handleStudentEnrolled() {
    setEnrolledCount((c) => c + 1);
    markStepDone("students");
  }

  const roomFormMode = createdRoom ? "edit" : "create";
  const skipHint =
    step === "session" ? t("wizard.skipSessionHint") : step === "students" ? t("wizard.skipStudentsHint") : null;

  return (
    <>
      <WizardStepper step={step} completedSteps={completedSteps} />

      {skipHint ? (
        <p className="mb-4 text-center text-xs text-[var(--color-text-muted)]">{skipHint}</p>
      ) : null}

      <div>
        {step === "halaqa" ? (
          <RoomForm
            active={step === "halaqa"}
            mode={roomFormMode}
            room={createdRoom}
            isAdmin={isAdmin}
            formId="wizard-room-form"
            showFooter={false}
            onSuccess={handleRoomSuccess}
            onPendingChange={setFormPending}
          />
        ) : null}

        {step === "session" && createdRoom ? (
          <SessionForm
            active={step === "session"}
            mode="create"
            session={null}
            lockedRoomId={createdRoom.id}
            defaultRoomId={createdRoom.id}
            formId="wizard-session-form"
            showFooter={false}
            onSuccess={handleSessionSuccess}
            onPendingChange={setFormPending}
          />
        ) : null}

        {step === "students" && createdRoom ? (
          <EnrollStudentForm
            active={step === "students"}
            roomId={createdRoom.id}
            maxStudents={createdRoom.max_students}
            currentCount={enrolledCount}
            resetKey={studentFormKey}
            onEnrolled={handleStudentEnrolled}
          />
        ) : null}
      </div>

      <div className="mt-8 flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 pt-6">
        <div>
          {step === "session" || step === "students" ? (
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                if (step === "session") setStep("students");
                else finish();
              }}
            >
              {t("wizard.skip")}
            </Button>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {step !== "halaqa" ? (
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                if (step === "session") setStep("halaqa");
                else if (step === "students") setStep("session");
              }}
            >
              {t("wizard.back")}
            </Button>
          ) : null}

          {step === "students" && enrolledCount > 0 ? (
            <Button type="button" variant="secondary" onClick={() => setStudentFormKey((k) => k + 1)}>
              {t("wizard.addAnotherStudent")}
            </Button>
          ) : null}

          {step === "halaqa" ? (
            <Button type="submit" form="wizard-room-form" variant="primary" loading={formPending}>
              {t("wizard.next")}
            </Button>
          ) : step === "session" ? (
            <Button type="submit" form="wizard-session-form" variant="primary" loading={formPending}>
              {t("wizard.next")}
            </Button>
          ) : (
            <Button type="button" variant="primary" onClick={finish}>
              {t("wizard.finish")}
            </Button>
          )}
        </div>
      </div>
    </>
  );
}
