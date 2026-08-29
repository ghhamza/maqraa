// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

export interface GettingStartedChecklistProps {
  /** ≥1 session created (session-first onboarding). */
  hasAnySession: boolean;
  hasEnrolledStudent: boolean;
  /** ≥1 completed session (recitations are prompted separately on the cockpit). */
  firstSessionDone: boolean;
  firstRoomId: string | null;
  onCreateFirstSession?: () => void;
  onInvite?: () => void;
  onCompleteFirstSession?: () => void;
}

type StepAction =
  | { kind: "link"; to: string }
  | { kind: "button"; onClick: () => void }
  | { kind: "none" };

export function GettingStartedChecklist({
  hasAnySession,
  hasEnrolledStudent,
  firstSessionDone,
  firstRoomId,
  onCreateFirstSession,
  onInvite,
  onCompleteFirstSession,
}: GettingStartedChecklistProps) {
  const { t } = useTranslation();
  const stepsDone = [hasAnySession, hasEnrolledStudent, firstSessionDone] as const;
  const doneCount = stepsDone.filter(Boolean).length;
  if (doneCount === 3) return null;

  const actions: StepAction[] = [
    onCreateFirstSession
      ? { kind: "button", onClick: onCreateFirstSession }
      : { kind: "link", to: "/calendar" },
    onInvite
      ? { kind: "button", onClick: onInvite }
      : { kind: "link", to: firstRoomId ? `/rooms/${firstRoomId}` : "/rooms" },
    onCompleteFirstSession
      ? { kind: "button", onClick: onCompleteFirstSession }
      : { kind: "link", to: "/calendar" },
  ];

  const copy = [
    { title: t("home.gettingStartedStep1"), hint: t("home.gettingStartedStep1Hint") },
    { title: t("home.gettingStartedStep2Title"), hint: t("home.gettingStartedStep2v2") },
    { title: t("home.gettingStartedStep3v2"), hint: t("home.gettingStartedStep3Hint") },
  ];

  return (
    <section
      className="rounded-2xl border border-gray-100 bg-[var(--color-surface)] p-5 shadow-sm sm:p-6"
      aria-label={t("home.gettingStartedTitle")}
    >
      <h2 className="text-base font-bold text-[var(--color-text)] sm:text-lg">
        {t("home.gettingStartedTitle")}
      </h2>

      <ol className="relative mt-6 grid grid-cols-1 gap-6 sm:grid-cols-3 sm:gap-4">
        <div
          className="pointer-events-none absolute start-[16.67%] end-[16.67%] top-5 hidden border-t border-dashed border-gray-200 sm:block"
          aria-hidden
        />

        {copy.map((step, i) => {
          const done = stepsDone[i];
          const action = actions[i];
          const n = i + 1;
          const body = (
            <>
              <span
                className={cn(
                  "relative z-[1] flex size-10 shrink-0 items-center justify-center rounded-full border-2 bg-[var(--color-surface)] text-sm font-bold tabular-nums",
                  done
                    ? "border-[var(--color-primary)] text-[var(--color-primary)]"
                    : "border-gray-200 text-[var(--color-text-muted)]",
                )}
                aria-hidden
              >
                {n}
              </span>
              <span className="min-w-0 text-center sm:px-1">
                <span className="block text-sm font-semibold leading-snug text-[var(--color-text)]">
                  {step.title}
                </span>
                <span className="mt-0.5 block text-xs leading-snug text-[var(--color-text-muted)]">
                  {step.hint}
                </span>
              </span>
            </>
          );

          const className = cn(
            "relative flex flex-row items-center gap-3 sm:flex-col sm:text-center",
            !done &&
              "cursor-pointer rounded-xl outline-none transition hover:opacity-90 focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]",
            done && "pointer-events-none",
          );

          if (!done && action.kind === "button") {
            return (
              <li key={n} className="min-w-0">
                <button type="button" className={cn(className, "w-full")} onClick={action.onClick}>
                  {body}
                </button>
              </li>
            );
          }

          if (!done && action.kind === "link") {
            return (
              <li key={n} className="min-w-0">
                <Link to={action.to} className={className}>
                  {body}
                </Link>
              </li>
            );
          }

          return (
            <li key={n} className={cn(className, "min-w-0")}>
              {body}
            </li>
          );
        })}
      </ol>

      <div className="mt-6 space-y-2">
        <p className="text-sm font-semibold text-[var(--color-primary)]">
          {t("home.gettingStartedProgress", { done: doneCount, total: 3 })}
        </p>
        <div
          className="h-2 overflow-hidden rounded-full bg-gray-100"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={3}
          aria-valuenow={doneCount}
          aria-label={t("home.gettingStartedProgress", { done: doneCount, total: 3 })}
        >
          <div
            className="h-full rounded-full bg-[var(--color-primary)] transition-[width] duration-300"
            style={{ width: `${(doneCount / 3) * 100}%` }}
          />
        </div>
      </div>
    </section>
  );
}
