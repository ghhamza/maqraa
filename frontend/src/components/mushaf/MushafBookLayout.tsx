// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { Riwaya } from "../../lib/quranService";

/**
 * Max width of the reading column for standalone `/mushaf`.
 * Live session uses `fitStage` and is not capped by this.
 */
export const MUSHAF_PAGE_MAX_WIDTH = "48rem" as const;

export const mushafPageCardWidthStyle: CSSProperties = {
  width: "100%",
  maxWidth: MUSHAF_PAGE_MAX_WIDTH,
  boxSizing: "border-box",
};

/** Horizontal inset where verse text sits inside the card (must match inner wrapper below). */
export const MUSHAF_PAGE_INNER_PADDING_X = "px-4 sm:px-6 md:px-7";

const PAPER_CARD =
  "rounded-lg bg-[var(--mushaf-page-paper)] shadow-[0_1px_3px_rgba(0,0,0,0.06),0_8px_24px_rgba(0,0,0,0.05)]";

export interface MushafBookLayoutProps {
  page: number;
  riwaya: Riwaya;
  children: ReactNode;
  /** Absolutely positioned over the page card (e.g. whiteboard SVG). */
  overlay?: ReactNode;
  /**
   * Live session: size from parent stage (height-first), no 48rem cap.
   * Standalone `/mushaf` leaves this false (content-driven height + max-width).
   */
  fitStage?: boolean;
  /** Explicit pixel size when `fitStage` (from stage ResizeObserver). */
  stageSize?: { width: number; height: number } | null;
  /** Quiet Juz / Surah row inside the card (live session). */
  pageHeader?: ReactNode;
}

/**
 * Plain paper page card. Live session fills the stage height; two-constraint
 * font in {@link QCFPageRenderer} keeps the full page visible.
 */
export function MushafBookLayout({
  children,
  overlay,
  fitStage = false,
  stageSize = null,
  pageHeader,
}: MushafBookLayoutProps) {
  const fitted = fitStage && stageSize != null && stageSize.width > 0 && stageSize.height > 0;

  return (
    <div
      data-mushaf-card=""
      data-mushaf-fit={fitted ? "1" : undefined}
      className={cn(
        "relative mx-auto flex w-full flex-col",
        PAPER_CARD,
        fitted
          ? "min-h-0 overflow-hidden"
          : "min-h-[min(70vh,820px)]",
      )}
      style={
        fitted
          ? {
              width: stageSize.width,
              height: stageSize.height,
              maxWidth: "none",
              boxSizing: "border-box",
            }
          : { ...mushafPageCardWidthStyle }
      }
    >
      <div
        className={cn(
          "relative z-[1] flex w-full flex-1 flex-col",
          MUSHAF_PAGE_INNER_PADDING_X,
          // Extra top inset when Juz/Surah meta is present so labels clear the
          // rounded card edge (overflow-hidden otherwise clips leading glyphs).
          pageHeader ? "pb-2 pt-3.5 sm:pb-3 sm:pt-4" : "py-2 sm:py-3",
          // Safety: if content still overflows (unexpected data), scroll inside the card.
          fitted ? "min-h-0 overflow-y-auto" : null,
        )}
      >
        {pageHeader ? (
          <div className="mb-1.5 shrink-0" data-mushaf-page-meta="">
            {pageHeader}
          </div>
        ) : null}
        <div
          className={cn(
            "flex w-full flex-1 flex-col",
            fitted && "min-h-0",
          )}
        >
          {children}
        </div>
      </div>
      {overlay}
    </div>
  );
}
