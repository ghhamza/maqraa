// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

import { Mic, MicOff } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { SessionParticipant } from "../../../hooks/useSessionState";
import { Button } from "../../ui/Button";
import { cn } from "@/lib/utils";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
  return name.slice(0, 2).toUpperCase() || "?";
}

export function NotInPlanRow({
  participant,
  isTeacher,
  onGiveMic,
}: {
  participant: SessionParticipant;
  isTeacher: boolean;
  onGiveMic: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/60 bg-background px-3 py-2.5 text-sm",
      )}
    >
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <div
          className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground"
          aria-hidden
        >
          {initials(participant.name)}
        </div>
        <div className="min-w-0">
          <p className="truncate font-medium text-foreground">{participant.name}</p>
          <div className="mt-0.5 flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-emerald-600/12 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-emerald-900 dark:text-emerald-200">
              {t("liveSession.connectedBadge")}
            </span>
            {participant.isMuted ? (
              <MicOff className="size-3.5 shrink-0 text-[#EF5350]" aria-label={t("liveSession.mute")} />
            ) : (
              <Mic className="size-3.5 shrink-0 text-[#4CAF50]" aria-label={t("liveSession.unmute")} />
            )}
          </div>
        </div>
      </div>
      {isTeacher ? (
        <Button type="button" size="sm" variant="default" className="shrink-0" onClick={onGiveMic}>
          {t("liveSession.actionGiveMic")}
        </Button>
      ) : null}
    </div>
  );
}
