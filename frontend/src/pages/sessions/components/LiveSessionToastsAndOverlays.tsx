// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

import { useTranslation } from "react-i18next";
import { Volume2 } from "lucide-react";
import { GradeToast } from "../../../components/session/GradeToast";

export interface LiveSessionToastsAndOverlaysProps {
  announce: string;
  audioPlaybackBlocked: boolean;
  onEnableAudio: () => void;
  browserSupported: boolean;
  reconnectedToast: boolean;
  gradeToast: { grade: string; notes?: string } | null;
  onDismissGradeToast: () => void;
}

export function LiveSessionToastsAndOverlays({
  announce,
  audioPlaybackBlocked,
  onEnableAudio,
  browserSupported,
  reconnectedToast,
  gradeToast,
  onDismissGradeToast,
}: LiveSessionToastsAndOverlaysProps) {
  const { t } = useTranslation();
  return (
    <>
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {announce}
      </div>
      {audioPlaybackBlocked && (
        <button
          type="button"
          onClick={onEnableAudio}
          className="fixed inset-x-0 top-[max(0.5rem,env(safe-area-inset-top))] z-[70] flex items-center justify-center gap-2 bg-[#D4A843] px-4 py-2 text-sm text-white"
        >
          <Volume2 className="h-4 w-4" />
          {t("liveSession.tapToEnableAudio")}
        </button>
      )}
      {!browserSupported ? (
        <div
          className="fixed top-[max(0.5rem,env(safe-area-inset-top))] left-0 right-0 z-[60] border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-sm text-amber-900"
          role="alert"
        >
          {t("liveSession.browserNotSupported")}
        </div>
      ) : null}
      {reconnectedToast ? (
        <div
          className="fixed top-[max(3rem,env(safe-area-inset-top))] left-1/2 z-[60] -translate-x-1/2 rounded-full border border-green-200 bg-green-50 px-4 py-2 text-sm text-green-900 shadow-md"
          role="status"
        >
          {t("liveSession.reconnected")}
        </div>
      ) : null}
      {gradeToast ? (
        <GradeToast grade={gradeToast.grade} notes={gradeToast.notes} onDismiss={onDismissGradeToast} />
      ) : null}
    </>
  );
}
