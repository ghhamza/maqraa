// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

import { Presentation } from "lucide-react";
import { useRef, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { MushafBookLayout } from "../mushaf/MushafBookLayout";
import { useStageFitSize } from "../../hooks/useStageFitSize";
import type { Riwaya } from "../../lib/quranService";

interface SessionBoardSurfaceProps {
  riwaya: Riwaya;
  className?: string;
  overlay?: ReactNode;
}

/** Blank paper board on the live canvas — freehand overlay via `overlay`. */
export function SessionBoardSurface({ riwaya, className, overlay }: SessionBoardSurfaceProps) {
  const { t } = useTranslation();
  const stageRef = useRef<HTMLDivElement>(null);
  const stageSize = useStageFitSize(stageRef);

  return (
    <div
      ref={stageRef}
      className={cn("flex h-full min-h-0 w-full flex-col items-center justify-center", className)}
    >
      <MushafBookLayout
        page={1}
        riwaya={riwaya}
        fitStage
        stageSize={stageSize}
        overlay={overlay}
      >
        <div className="pointer-events-none flex min-h-0 flex-1 flex-col items-center justify-center gap-2.5 px-4 text-center text-[var(--color-text-muted)]">
          <Presentation className="size-[34px] opacity-60" strokeWidth={1.6} aria-hidden />
          <span className="text-sm">{t("liveSession.board.emptyTitle")}</span>
          <span className="text-xs opacity-80">{t("liveSession.board.emptyHint")}</span>
        </div>
      </MushafBookLayout>
    </div>
  );
}
