// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
  return name.slice(0, 2).toUpperCase() || "?";
}

/** Compact roster row — same footprint as done/skipped plan rows. */
export function OfflineStudentRow({ studentName }: { studentName: string }) {
  const { t } = useTranslation();
  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/60 bg-muted/30 px-3 py-2.5 text-sm",
      )}
    >
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <div
          className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground"
          aria-hidden
        >
          {initials(studentName)}
        </div>
        <p className="min-w-0 truncate font-medium text-foreground">{studentName}</p>
      </div>
      <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {t("liveSession.notConnectedBadge")}
      </span>
    </div>
  );
}
