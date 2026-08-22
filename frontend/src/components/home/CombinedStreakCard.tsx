// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

import { Flame } from "lucide-react";
import { useTranslation } from "react-i18next";

export interface CombinedStreakCardProps {
  maqraaStreakDays: number;
}

export function CombinedStreakCard({ maqraaStreakDays }: CombinedStreakCardProps) {
  const { t } = useTranslation();
  return (
    <div className="rounded-2xl border border-gray-100 bg-[var(--color-surface)] p-5 shadow-sm">
      <p className="text-sm text-[var(--color-text-muted)]">{t("home.streakTitle")}</p>
      <div className="mt-3">
        <p className="text-xs font-medium text-[var(--color-text-muted)]">{t("home.maqraaStreak")}</p>
        <div className="mt-1 flex items-center gap-2">
          <Flame className="h-8 w-8 shrink-0 text-orange-500" aria-hidden />
          {maqraaStreakDays > 0 ? (
            <p className="text-2xl font-bold" style={{ color: "var(--color-gold)" }}>
              {t("home.dayStreak", { days: maqraaStreakDays })}
            </p>
          ) : (
            <p className="text-sm font-medium text-[var(--color-text)]">{t("home.startStreak")}</p>
          )}
        </div>
      </div>
    </div>
  );
}
