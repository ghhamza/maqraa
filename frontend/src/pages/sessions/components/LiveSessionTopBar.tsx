// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

import { BookOpen, Clock, Users } from "lucide-react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ConnectionStatus } from "../../../components/session/ConnectionStatus";
import type { SessionWsStatus } from "../../../hooks/useSessionWebSocket";
import type { LivekitConnectionStatus } from "../../../hooks/useLivekitConnection";
import type { HalaqahType, QuranRiwaya } from "../../../types";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const HALAQAH_I18N: Record<HalaqahType, string> = {
  hifz: "rooms.halaqahHifz",
  tilawa: "rooms.halaqahTilawa",
  muraja: "rooms.halaqahMuraja",
  tajweed: "rooms.halaqahTajweed",
};

export interface LiveSessionTopBarProps {
  roomId: string;
  roomName: string;
  roomCode?: string | null;
  riwaya: QuranRiwaya;
  halaqahType: HalaqahType;
  elapsedLabel: string;
  participantCount: number;
  wsStatus: SessionWsStatus;
  livekitStatus: LivekitConnectionStatus;
  isTeacher: boolean;
  onEndSession: () => void;
  /** Current user display name (avatar initial). */
  userName?: string | null;
}

/** Desktop live-session top chrome (mockup Mushaf 2). */
export function LiveSessionTopBar({
  roomId,
  roomName,
  roomCode,
  riwaya,
  halaqahType,
  elapsedLabel,
  participantCount,
  wsStatus,
  livekitStatus,
  isTeacher,
  onEndSession,
  userName,
}: LiveSessionTopBarProps) {
  const { t } = useTranslation();
  const initial = (userName?.trim()?.charAt(0) || "?").toLocaleUpperCase();

  return (
    <header className="hidden shrink-0 flex-wrap items-center gap-3.5 border-b border-[rgba(15,23,42,0.10)] bg-white px-4 py-2.5 md:flex">
      <span
        className="text-[26px] font-bold leading-none text-[#1B5E20]"
        style={{ fontFamily: "var(--font-quran)" }}
      >
        {t("common.appName")}
      </span>

      <div className="flex min-w-0 flex-col gap-0.5">
        <div className="truncate text-sm font-semibold text-[#1A1A1A]">{roomName}</div>
        <div className="flex items-center gap-1.5 text-xs text-[#6B7280]">
          <span
            className="size-2 shrink-0 rounded-full bg-[#4CAF50] shadow-[0_0_0_3px_rgba(76,175,80,0.18)]"
            aria-hidden
          />
          <span>{t("nav.liveBadge")}</span>
          {roomCode ? (
            <>
              <span aria-hidden>·</span>
              <span className="tracking-wide tabular-nums">{roomCode}</span>
            </>
          ) : null}
        </div>
      </div>

      <Link
        to={`/rooms/${roomId}`}
        className="inline-flex h-9 max-w-[12rem] items-center truncate rounded-[10px] border border-[rgba(15,23,42,0.10)] bg-[var(--color-primary)]/8 px-3 text-[13px] font-medium text-[var(--color-primary)] hover:underline"
      >
        {t("session.halaqahChip", { name: roomName })}
      </Link>

      <span className="flex-1" />

      <span
        className="inline-flex h-9 items-center gap-2 rounded-[10px] border border-[rgba(15,23,42,0.10)] bg-white px-3 text-[13px] font-semibold text-[#1A1A1A]"
        title={t("mushaf.riwaya")}
      >
        <span className="text-xs font-medium text-[#6B7280]">{t("mushaf.riwaya")}</span>
        {t(`mushaf.${riwaya}`, { defaultValue: riwaya })}
      </span>

      <span className="inline-flex h-9 items-center gap-1.5 rounded-[10px] border border-[rgba(15,23,42,0.10)] bg-white px-3 text-[13px] font-medium text-[#6B7280]">
        <BookOpen className="size-[15px]" aria-hidden />
        {t(HALAQAH_I18N[halaqahType] ?? "rooms.halaqahTilawa")}
      </span>

      <span className="inline-flex h-7 items-center gap-1.5 rounded-lg bg-[#EF5350] px-2.5 text-[11px] font-bold tracking-wide text-white">
        <span className="size-1.5 rounded-full bg-white" aria-hidden />
        {t("nav.liveBadge")}
      </span>

      <span className="inline-flex h-9 items-center gap-1.5 rounded-[10px] border border-[rgba(15,23,42,0.10)] bg-white px-3 text-[13px] font-medium text-[#6B7280]">
        <Clock className="size-[15px]" aria-hidden />
        <span className="tabular-nums text-[#1A1A1A]">{elapsedLabel}</span>
      </span>

      <span className="inline-flex h-9 items-center gap-1.5 rounded-[10px] border border-[rgba(15,23,42,0.10)] bg-white px-3 text-[13px] font-medium text-[#6B7280]">
        <Users className="size-[15px]" aria-hidden />
        <span className="tabular-nums text-[#1A1A1A]">{participantCount}</span>
      </span>

      <ConnectionStatus status={wsStatus} livekitStatus={livekitStatus} ghostPill />

      {isTeacher ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={onEndSession}
              aria-label={t("liveSession.tooltip.endSession")}
              className="h-9 rounded-[10px] bg-[#EF5350] px-3.5 text-[13px] font-semibold text-white hover:bg-[#e53935]"
            >
              {t("liveSession.endSession")}
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom" sideOffset={6} className="max-w-xs text-center">
            {t("liveSession.tooltip.endSession")}
          </TooltipContent>
        </Tooltip>
      ) : null}

      {userName ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <span
              className="grid size-[34px] shrink-0 place-items-center rounded-full bg-[#D4A843] text-xs font-bold text-[#3a2c00]"
              aria-label={userName}
            >
              {initial}
            </span>
          </TooltipTrigger>
          <TooltipContent side="bottom" sideOffset={6}>
            {userName}
          </TooltipContent>
        </Tooltip>
      ) : (
        <span
          className="grid size-[34px] shrink-0 place-items-center rounded-full bg-[#D4A843] text-xs font-bold text-[#3a2c00]"
          aria-hidden
        >
          {initial}
        </span>
      )}
    </header>
  );
}
