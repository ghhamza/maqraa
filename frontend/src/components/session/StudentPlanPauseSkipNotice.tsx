// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

import { Pause, SkipForward } from "lucide-react";
import { useTranslation } from "react-i18next";

import { cn } from "@/lib/utils";

export type StudentPlanNoticeKind = "paused" | "skipped";

interface StudentPlanPauseSkipNoticeProps {
  kind: StudentPlanNoticeKind;
  className?: string;
}

/**
 * Fixed viewport notice for students when the teacher pauses or skips their session plan turn.
 */
export function StudentPlanPauseSkipNotice({ kind, className }: StudentPlanPauseSkipNoticeProps) {
  const { t } = useTranslation();
  const Icon = kind === "paused" ? Pause : SkipForward;
  const label =
    kind === "paused"
      ? t("liveSession.studentTurnPausedNotice")
      : t("liveSession.studentTurnSkippedNotice");

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "pointer-events-none fixed z-[300] flex w-full max-w-[min(22rem,calc(100vw-1.5rem))] justify-center px-3",
        "bottom-[calc(4.5rem+env(safe-area-inset-bottom))] start-1/2 -translate-x-1/2 md:bottom-[5.5rem]",
        className,
      )}
    >
      <div
        className={cn(
          "flex w-full items-center justify-center gap-2 rounded-full border px-3 py-2 shadow-md backdrop-blur-sm",
          kind === "paused"
            ? "border-amber-200/90 bg-amber-50/95 text-amber-950"
            : "border-border bg-muted/95 text-foreground",
        )}
      >
        <Icon className="size-4 shrink-0 opacity-90" aria-hidden />
        <span className="text-center text-sm font-medium leading-snug" style={{ fontFamily: "var(--font-ui)" }}>
          {label}
        </span>
      </div>
    </div>
  );
}
