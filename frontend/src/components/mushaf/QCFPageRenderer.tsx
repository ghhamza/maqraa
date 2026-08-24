// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
} from "react";
import { useCancellableEffect } from "../../hooks/useCancellableEffect";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { useQuranPage } from "../../hooks/useQuranPage";
import { getPageFontFamily, loadPageFont, preloadAdjacentPages } from "../../lib/mushafFontLoader";
import { getSurahName, isMushafOpeningCenterPage } from "../../lib/quranService";
import type { Riwaya } from "../../lib/quranService";
import type { LineData, WordData } from "../../hooks/useQuranPage";
import { Button } from "../ui/Button";
import { MushafBasmalahSvg } from "./MushafBasmalahSvg";
import { SurahNameSvg } from "./SurahNameSvg";

export interface QCFPageRendererProps {
  pageNumber: number;
  riwaya: Riwaya;
  onWordClick?: (data: { surah: number; ayah: number; wordIndex: number; rect?: DOMRect }) => void;
  /** Live session student: preview annotations on hover (optional). */
  onWordMouseEnter?: (data: { surah: number; ayah: number; wordIndex: number; rect?: DOMRect }) => void;
  onWordMouseLeave?: (data: { surah: number; ayah: number; wordIndex: number }) => void;
  /** Optional: emits only for ayah-number marker hover. */
  onAyahMarkerMouseEnter?: (data: { surah: number; ayah: number; rect?: DOMRect }) => void;
  onAyahMarkerMouseLeave?: (data: { surah: number; ayah: number }) => void;
  onAyahClick?: (data: { surah: number; ayah: number }) => void;
  highlightRange?: { surah: number; ayahStart: number; ayahEnd: number } | null;
  activeWord?: { surah: number; ayah: number; wordIndex: number } | null;
  /** CSS class for words that have annotations (e.g. mushaf-word--error-jali) */
  getWordAnnotationClass?: (surah: number, ayah: number, wordPosition: number) => string;
}

function isHighlighted(
  word: WordData,
  range: { surah: number; ayahStart: number; ayahEnd: number } | null | undefined,
): boolean {
  if (!range) return false;
  if (word.surah !== range.surah) return false;
  return word.ayah >= range.ayahStart && word.ayah <= range.ayahEnd;
}

function isActiveWord(
  word: WordData,
  active: { surah: number; ayah: number; wordIndex: number } | null | undefined,
): boolean {
  if (!active) return false;
  return (
    word.surah === active.surah && word.ayah === active.ayah && word.wordPosition === active.wordIndex
  );
}

/** Quran.com / QCF: verse-end glyphs (circle + number) use `char_type_name: end` — still clickable, not “word” text. */
function isVerseEndMarker(word: WordData): boolean {
  return word.charTypeName.toLowerCase() === "end";
}

function ariaLabelForWord(
  word: WordData,
  t: (key: string, opts?: Record<string, unknown>) => string,
): string {
  const surahName = getSurahName(word.surah, "ar");
  if (isVerseEndMarker(word)) {
    return t("mushaf.aria.ayahMarker", {
      surah: surahName,
      surahN: word.surah,
      ayah: word.ayah,
    });
  }
  return t("mushaf.aria.word", {
    surah: surahName,
    surahN: word.surah,
    ayah: word.ayah,
    word: word.wordPosition,
  });
}

/** Surah frame + basmalah stay at top; remaining lines are ayah rows (incl. empty grid slots). */
function partitionOpeningHeadBody(lines: LineData[]): { head: LineData[]; body: LineData[] } {
  let i = 0;
  while (i < lines.length && (lines[i].lineType === "surah_name" || lines[i].lineType === "basmallah")) {
    i++;
  }
  return { head: lines.slice(0, i), body: lines.slice(i) };
}

/** Vertically center only real ayah text — drop leading/trailing empty grid lines. */
function trimAyahLinesForCentering(body: LineData[]): LineData[] {
  const first = body.findIndex((l) => l.words.length > 0);
  if (first === -1) return body;
  let last = body.length - 1;
  while (last >= first && body[last].words.length === 0) last--;
  return body.slice(first, last + 1);
}

export function QCFPageRenderer({
  pageNumber,
  riwaya,
  onWordClick,
  onWordMouseEnter,
  onWordMouseLeave,
  onAyahMarkerMouseEnter,
  onAyahMarkerMouseLeave,
  onAyahClick,
  highlightRange,
  activeWord,
  getWordAnnotationClass,
}: QCFPageRendererProps) {
  const { t } = useTranslation();
  const { data, loading, error, reload } = useQuranPage(pageNumber, riwaya);
  const [fontReady, setFontReady] = useState(false);
  /** Fills the card content area — measured for two-constraint font (not the hugged text column). */
  const measureRef = useRef<HTMLDivElement>(null);
  const [fontSizePx, setFontSizePx] = useState(28);

  useCancellableEffect(
    async (signal) => {
      setFontReady(false);
      try {
        const pages = new Set<number>([pageNumber]);
        if (data?.lines && data.pageNumber === pageNumber) {
          for (const line of data.lines) {
            for (const w of line.words) {
              const p = w.glyphPageFont;
              if (typeof p === "number" && p >= 1 && p <= 604) pages.add(p);
            }
          }
        }
        await Promise.all([...pages].map((p) => loadPageFont(p)));
        /* One frame after fonts are ready so the first paint uses QCF, not fallback metrics. */
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
        if (signal.aborted) return;
        setFontReady(true);
      } catch {
        if (signal.aborted) return;
        setFontReady(false);
      }
    },
    [pageNumber, data],
  );

  useEffect(() => {
    if (!fontReady || !measureRef.current || !data?.lines?.length) return;
    const el = measureRef.current;
    const lineCount = Math.max(1, data.lines.length);
    /** Madina pages are laid out on a 15-line grid; cap short pages to this scale. */
    const STANDARD_LINES = 15;
    const LINE_HEIGHT = 1.65;
    const FONT_MIN = 16;
    const FONT_MAX = 48;

    const applyFit = () => {
      const usableW = el.clientWidth;
      const usableH = el.clientHeight;
      if (usableW < 64) return;

      const fontW = (usableW - 2) / 16;
      const card = el.closest("[data-mushaf-card]");
      const heightBounded = card?.getAttribute("data-mushaf-fit") === "1";

      let next: number;
      if (heightBounded && usableH >= 48) {
        // Height-first: full page visible. Cap short pages at the 15-line scale.
        const fontH = (usableH - 2) / lineCount / LINE_HEIGHT;
        const fontHCap = (usableH - 2) / STANDARD_LINES / LINE_HEIGHT;
        next = Math.min(fontH, fontHCap, fontW);
      } else {
        // Standalone / unbounded height: width-only (avoid content-height feedback loops).
        next = fontW;
      }
      next = Math.max(FONT_MIN, Math.min(FONT_MAX, next));
      setFontSizePx((prev) => (Math.abs(prev - next) < 0.25 ? prev : next));
    };

    const ro = new ResizeObserver(() => {
      /* Double rAF so CSS has committed the new card size before we read it. */
      requestAnimationFrame(() => requestAnimationFrame(applyFit));
    });
    ro.observe(el);
    const card = el.closest("[data-mushaf-card]");
    if (card instanceof HTMLElement && card !== el) ro.observe(card);

    requestAnimationFrame(() => requestAnimationFrame(applyFit));
    return () => ro.disconnect();
  }, [fontReady, data?.lines?.length, pageNumber]);

  useEffect(() => {
    if (fontReady) preloadAdjacentPages(pageNumber);
  }, [fontReady, pageNumber]);

  useEffect(() => {
    if (!highlightRange || !fontReady) return;
    requestAnimationFrame(() => {
      const firstHighlighted = measureRef.current?.querySelector(".mushaf-word--highlighted");
      if (firstHighlighted) {
        firstHighlighted.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    });
  }, [highlightRange, fontReady, pageNumber]);

  const handleWordClick = useCallback(
    (word: WordData, e: MouseEvent<HTMLSpanElement> | KeyboardEvent<HTMLSpanElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      onWordClick?.({ surah: word.surah, ayah: word.ayah, wordIndex: word.wordPosition, rect });
      onAyahClick?.({ surah: word.surah, ayah: word.ayah });
    },
    [onWordClick, onAyahClick],
  );

  const handleWordMouseEnter = useCallback(
    (word: WordData, e: MouseEvent<HTMLSpanElement>) => {
      if (!onWordMouseEnter) return;
      const rect = e.currentTarget.getBoundingClientRect();
      onWordMouseEnter({
        surah: word.surah,
        ayah: word.ayah,
        wordIndex: word.wordPosition,
        rect,
      });
    },
    [onWordMouseEnter],
  );

  const handleWordMouseLeave = useCallback(
    (word: WordData) => {
      onWordMouseLeave?.({
        surah: word.surah,
        ayah: word.ayah,
        wordIndex: word.wordPosition,
      });
    },
    [onWordMouseLeave],
  );

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-8 text-center text-sm text-[var(--color-text-muted)]">
        <p>{t("mushaf.loadError")}</p>
        <Button type="button" variant="outline" size="sm" onClick={() => reload()}>
          {t("mushaf.retryLoad")}
        </Button>
      </div>
    );
  }

  if (loading || !data || !fontReady) {
    return (
      <div className="flex w-full flex-col gap-3 py-6" aria-busy="true">
        {Array.from({ length: 15 }).map((_, i) => (
          <div key={i} className="h-5 w-full rounded-sm bg-muted/60 animate-pulse" />
        ))}
        <span className="sr-only">{t("mushaf.loading")}</span>
      </div>
    );
  }

  const centerInColumn = isMushafOpeningCenterPage(pageNumber, riwaya);

  const lineProps = {
    mushafPageNumber: pageNumber,
    highlightRange,
    activeWord,
    getWordAnnotationClass,
    onWordClick: handleWordClick,
    onWordMouseEnter: onWordMouseEnter ? handleWordMouseEnter : undefined,
    onWordMouseLeave: onWordMouseLeave ? handleWordMouseLeave : undefined,
    onAyahMarkerMouseEnter,
    onAyahMarkerMouseLeave,
    t,
  };

  const safeFontPx = Math.min(48, Math.max(16, Number.isFinite(fontSizePx) ? fontSizePx : 28));
  /** Widest justified QCF line ≈ 16em; hug that width and center in the card. */
  const textColMaxPx = safeFontPx * 16;
  const lineCount = data.lines.length;
  const centerShort = centerInColumn || lineCount < 15;

  const textClass = cn(
    "mx-auto flex w-full flex-col text-[var(--color-text)]",
    centerShort && "flex-1 justify-center",
  );
  const textStyle = {
    fontSize: safeFontPx,
    lineHeight: 1.65 as const,
    maxWidth: textColMaxPx,
  };

  const lines = (() => {
    if (centerInColumn) {
      const { head, body } = partitionOpeningHeadBody(data.lines);
      const bodyCenter = trimAyahLinesForCentering(body);
      return [...head, ...bodyCenter];
    }
    return data.lines;
  })();

  return (
    <div
      ref={measureRef}
      className="flex h-full min-h-0 w-full min-w-0 flex-1 flex-col"
    >
      <div className={textClass} style={textStyle}>
        {lines.map((line) => (
          <LineView key={line.lineNumber} line={line} {...lineProps} />
        ))}
      </div>
    </div>
  );
}

function LineView({
  line,
  mushafPageNumber,
  highlightRange,
  activeWord,
  getWordAnnotationClass,
  onWordClick,
  onWordMouseEnter,
  onWordMouseLeave,
  onAyahMarkerMouseEnter,
  onAyahMarkerMouseLeave,
  t,
}: {
  line: LineData;
  mushafPageNumber: number;
  highlightRange?: { surah: number; ayahStart: number; ayahEnd: number } | null;
  activeWord?: { surah: number; ayah: number; wordIndex: number } | null;
  getWordAnnotationClass?: (surah: number, ayah: number, wordPosition: number) => string;
  onWordClick: (w: WordData, e: MouseEvent<HTMLSpanElement> | KeyboardEvent<HTMLSpanElement>) => void;
  onWordMouseEnter?: (w: WordData, e: MouseEvent<HTMLSpanElement>) => void;
  onWordMouseLeave?: (w: WordData) => void;
  onAyahMarkerMouseEnter?: (data: { surah: number; ayah: number; rect?: DOMRect }) => void;
  onAyahMarkerMouseLeave?: (data: { surah: number; ayah: number }) => void;
  t: (key: string, opts?: Record<string, unknown>) => string;
}) {
  if (line.lineType === "surah_name" && line.surahNumber != null) {
    const sn = line.surahNumber;
    return (
      <div className="mushaf-line mushaf-line--centered flex w-full items-center justify-center gap-3 py-[0.05em]">
        <span
          className="h-px max-w-[96px] flex-1 bg-[color-mix(in_srgb,var(--mushaf-surah-title-color)_22%,transparent)]"
          aria-hidden
        />
        <SurahNameSvg surah={sn} className="h-[1.25em] w-auto max-w-[min(100%,11em)] shrink-0" />
        <span
          className="h-px max-w-[96px] flex-1 bg-[color-mix(in_srgb,var(--mushaf-surah-title-color)_22%,transparent)]"
          aria-hidden
        />
      </div>
    );
  }

  if (line.lineType === "basmallah") {
    return (
      <div className="mushaf-line mushaf-line--centered flex justify-center py-[0.05em]">
        <MushafBasmalahSvg className="h-[1.35em] w-auto max-w-full text-[var(--color-text)]" />
      </div>
    );
  }

  const hasWords = line.words.length > 0;
  if (!hasWords) {
    return <div className="mushaf-line mushaf-line--empty min-h-[1.1em]" dir="rtl" />;
  }

  const ayahRowClass = line.isCentered
    ? "mushaf-line mushaf-ayah-line mushaf-ayah-line--center"
    : "mushaf-line mushaf-ayah-line mushaf-ayah-line--justify";

  return (
    <div className={ayahRowClass} dir="rtl">
      {line.words.map((word) => {
        const annotationClass = getWordAnnotationClass?.(word.surah, word.ayah, word.wordPosition) ?? "";
        return (
          <span
            key={word.id}
            className={`mushaf-word ${isVerseEndMarker(word) ? "mushaf-word--ayah-marker" : ""} ${
              isHighlighted(word, highlightRange) ? "mushaf-word--highlighted" : ""
            } ${isActiveWord(word, activeWord) ? "mushaf-word--active" : ""} ${annotationClass}`}
            style={{ fontFamily: getPageFontFamily(word.glyphPageFont ?? mushafPageNumber) }}
            role="button"
            tabIndex={0}
            lang="ar"
            aria-label={ariaLabelForWord(word, t)}
            data-surah={word.surah}
            data-ayah={word.ayah}
            data-word={word.wordPosition}
            onClick={(e) => onWordClick(word, e)}
            onKeyDown={(e) => {
              if (e.key !== "Enter" && e.key !== " ") return;
              e.preventDefault();
              onWordClick(word, e);
            }}
            onMouseEnter={(e) => {
              onWordMouseEnter?.(word, e);
              if (isVerseEndMarker(word)) {
                onAyahMarkerMouseEnter?.({
                  surah: word.surah,
                  ayah: word.ayah,
                  rect: e.currentTarget.getBoundingClientRect(),
                });
              }
            }}
            onMouseLeave={() => {
              onWordMouseLeave?.(word);
              if (isVerseEndMarker(word)) {
                onAyahMarkerMouseLeave?.({ surah: word.surah, ayah: word.ayah });
              }
            }}
          >
            {word.glyph}
          </span>
        );
      })}
    </div>
  );
}
