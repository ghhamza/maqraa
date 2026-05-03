// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Pause, MoreVertical } from "lucide-react";
import type { RecitationPublic } from "../../../types";
import { getSurahNameWithArabic } from "../../../lib/quranService";
import { Button } from "../../ui/Button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../../ui/dropdown-menu";
import { cn } from "@/lib/utils";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
  return name.slice(0, 2).toUpperCase() || "?";
}

export function PausedPlanRow({
  plan,
  studentName,
  locale,
  isTeacher,
  onResume,
  onMarkDone,
  onSkip,
}: {
  plan: RecitationPublic;
  studentName: string;
  locale: string;
  isTeacher: boolean;
  onResume: () => void;
  onMarkDone: () => void;
  onSkip: () => void;
}) {
  const { t } = useTranslation();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200/80 bg-amber-50/50 px-3 py-2.5 text-sm dark:border-amber-900/50 dark:bg-amber-950/20",
      )}
    >
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <div
          className="relative flex size-9 shrink-0 items-center justify-center rounded-full bg-background text-xs font-semibold text-foreground ring-1 ring-border"
          aria-hidden
        >
          {initials(studentName)}
          <span className="absolute -bottom-0.5 -end-0.5 flex size-4 items-center justify-center rounded-full bg-amber-500 text-white shadow">
            <Pause className="size-2.5" aria-hidden />
          </span>
        </div>
        <div className="min-w-0">
          <p className="truncate font-medium text-foreground">{studentName}</p>
          <p className="truncate text-xs text-muted-foreground" style={{ fontFamily: "var(--font-quran)" }}>
            {getSurahNameWithArabic(plan.surah, locale)} · {plan.ayah_start}–{plan.ayah_end}
          </p>
        </div>
      </div>
      {isTeacher ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Button type="button" size="sm" variant="secondary" onClick={onResume}>
            {t("liveSession.actionResume")}
          </Button>
          <Button type="button" size="sm" onClick={onMarkDone}>
            {t("liveSession.actionMarkDone")}
          </Button>
          <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="ghost" size="icon-sm" aria-label={t("liveSession.overflowMore")}>
                <MoreVertical className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onSelect={(e) => {
                  e.preventDefault();
                  setMenuOpen(false);
                  onSkip();
                }}
              >
                {t("liveSession.actionSkip")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ) : null}
    </div>
  );
}
