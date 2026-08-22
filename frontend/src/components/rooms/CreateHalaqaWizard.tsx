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
import { cn } from "@/lib/utils";

/** Step-1 only wizard — after create, continue to `/rooms/:id/setup`. */
export function CreateHalaqaWizard() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === "admin";

  const [createdRoom, setCreatedRoom] = useState<Room | null>(null);
  const [formPending, setFormPending] = useState(false);

  const handleRoomSuccess = useCallback(
    (created?: Room) => {
      const room = created ?? createdRoom;
      if (!room) return;
      setCreatedRoom(room);
      navigate(`/rooms/${room.id}/setup?step=session`, { replace: true });
    },
    [createdRoom, navigate],
  );

  return (
    <>
      <div className="mb-6">
        <div className="flex items-center justify-center gap-0">
          {(["halaqa", "session", "share"] as const).map((s, i) => {
            const labels = {
              halaqa: t("wizard.stepHalaqa"),
              session: t("wizard.stepSession"),
              share: t("wizard.stepShare"),
            };
            const active = s === "halaqa";
            return (
              <div key={s} className="flex items-center">
                <div className="flex flex-col items-center gap-1.5">
                  <div
                    className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold",
                      active ? "bg-[#1B5E20] text-white" : "bg-[#E5E7EB] text-[var(--color-text-muted)]",
                    )}
                    aria-current={active ? "step" : undefined}
                  >
                    {i + 1}
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
                {i < 2 ? <div className="mx-2 mb-5 h-0.5 w-8 bg-[#E5E7EB] sm:w-12" aria-hidden /> : null}
              </div>
            );
          })}
        </div>
      </div>

      <RoomForm
        active
        mode={createdRoom ? "edit" : "create"}
        room={createdRoom}
        isAdmin={isAdmin}
        formId="wizard-room-form"
        showFooter={false}
        onSuccess={handleRoomSuccess}
        onPendingChange={setFormPending}
      />

      <div className="mt-8 flex flex-wrap items-center justify-end gap-2 border-t border-gray-100 pt-6">
        <Button type="submit" form="wizard-room-form" variant="primary" loading={formPending}>
          {t("wizard.next")}
        </Button>
      </div>
    </>
  );
}

/** Compact stepper for setup page (steps 2–3). */
export function SetupWizardStepper({
  step,
  sessionDone,
}: {
  step: "session" | "share";
  sessionDone: boolean;
}) {
  const { t } = useTranslation();
  const steps = [
    { id: "halaqa" as const, label: t("wizard.stepHalaqa"), done: true },
    { id: "session" as const, label: t("wizard.stepSession"), done: sessionDone && step === "share" },
    { id: "share" as const, label: t("wizard.stepShare"), done: false },
  ];
  const currentIndex = step === "session" ? 1 : 2;

  return (
    <div className="mb-6">
      <div className="flex items-center justify-center gap-0">
        {steps.map((s, i) => {
          const active = (step === "session" && s.id === "session") || (step === "share" && s.id === "share");
          const done = s.done || (s.id === "halaqa");
          const future = i > currentIndex;
          return (
            <div key={s.id} className="flex items-center">
              <div className="flex flex-col items-center gap-1.5">
                <div
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold transition-colors",
                    done && !active && "bg-[#4CAF50] text-white",
                    active && "bg-[#1B5E20] text-white",
                    future && !active && "bg-[#E5E7EB] text-[var(--color-text-muted)]",
                  )}
                  aria-current={active ? "step" : undefined}
                >
                  {done && !active ? <Check className="h-4 w-4" aria-hidden /> : i + 1}
                </div>
                <span
                  className={cn(
                    "text-xs font-medium",
                    active ? "text-[var(--color-text)]" : "text-[var(--color-text-muted)]",
                  )}
                >
                  {s.label}
                </span>
              </div>
              {i < steps.length - 1 ? (
                <div
                  className={cn(
                    "mx-2 mb-5 h-0.5 w-8 sm:w-12",
                    i < currentIndex || done ? "bg-[#4CAF50]" : "bg-[#E5E7EB]",
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
