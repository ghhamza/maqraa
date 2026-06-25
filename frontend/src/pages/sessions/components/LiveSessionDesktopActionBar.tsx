// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

import { useTranslation } from "react-i18next";
import { Info, LogOut, Menu, MessageSquare, PhoneOff, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { SessionControlsCorner } from "../../../components/session/SessionControlsCorner";
import { AutoFollowBadge } from "../../../components/session/AutoFollowBadge";
import { MEET_ICON_BTN_BASE } from "../../../components/session/sessionMeetButtonStyles";
import type { LivekitConnectionStatus, MicError } from "@/hooks/useLivekitConnection";

export interface LiveSessionDesktopActionBarProps {
  isTeacher: boolean;
  isActiveReciter: boolean;
  canPublishAudio: boolean;
  livekitConnected: boolean;
  livekitStatus: LivekitConnectionStatus;
  isMicEnabled: boolean;
  micError?: MicError | null;
  annotationMode: boolean;
  autoFollow: boolean;
  page: number;
  surahLabel: string;
  juzN: number;
  onToggleMic: () => void;
  onToggleAnnotation?: () => void;
  onAutoFollowToggle: () => void;
  onOpenParticipants: () => void;
  onOpenNavigator: () => void;
  onOpenInfo: () => void;
  onOpenChat: () => void;
  onLeave: () => void;
  onEndSession: () => void;
}

export function LiveSessionDesktopActionBar(props: LiveSessionDesktopActionBarProps) {
  const { t } = useTranslation();
  const {
    isTeacher,
    isActiveReciter,
    canPublishAudio,
    livekitConnected,
    livekitStatus,
    isMicEnabled,
    micError = null,
    annotationMode,
    autoFollow,
    page,
    surahLabel,
    juzN,
    onToggleMic,
    onToggleAnnotation,
    onAutoFollowToggle,
    onOpenParticipants,
    onOpenNavigator,
    onOpenInfo,
    onOpenChat,
    onLeave,
    onEndSession,
  } = props;

  return (
    <div
      dir="ltr"
      className="hidden md:col-span-3 md:row-start-2 md:flex md:items-center md:justify-between md:gap-2 md:px-2 md:py-2"
    >
      {/* Left corner — leave + end session (teacher) */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onLeave}
          title={t("liveSession.tooltip.leave")}
          aria-label={t("liveSession.leave")}
          className={cn(
            MEET_ICON_BTN_BASE,
            "bg-gradient-to-b from-slate-100 to-slate-200/90 text-slate-700 hover:from-slate-200 hover:to-slate-300/90",
          )}
        >
          <LogOut className="h-5 w-5" strokeWidth={2.25} />
        </button>
        {isTeacher ? (
          <button
            type="button"
            onClick={onEndSession}
            title={t("liveSession.tooltip.endSession")}
            aria-label={t("liveSession.endSession")}
            className={cn(
              MEET_ICON_BTN_BASE,
              "bg-gradient-to-b from-[#EF5350] to-[#E53935] text-white hover:from-[#E53935] hover:to-[#C62828]",
            )}
          >
            <PhoneOff className="h-5 w-5" strokeWidth={2.25} />
          </button>
        ) : null}
      </div>

      {/* Center cluster */}
      <div className="flex items-center justify-center gap-2">
        <button
          type="button"
          onClick={onOpenInfo}
          title={t("liveSession.tooltip.sessionInfo")}
          aria-label={t("liveSession.sessionInfo")}
          className={cn(
            MEET_ICON_BTN_BASE,
            "bg-gradient-to-b from-sky-50 to-sky-100/90 text-sky-700 hover:from-sky-100 hover:to-sky-200/90",
          )}
        >
          <Info className="h-5 w-5" strokeWidth={2.25} />
        </button>

        <button
          type="button"
          onClick={onOpenChat}
          title={t("liveSession.tooltip.chat")}
          aria-label={t("liveSession.chat")}
          className={cn(
            MEET_ICON_BTN_BASE,
            "bg-gradient-to-b from-violet-50 to-violet-100/90 text-violet-700 hover:from-violet-100 hover:to-violet-200/90",
          )}
        >
          <MessageSquare className="h-5 w-5" strokeWidth={2.25} />
        </button>

        <button
          type="button"
          onClick={onOpenParticipants}
          title={t("liveSession.tooltip.participants")}
          aria-label={t("liveSession.participants")}
          className={cn(
            MEET_ICON_BTN_BASE,
            "bg-gradient-to-b from-emerald-50 to-emerald-100/90 text-emerald-800 hover:from-emerald-100 hover:to-emerald-200/90",
          )}
        >
          <Users className="h-5 w-5" strokeWidth={2.25} />
        </button>

        <SessionControlsCorner
          isTeacher={isTeacher}
          isActiveReciter={isActiveReciter}
          canPublishAudio={canPublishAudio}
          livekitConnected={livekitConnected}
          livekitStatus={livekitStatus}
          isMicEnabled={isMicEnabled}
          micError={micError}
          onToggleMic={onToggleMic}
          annotationMode={annotationMode}
          onToggleAnnotation={onToggleAnnotation}
        />
        {!isTeacher ? (
          <AutoFollowBadge enabled={autoFollow} onToggle={onAutoFollowToggle} inline />
        ) : null}

        <button
          type="button"
          onClick={onOpenNavigator}
          title={t("liveSession.tooltip.openMenu")}
          aria-label={t("common.openMenu")}
          className={cn(
            MEET_ICON_BTN_BASE,
            "w-auto gap-2 px-3 bg-gradient-to-b from-slate-50 to-slate-100/90 text-[#2c5f7c] hover:from-slate-100 hover:to-slate-200/90",
          )}
        >
          <Menu className="h-5 w-5" strokeWidth={2.25} />
          <span
            dir="rtl"
            className="hidden min-w-0 max-w-[14rem] truncate text-sm font-semibold lg:inline"
            style={{ fontFamily: "var(--font-ui)" }}
          >
            {surahLabel}
          </span>
          <span
            className="hidden whitespace-nowrap text-xs font-medium text-[#374151] lg:inline"
            style={{ fontFamily: "var(--font-ui)" }}
          >
            {t("mushaf.pageOf", { n: page })}
            {juzN > 0 ? (
              <>
                <span className="mx-1 text-muted-foreground/60" aria-hidden>
                  ·
                </span>
                {t("mushaf.juzN", { n: juzN })}
              </>
            ) : null}
          </span>
        </button>
      </div>

      {/* Right corner — invisible spacer to balance the leave cluster */}
      <div className="flex items-center gap-2" aria-hidden>
        <div className="h-10 w-10 opacity-0" />
        {isTeacher ? <div className="h-10 w-10 opacity-0" /> : null}
      </div>
    </div>
  );
}
