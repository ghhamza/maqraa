// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ArrowLeft, ArrowRight, Check, Sparkles, X } from "lucide-react";
import { Button } from "../ui/Button";
import { cn } from "@/lib/utils";

const STORAGE_PREFIX = "miqraa.gettingStarted.dismissed.";

export interface GettingStartedBannerProps {
  roomId: string;
  hasStudents: boolean;
  hasSessions: boolean;
  onAddStudent: () => void;
  onAddSession: () => void;
}

export function GettingStartedBanner({
  roomId,
  hasStudents,
  hasSessions,
  onAddStudent,
  onAddSession,
}: GettingStartedBannerProps) {
  const { t } = useTranslation();
  const storageKey = useMemo(() => `${STORAGE_PREFIX}${roomId}`, [roomId]);

  const [dismissed, setDismissed] = useState(() => {
    try {
      return typeof window !== "undefined" && window.localStorage.getItem(storageKey) === "1";
    } catch {
      return false;
    }
  });

  const dismiss = useCallback(() => {
    try {
      window.localStorage.setItem(storageKey, "1");
    } catch {
      /* ignore quota / private mode */
    }
    setDismissed(true);
  }, [storageKey]);

  if (dismissed || (hasStudents && hasSessions)) {
    return null;
  }

  return (
    <div
      className={cn(
        "relative mb-6 rounded-xl border border-[#FDF6E3] bg-[#FDF6E3]/40 px-5 pb-4 pt-5 shadow-sm",
        "dark:border-amber-900/40 dark:bg-amber-950/30",
      )}
      role="region"
      aria-label={t("room.gettingStarted.title")}
    >
      {/* Close button — sits in the end-side corner, opposite the heading */}
      <button
        type="button"
        className="absolute top-3 end-3 z-10 rounded-md p-1.5 text-[#6B7280] hover:bg-black/5 hover:text-[var(--color-text)] dark:hover:bg-white/10"
        aria-label={t("room.gettingStarted.dismissAria")}
        onClick={dismiss}
      >
        <X className="h-4 w-4" />
      </button>

      {/* Heading row — sparkle + title on the start side */}
      <div className="flex items-start gap-2 pe-8">
        <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-[#D4A843]" aria-hidden />
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold text-[var(--color-text)]">
            {t("room.gettingStarted.title")}
          </h2>
          <p className="mt-0.5 text-sm text-[#6B7280]">
            {t("room.gettingStarted.subtitle")}
          </p>
        </div>
      </div>

      {/* Steps */}
      <div className="mt-5 space-y-4">
        <StepRow
          number={1}
          done={hasStudents}
          title={t("room.gettingStarted.step1Title")}
          description={t("room.gettingStarted.step1Desc")}
          cta={t("room.gettingStarted.step1Cta")}
          doneLabel={t("room.gettingStarted.stepDone")}
          onAction={onAddStudent}
        />
        <StepRow
          number={2}
          done={hasSessions}
          title={t("room.gettingStarted.step2Title")}
          description={t("room.gettingStarted.step2Desc")}
          cta={t("room.gettingStarted.step2Cta")}
          doneLabel={t("room.gettingStarted.stepDone")}
          onAction={onAddSession}
        />
      </div>

      {/* Skip link — bottom start */}
      <div className="mt-4 flex justify-start">
        <button
          type="button"
          className="text-sm text-[#6B7280] underline-offset-4 hover:text-[var(--color-text)] hover:underline"
          onClick={dismiss}
        >
          {t("room.gettingStarted.skip")}
        </button>
      </div>
    </div>
  );
}

interface StepRowProps {
  number: number;
  done: boolean;
  title: string;
  description: string;
  cta: string;
  doneLabel: string;
  onAction: () => void;
}

function StepRow({ number, done, title, description, cta, doneLabel, onAction }: StepRowProps) {
  return (
    <div className="flex items-center justify-between gap-3">
      {/* START side: badge + text block (FIRST child = start in RTL/LTR) */}
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <div
          className={cn(
            "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
            done ? "bg-[#1B5E20] text-white" : "bg-[#1B5E20] text-white",
          )}
          aria-hidden
        >
          {done ? <Check className="h-3.5 w-3.5 stroke-[3]" /> : number}
        </div>
        <div className="min-w-0">
          <p className="font-medium text-[var(--color-text)]">{title}</p>
          <p className="mt-0.5 text-sm text-[#6B7280]">{description}</p>
        </div>
      </div>

      {/* END side: action OR done badge (SECOND child = end in RTL/LTR) */}
      <div className="shrink-0">
        {done ? (
          <span className="inline-flex items-center gap-1 rounded-md bg-[#1B5E20]/10 px-2.5 py-1 text-xs font-medium text-[#1B5E20]">
            <Check className="h-3 w-3 stroke-[3]" aria-hidden />
            {doneLabel}
          </span>
        ) : (
          <Button type="button" variant="primary" size="sm" onClick={onAction}>
            <span className="inline-flex items-center gap-1.5">
              {cta}
              <ArrowRight className="h-3.5 w-3.5 ltr:inline rtl:hidden" aria-hidden />
              <ArrowLeft className="h-3.5 w-3.5 rtl:inline ltr:hidden" aria-hidden />
            </span>
          </Button>
        )}
      </div>
    </div>
  );
}