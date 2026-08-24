// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { MushafBookLayout, MUSHAF_PAGE_INNER_PADDING_X, mushafPageCardWidthStyle } from "./MushafBookLayout";
import { MushafNavigation } from "./MushafNavigation";
import { MushafPageTurnButtons } from "./MushafPageTurnButtons";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useStageFitSize } from "../../hooks/useStageFitSize";
import {
  getJuzForAyah,
  getPageForSurahStart,
  getSurahAyahAtPageStart,
  getSurahName,
  getSurahRangeOnPage,
  getTotalPages,
} from "../../lib/quranService";
import { formatLocaleNumber } from "../../lib/formatLocaleNumber";
import type { Riwaya } from "../../lib/quranService";

export interface MushafReaderProps {
  page: number;
  onPageChange: (p: number) => void;
  riwaya: Riwaya;
  /** When false, navigation, turn buttons, and arrow keys do not change the page. */
  canChangePage?: boolean;
  /** Live session immersive: hide surah/juz/page dropdowns; page chevrons stay. */
  hideNavigation?: boolean;
  /** e.g. live session: `h-full min-h-0` so the reader fills the viewport. */
  className?: string;
  /** e.g. live session: mic / participants row, centered under the mushaf page (not viewport-fixed). */
  bottomAccessory?: ReactNode;
  /** Strip above the mushaf page (e.g. surah/juz shortcuts). Omit to show the default placeholder. */
  menuNavigationZone?: ReactNode;
  /** Live session: menu strip is placed in page layout (top-middle); omit the internal nav block. */
  omitMenuStrip?: boolean;
  /**
   * Rendered inside the padded mushaf column, above page turn controls — aligns with the book column
   * (e.g. live session desktop: menu + surah row).
   */
  immersiveHeader?: ReactNode;
  /** Live session: fit page card to stage height/width (no 48rem cap). */
  fitStage?: boolean;
  /** Overlay on the page card (whiteboard). */
  pageOverlay?: ReactNode;
  children: ReactNode;
}

/**
 * Shared Mushaf shell: surah / juz / page navigation, book column, edge turn controls.
 * Used by {@link MushafPage} and live sessions so the reader is one component, not duplicated markup.
 */
export function MushafReader({
  page,
  onPageChange,
  riwaya,
  canChangePage = true,
  hideNavigation = false,
  className,
  bottomAccessory,
  menuNavigationZone,
  omitMenuStrip = false,
  immersiveHeader,
  fitStage = false,
  pageOverlay,
  children,
}: MushafReaderProps) {
  const { t, i18n } = useTranslation();
  const [jumpOpen, setJumpOpen] = useState(false);
  /** Last surah chosen via “go to surah”; shown in the select when that surah starts on `page`. */
  const [surahIntent, setSurahIntent] = useState<number | null>(null);
  const totalPages = getTotalPages(riwaya);
  const navDisabled = !canChangePage;
  const stageRef = useRef<HTMLDivElement>(null);
  const stageSize = useStageFitSize(stageRef, { gutterX: fitStage ? 24 : 0 });
  const loc = (i18n.language || "ar").startsWith("ar")
    ? "ar"
    : (i18n.language || "").startsWith("fr")
      ? "fr"
      : "en";

  const pageHeader = fitStage ? (
    <MushafPageMetaHeader page={page} riwaya={riwaya} locale={loc} />
  ) : null;

  useEffect(() => {
    if (surahIntent == null) return;
    const p = getPageForSurahStart(surahIntent, riwaya);
    if (p !== page) setSurahIntent(null);
  }, [page, riwaya, surahIntent]);

  useEffect(() => {
    if (!canChangePage) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        onPageChange(Math.min(totalPages, page + 1));
      }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        onPageChange(Math.max(1, page - 1));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [canChangePage, onPageChange, page, totalPages]);

  return (
    <div className={cn("relative flex min-h-0 w-full flex-1 flex-col gap-2", className)}>
      {!hideNavigation ? (
        <Sheet open={jumpOpen} onOpenChange={setJumpOpen}>
          <SheetContent
            side="bottom"
            className="max-h-[min(85dvh,32rem)] overflow-y-auto pb-[max(1rem,env(safe-area-inset-bottom))]"
          >
            <SheetHeader className="text-start">
              <SheetTitle>{t("mushaf.jumpTitle")}</SheetTitle>
            </SheetHeader>
            <div className="px-1 pb-2">
              <MushafNavigation
                page={page}
                totalPages={totalPages}
                riwaya={riwaya}
                onPageChange={onPageChange}
                disabled={navDisabled}
                surahIntent={surahIntent}
                onSurahIntent={setSurahIntent}
                onAfterNavigate={() => setJumpOpen(false)}
              />
            </div>
          </SheetContent>
        </Sheet>
      ) : null}

      <header className="w-full shrink-0">
        {!hideNavigation ? (
          <div className="hidden w-full border-b border-gray-100 pb-2 md:block">
            <div className="mx-auto w-full min-w-0 max-w-4xl px-3 sm:px-4 md:px-5 lg:px-6">
              <MushafNavigation
                page={page}
                totalPages={totalPages}
                riwaya={riwaya}
                onPageChange={onPageChange}
                disabled={navDisabled}
                surahIntent={surahIntent}
                onSurahIntent={setSurahIntent}
              />
            </div>
          </div>
        ) : null}
        <div className="mx-auto w-full min-w-0 max-w-4xl px-3 sm:px-4 md:px-5 lg:px-6">
          {!omitMenuStrip ? (
            <nav
              className="flex w-full max-w-full shrink-0 flex-col items-stretch gap-2 py-2"
              aria-label={t("mushaf.menuNavigationZone")}
              data-testid="quran-menu-navigation-zone"
            >
              {menuNavigationZone !== undefined ? (
                menuNavigationZone
              ) : (
                <p className="text-center text-xs text-muted-foreground sm:text-sm">
                  {t("mushaf.menuNavigationZone")}
                </p>
              )}
            </nav>
          ) : null}
          {immersiveHeader ? (
            <div className="mx-auto w-full" style={mushafPageCardWidthStyle}>
              <div className={cn(MUSHAF_PAGE_INNER_PADDING_X, "pb-1 pt-0")}>{immersiveHeader}</div>
            </div>
          ) : null}
        </div>
      </header>

      <main
        ref={fitStage ? stageRef : undefined}
        className={cn(
          "mx-auto flex min-h-0 w-full min-w-0 flex-1 flex-col",
          fitStage
            ? "max-w-none items-center justify-center overflow-hidden px-2"
            : "max-w-4xl overflow-y-auto px-3 sm:px-4 md:px-5 lg:px-6",
        )}
        aria-label="Mushaf content"
      >
        <div
          className={cn(
            "relative flex min-h-0 w-full flex-1 flex-col items-center",
            fitStage ? "justify-center" : "justify-center",
          )}
        >
          {!hideNavigation ? (
            <MushafPageTurnButtons
              page={page}
              totalPages={totalPages}
              onPageChange={onPageChange}
              disabled={navDisabled}
              onOpenJump={() => setJumpOpen(true)}
              showDesktopJump
            />
          ) : null}
          <section
            className={cn(
              "flex min-h-0 w-full flex-1 flex-col items-center",
              fitStage ? "justify-center" : "justify-center",
            )}
          >
            <MushafBookLayout
              page={page}
              riwaya={riwaya}
              fitStage={fitStage}
              stageSize={fitStage ? stageSize : null}
              pageHeader={pageHeader}
              overlay={pageOverlay}
            >
              {children}
            </MushafBookLayout>
          </section>
        </div>
      </main>

      <footer className="mx-auto w-full min-w-0 max-w-4xl shrink-0 px-3 sm:px-4 md:px-5 lg:px-6">
        <section className="flex w-full max-w-full shrink-0 flex-col items-center justify-center gap-2 px-2">
          {bottomAccessory}
        </section>
      </footer>
    </div>
  );
}

function MushafPageMetaHeader({
  page,
  riwaya,
  locale,
}: {
  page: number;
  riwaya: Riwaya;
  locale: "ar" | "en" | "fr";
}) {
  const { t, i18n } = useTranslation();
  const { startSurah, endSurah } = getSurahRangeOnPage(page, riwaya);
  const [s, a] = getSurahAyahAtPageStart(page, riwaya);
  const juzN = getJuzForAyah(s, a, riwaya);
  const surahLabel =
    startSurah === endSurah
      ? getSurahName(startSurah, locale)
      : `${getSurahName(startSurah, locale)} – ${getSurahName(endSurah, locale)}`;
  const juzLabel = t("mushaf.juzOf", {
    n: formatLocaleNumber(juzN, i18n.language),
  });

  return (
    <div className="flex w-full items-center justify-between gap-3 text-[12px] leading-snug text-[var(--color-text-muted)] sm:text-[13px]">
      <span className="min-w-0 truncate tabular-nums">{juzLabel}</span>
      <span
        className="min-w-0 truncate text-end"
        style={{ fontFamily: "var(--font-mushaf-title)" }}
      >
        {surahLabel}
      </span>
    </div>
  );
}
