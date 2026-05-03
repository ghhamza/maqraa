// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

import { Crown, Mic, MicOff } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { SessionParticipant } from "../../../hooks/useSessionState";
import { cn } from "@/lib/utils";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
  return name.slice(0, 2).toUpperCase() || "?";
}

export function TeacherRow({ participant }: { participant: SessionParticipant }) {
  const { t } = useTranslation();
  return (
    <div
      className={cn(
        "flex w-full items-center gap-3 rounded-lg border border-border/60 bg-background px-3 py-3 text-start text-sm",
      )}
    >
      <div
        className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary"
        aria-hidden
      >
        {initials(participant.name)}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <Crown className="size-4 shrink-0 text-[#1B5E20]" aria-hidden />
          <span className="truncate font-medium">{participant.name}</span>
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span className="rounded bg-[#1B5E20]/10 px-1.5 py-0.5 text-[#1B5E20]">{t("liveSession.teacherBadge")}</span>
          {participant.isMuted ? (
            <MicOff className="size-4 shrink-0 text-[#EF5350]" aria-label={t("liveSession.mute")} />
          ) : (
            <Mic className="size-4 shrink-0 text-[#4CAF50]" aria-label={t("liveSession.unmute")} />
          )}
        </div>
      </div>
    </div>
  );
}
