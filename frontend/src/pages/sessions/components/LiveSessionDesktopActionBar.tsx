// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

import { useTranslation } from "react-i18next";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Hand,
  MessageSquare,
  Mic,
  MicOff,
  PhoneOff,
  Search,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { MicError } from "@/hooks/useLivekitConnection";
import { formatLocaleNumber } from "@/lib/formatLocaleNumber";
import { getAdjacentSurahStartPage, type Riwaya } from "@/lib/quranService";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const DOCK_BTN =
  "relative grid size-11 shrink-0 place-items-center rounded-xl border-0 bg-[#f4f5f1] text-[#1A1A1A] transition-colors hover:bg-[#e9ebe4] disabled:pointer-events-none disabled:opacity-45 disabled:hover:bg-[#f4f5f1]";

export interface LiveSessionDesktopActionBarProps {
  canPublishAudio: boolean;
  livekitConnected: boolean;
  isMicEnabled: boolean;
  micError?: MicError | null;
  page: number;
  totalPages: number;
  canNavigate: boolean;
  riwaya: Riwaya;
  /** Hide page controls in board mode. */
  showPager?: boolean;
  isTeacher?: boolean;
  /** Student: hand raised. */
  handRaised?: boolean;
  onToggleHand?: () => void;
  /** Teacher: count of raised hands (badge). */
  raisedHandCount?: number;
  onPageChange: (page: number) => void;
  onToggleMic: () => void;
  onOpenParticipants: () => void;
  onOpenNavigator: () => void;
  onLeave: () => void;
}

/** Desktop bottom chrome: pager pill + control dock (mockup Mushaf 2). */
export function LiveSessionDesktopActionBar(props: LiveSessionDesktopActionBarProps) {
  const { t, i18n } = useTranslation();
  const isRtl = (i18n.language || "ar").startsWith("ar");
  const {
    canPublishAudio,
    livekitConnected,
    isMicEnabled,
    micError = null,
    page,
    totalPages,
    canNavigate,
    riwaya,
    showPager = true,
    isTeacher = false,
    handRaised = false,
    onToggleHand,
    raisedHandCount = 0,
    onPageChange,
    onToggleMic,
    onOpenParticipants,
    onOpenNavigator,
    onLeave,
  } = props;

  const micBlocked = micError != null;
  const micOn = canPublishAudio && livekitConnected && isMicEnabled && !micBlocked;
  const showMic = canPublishAudio;

  const PrevIcon = isRtl ? ChevronRight : ChevronLeft;
  const NextIcon = isRtl ? ChevronLeft : ChevronRight;
  const PrevSurahIcon = isRtl ? ChevronsRight : ChevronsLeft;
  const NextSurahIcon = isRtl ? ChevronsLeft : ChevronsRight;

  const prevSurahPage = getAdjacentSurahStartPage(page, -1, riwaya);
  const nextSurahPage = getAdjacentSurahStartPage(page, 1, riwaya);
  const canPrevSurah = canNavigate && prevSurahPage !== page;
  const canNextSurah = canNavigate && nextSurahPage !== page;

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 hidden justify-center gap-4 p-3.5 md:flex">
      {showPager ? (
        <div className="pointer-events-auto flex items-center gap-1 rounded-2xl border border-[rgba(15,23,42,0.10)] bg-white p-2 shadow-[0_8px_30px_rgba(0,0,0,0.10)]">
          <DockTip label={t("mushaf.prevSurah")}>
            <button
              type="button"
              className={cn(DOCK_BTN, "size-10 rounded-[10px]")}
              disabled={!canPrevSurah}
              aria-label={t("mushaf.prevSurah")}
              onClick={() => onPageChange(prevSurahPage)}
            >
              <PrevSurahIcon className="size-[19px]" strokeWidth={2} aria-hidden />
            </button>
          </DockTip>
          <DockTip label={t("mushaf.prevPage")}>
            <button
              type="button"
              className={cn(DOCK_BTN, "size-10 rounded-[10px]")}
              disabled={!canNavigate || page <= 1}
              aria-label={t("mushaf.prevPage")}
              onClick={() => onPageChange(Math.max(1, page - 1))}
            >
              <PrevIcon className="size-[19px]" strokeWidth={2} aria-hidden />
            </button>
          </DockTip>
          <span className="flex items-center gap-1.5 px-2.5 text-[13px] text-[#6B7280]">
            {t("mushaf.page")}{" "}
            <b className="font-semibold tabular-nums text-[#1A1A1A]">
              {formatLocaleNumber(page, i18n.language)}
            </b>
            <span aria-hidden>/</span>
            <span className="tabular-nums">{formatLocaleNumber(totalPages, i18n.language)}</span>
          </span>
          <DockTip label={t("mushaf.nextPage")}>
            <button
              type="button"
              className={cn(DOCK_BTN, "size-10 rounded-[10px]")}
              disabled={!canNavigate || page >= totalPages}
              aria-label={t("mushaf.nextPage")}
              onClick={() => onPageChange(Math.min(totalPages, page + 1))}
            >
              <NextIcon className="size-[19px]" strokeWidth={2} aria-hidden />
            </button>
          </DockTip>
          <DockTip label={t("mushaf.nextSurah")}>
            <button
              type="button"
              className={cn(DOCK_BTN, "size-10 rounded-[10px]")}
              disabled={!canNextSurah}
              aria-label={t("mushaf.nextSurah")}
              onClick={() => onPageChange(nextSurahPage)}
            >
              <NextSurahIcon className="size-[19px]" strokeWidth={2} aria-hidden />
            </button>
          </DockTip>
          <div className="mx-0.5 h-6 w-px bg-[rgba(15,23,42,0.10)]" aria-hidden />
          <DockTip label={t("liveSession.tooltip.openMenu")}>
            <button
              type="button"
              className={cn(DOCK_BTN, "size-10 rounded-[10px]")}
              aria-label={t("common.openMenu")}
              onClick={onOpenNavigator}
            >
              <Search className="size-[19px]" strokeWidth={2} aria-hidden />
            </button>
          </DockTip>
        </div>
      ) : null}

      <div className="pointer-events-auto flex items-center gap-1.5 rounded-2xl border border-[rgba(15,23,42,0.10)] bg-white p-2 shadow-[0_8px_30px_rgba(0,0,0,0.10)]">
        {showMic ? (
          <DockTip
            label={micOn ? t("liveSession.tooltip.mute") : t("liveSession.tooltip.unmute")}
          >
            <button
              type="button"
              className={cn(DOCK_BTN, micOn && "bg-[#1B5E20] text-white hover:bg-[#174f1b]")}
              disabled={!livekitConnected || micBlocked}
              aria-label={micOn ? t("liveSession.muteMic") : t("liveSession.unmuteMic")}
              aria-pressed={micOn}
              onClick={onToggleMic}
            >
              {micOn ? (
                <Mic className="size-[19px]" strokeWidth={2} aria-hidden />
              ) : (
                <MicOff className="size-[19px]" strokeWidth={2} aria-hidden />
              )}
            </button>
          </DockTip>
        ) : null}

        <DockTip label={t("liveSession.chatComingSoon")}>
          <button
            type="button"
            className={cn(DOCK_BTN, "text-[#9CA3AF]")}
            disabled
            aria-label={t("liveSession.chatComingSoon")}
          >
            <MessageSquare className="size-[19px]" strokeWidth={2} aria-hidden />
          </button>
        </DockTip>

        {!isTeacher && onToggleHand ? (
          <DockTip
            label={handRaised ? t("liveSession.hand.lower") : t("liveSession.hand.raise")}
          >
            <button
              type="button"
              className={cn(
                DOCK_BTN,
                handRaised &&
                  "bg-[rgba(212,168,67,0.16)] text-[#9a7616] hover:bg-[rgba(212,168,67,0.28)]",
              )}
              aria-label={handRaised ? t("liveSession.hand.lower") : t("liveSession.hand.raise")}
              aria-pressed={handRaised}
              onClick={onToggleHand}
            >
              <Hand className="size-[19px]" strokeWidth={2} aria-hidden />
            </button>
          </DockTip>
        ) : null}

        <DockTip label={t("liveSession.tooltip.participants")}>
          <button
            type="button"
            className={DOCK_BTN}
            aria-label={t("liveSession.participants")}
            onClick={onOpenParticipants}
          >
            <Users className="size-[19px]" strokeWidth={2} aria-hidden />
            {isTeacher && raisedHandCount > 0 ? (
              <span
                className="absolute -end-1 -top-1 grid min-w-[18px] place-items-center rounded-full bg-[#D4A843] px-1 text-[10px] font-bold leading-none text-[#3a2c00]"
                aria-label={t("liveSession.hand.raisedGroup")}
              >
                {raisedHandCount > 99 ? "99+" : raisedHandCount}
              </span>
            ) : null}
          </button>
        </DockTip>

        <div className="mx-1 h-[26px] w-px bg-[rgba(15,23,42,0.10)]" aria-hidden />

        <DockTip label={t("liveSession.tooltip.leave")}>
          <button
            type="button"
            className={cn(DOCK_BTN, "bg-[#EF5350] text-white hover:bg-[#e53935]")}
            aria-label={t("liveSession.leave")}
            onClick={onLeave}
          >
            <PhoneOff className="size-[19px]" strokeWidth={2} aria-hidden />
          </button>
        </DockTip>
      </div>
    </div>
  );
}

function DockTip({
  label,
  children,
}: {
  label: string;
  children: React.ReactElement<{ disabled?: boolean }>;
}) {
  const disabled = Boolean(children.props.disabled);
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {disabled ? <span className="inline-flex">{children}</span> : children}
      </TooltipTrigger>
      <TooltipContent side="top" sideOffset={8}>
        {label}
      </TooltipContent>
    </Tooltip>
  );
}
