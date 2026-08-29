// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react";
import type { StudentMemoryRow } from "../../data/rooms";
import { getSurahNameWithArabic } from "../../lib/quranService";
import { cn } from "@/lib/utils";

export interface StudentResumeCardProps {
  memory: StudentMemoryRow;
  locale: string;
  onDismiss: () => void;
  className?: string;
}

export function hasMemoryContent(m: StudentMemoryRow): boolean {
  return !!(m.last_stop || m.recurring_error || m.next_target);
}

/** Compact dismissible resume card when giving a student the turn. Hidden with no history. */
export function StudentResumeCard({ memory, locale, onDismiss, className }: StudentResumeCardProps) {
  const { t } = useTranslation();
  if (!hasMemoryContent(memory)) return null;

  const loc = locale.startsWith("ar") ? "ar" : locale.startsWith("fr") ? "fr" : "en";
  const parts: ReactNode[] = [];

  if (memory.last_stop) {
    parts.push(
      <span key="stop">
        {t("memory.lastStop", {
          surah: getSurahNameWithArabic(memory.last_stop.surah, loc),
          ayah: memory.last_stop.ayah_end,
        })}
      </span>,
    );
  }
  if (memory.recurring_error) {
    parts.push(
      <span key="err" className="font-medium text-[#F57F17]">
        {t("memory.recurringError", {
          category: t(`error.${memory.recurring_error}`, { defaultValue: memory.recurring_error }),
        })}
      </span>,
    );
  }
  if (memory.next_target) {
    const range =
      memory.next_target.ayah_start === memory.next_target.ayah_end
        ? String(memory.next_target.ayah_start)
        : `${memory.next_target.ayah_start}–${memory.next_target.ayah_end}`;
    parts.push(
      <span key="target" className="font-semibold" style={{ color: "#D4A843" }}>
        {t("memory.nextTarget", {
          range: `${getSurahNameWithArabic(memory.next_target.surah, loc)} ${range}`,
        })}
      </span>,
    );
  }

  return (
    <div
      className={cn(
        "rounded-xl border border-[rgba(212,168,67,0.35)] bg-white px-3.5 py-3 shadow-[0_4px_16px_rgba(0,0,0,0.08)]",
        className,
      )}
      style={{ fontFamily: "var(--font-ui)" }}
      role="status"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[var(--color-text)]">{memory.student_name}</p>
          <p className="mt-1 flex flex-col gap-0.5 text-xs text-[var(--color-text-muted)] sm:text-sm">
            {parts}
          </p>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="grid size-8 shrink-0 place-items-center rounded-lg text-[#6B7280] hover:bg-[#f1f3ee] hover:text-[#1A1A1A]"
          aria-label={t("common.close")}
        >
          <X className="size-4" strokeWidth={2} aria-hidden />
        </button>
      </div>
    </div>
  );
}
