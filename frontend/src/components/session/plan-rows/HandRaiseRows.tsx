// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

import { Hand, Mic, MicOff } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { SessionParticipant } from "../../../hooks/useSessionState";
import { Button } from "../../ui/Button";
import { cn } from "@/lib/utils";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
  return name.slice(0, 2).toUpperCase() || "?";
}

export function RaisedHandRow({
  participant,
  isTeacher,
  onPassTurn,
}: {
  participant: SessionParticipant;
  isTeacher: boolean;
  onPassTurn: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[rgba(212,168,67,0.35)] bg-[rgba(212,168,67,0.08)] px-3 py-2.5 text-sm">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <div
          className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#D4A843] text-xs font-semibold text-[#3a2c00]"
          aria-hidden
        >
          {initials(participant.name)}
        </div>
        <div className="min-w-0">
          <p className="truncate font-medium text-foreground">{participant.name}</p>
          <span className="mt-0.5 inline-flex items-center gap-1 rounded-md bg-[rgba(212,168,67,0.16)] px-1.5 py-0.5 text-[10px] font-medium text-[#9a7616]">
            <Hand className="size-3" aria-hidden />
            {t("liveSession.hand.raise")}
          </span>
        </div>
      </div>
      {isTeacher ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="shrink-0 border-[rgba(212,168,67,0.45)] text-[#9a7616] hover:bg-[rgba(212,168,67,0.16)]"
          onClick={onPassTurn}
        >
          {t("liveSession.hand.passTurn")}
        </Button>
      ) : null}
    </div>
  );
}

export function HalaqahParticipantRow({
  participant,
  isTeacher,
  isSelf,
  isReciting,
  onGiveTurn,
}: {
  participant: SessionParticipant;
  isTeacher: boolean;
  isSelf?: boolean;
  isReciting?: boolean;
  onGiveTurn?: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div
      className={cn(
        "group flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/60 bg-background px-3 py-2.5 text-sm",
      )}
    >
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <div
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
            isReciting ? "bg-[#1B5E20] text-white" : "bg-muted text-muted-foreground",
          )}
          aria-hidden
        >
          {initials(participant.name)}
        </div>
        <div className="min-w-0">
          <p className="truncate font-medium text-foreground">
            {participant.name}
            {isSelf ? " · ★" : null}
          </p>
          <div className="mt-0.5 flex items-center gap-2">
            {isReciting ? (
              <span className="rounded-md bg-[rgba(27,94,32,0.12)] px-1.5 py-0.5 text-[10px] font-medium text-[#1B5E20]">
                {t("liveSession.turn.recitingNow")}
              </span>
            ) : null}
            {participant.isMuted ? (
              <MicOff className="size-3.5 shrink-0 text-[#EF5350]" aria-label={t("liveSession.mute")} />
            ) : (
              <Mic className="size-3.5 shrink-0 text-[#4CAF50]" aria-label={t("liveSession.unmute")} />
            )}
          </div>
        </div>
      </div>
      {isTeacher && onGiveTurn && !isReciting && participant.role === "student" ? (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="shrink-0 opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
          onClick={onGiveTurn}
        >
          {t("liveSession.turn.giveTurn")}
        </Button>
      ) : null}
    </div>
  );
}
