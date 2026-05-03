// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

import { ChevronRight, Users } from "lucide-react";
import { useTranslation } from "react-i18next";

import type { RecitationPublic } from "../../types";
import { getSurahNameWithArabic } from "../../lib/quranService";
import { cn } from "@/lib/utils";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
  return name.slice(0, 2).toUpperCase() || "?";
}

export type TeacherReciterPeek =
  | { kind: "plan"; plan: RecitationPublic; studentName: string }
  | { kind: "mic"; studentName: string };

interface TeacherActiveReciterPeekProps {
  peek: TeacherReciterPeek;
  locale: string;
  drawerOpen: boolean;
  onOpenDrawer: () => void;
  className?: string;
}

/**
 * Compact teacher-only control: who has the mic / active plan, tap to reopen the participant drawer.
 */
export function TeacherActiveReciterPeek({
  peek,
  locale,
  drawerOpen,
  onOpenDrawer,
  className,
}: TeacherActiveReciterPeekProps) {
  const { t } = useTranslation();
  const subline =
    peek.kind === "plan"
      ? `${getSurahNameWithArabic(peek.plan.surah, locale)} · ${peek.plan.ayah_start}–${peek.plan.ayah_end}`
      : t("liveSession.activeReciterMicOnly");

  return (
    <button
      type="button"
      onClick={onOpenDrawer}
      aria-expanded={drawerOpen}
      title={t("liveSession.activeReciterOpenDrawerHint")}
      aria-label={t("liveSession.activeReciterOpenDrawerHint")}
      className={cn(
        "pointer-events-auto flex max-w-[min(20rem,calc(100vw-5rem))] items-center gap-2 rounded-xl border-2 border-emerald-600/55 bg-emerald-50/95 px-2 py-1.5 text-start shadow-md backdrop-blur-sm transition-colors hover:bg-emerald-100/95 dark:border-emerald-500/50 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/50",
        className,
      )}
    >
      <span
        className="flex size-8 shrink-0 items-center justify-center rounded-full bg-emerald-700/15 text-xs font-semibold text-emerald-900 dark:text-emerald-100"
        aria-hidden
      >
        {initials(peek.studentName)}
      </span>
      <span className="min-w-0 flex-1">
        <span
          className="flex items-center gap-1 truncate text-sm font-semibold text-foreground"
          style={{ fontFamily: "var(--font-ui)" }}
        >
          <Users className="size-3.5 shrink-0 text-emerald-700 dark:text-emerald-400" aria-hidden />
          <span className="truncate">{peek.studentName}</span>
        </span>
        <span
          className="mt-0.5 block truncate text-xs text-muted-foreground"
          style={{ fontFamily: peek.kind === "plan" ? "var(--font-quran)" : "var(--font-ui)" }}
        >
          {subline}
        </span>
      </span>
      <ChevronRight
        className="size-4 shrink-0 text-emerald-800/70 rtl:rotate-180 dark:text-emerald-300/80"
        aria-hidden
      />
    </button>
  );
}
