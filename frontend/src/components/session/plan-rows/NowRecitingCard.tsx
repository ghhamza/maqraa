// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

import { useTranslation } from "react-i18next";
import type { RecitationPublic } from "../../../types";
import { getSurahNameWithArabic } from "../../../lib/quranService";
import { Button } from "../../ui/Button";
import { cn } from "@/lib/utils";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
  return name.slice(0, 2).toUpperCase() || "?";
}

const TURN_TAB: Record<string, string> = {
  dars: "sessions.tab_dars",
  tathbit: "sessions.tab_tathbit",
  muraja: "sessions.tab_muraja",
};

export function NowRecitingCard({
  plan,
  studentName,
  locale,
  isTeacher,
  onPause,
  onSkip,
  onEndGrade,
}: {
  plan: RecitationPublic;
  studentName: string;
  locale: string;
  isTeacher: boolean;
  onPause: () => void;
  onSkip: () => void;
  onEndGrade: () => void;
}) {
  const { t } = useTranslation();
  const turnKey = TURN_TAB[plan.turn_type] ?? "sessions.tab_dars";

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl border-2 border-emerald-600/70 bg-emerald-50/40 p-4 dark:border-emerald-500/60 dark:bg-emerald-950/25",
      )}
    >
      <div className="absolute end-3 top-3">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-700 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white shadow-sm">
          <span className="relative flex size-2">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-white/60 opacity-75" />
            <span className="relative inline-flex size-2 rounded-full bg-white" />
          </span>
          {t("liveSession.nowPill")}
        </span>
      </div>
      <div className="flex items-start gap-3 pe-20">
        <div
          className="flex size-12 shrink-0 items-center justify-center rounded-full bg-emerald-700/15 text-base font-semibold text-emerald-900 dark:text-emerald-100"
          aria-hidden
        >
          {initials(studentName)}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-lg font-semibold leading-tight text-foreground">{studentName}</p>
          <p className="mt-1 text-sm text-muted-foreground" style={{ fontFamily: "var(--font-quran)" }}>
            {getSurahNameWithArabic(plan.surah, locale)} · {plan.ayah_start}–{plan.ayah_end}
          </p>
          <span className="mt-2 inline-block rounded-md bg-background/80 px-2 py-0.5 text-xs font-medium text-foreground ring-1 ring-border">
            {t(turnKey)}
          </span>
        </div>
      </div>
      {isTeacher ? (
        <div className="mt-4 flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="secondary" onClick={onPause}>
            {t("liveSession.actionPause")}
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={onSkip}>
            {t("liveSession.actionSkip")}
          </Button>
          <Button type="button" size="sm" onClick={onEndGrade}>
            {t("liveSession.actionEndGrade")}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
