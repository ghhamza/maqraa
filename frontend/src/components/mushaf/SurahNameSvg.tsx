// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

import { getSurah } from "../../lib/quranService";
import { getSurahNameSvgMarkup } from "../../lib/surahNameSvg";
import { cn } from "@/lib/utils";

export interface SurahNameSvgProps {
  surah: number;
  className?: string;
  /** Screen reader / when SVG is missing */
  fallbackLabel?: string;
}

function viewBoxAspect(markup: string): number | undefined {
  const m = /\bviewBox=["']?\s*([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)/i.exec(markup);
  if (!m) return undefined;
  const w = Number(m[3]);
  const h = Number(m[4]);
  if (!(w > 0 && h > 0)) return undefined;
  return w / h;
}

/**
 * Arabic surah title calligraphy from `assets/surah-names/svg/{n}.svg`.
 *
 * Inlined with `fill="currentColor"` so the glyph uses
 * `--mushaf-surah-title-color`. Aspect ratio is taken from the SVG viewBox so the
 * glyph keeps a visible box (height alone is not enough for inline SVG sizing).
 */
export function SurahNameSvg({ surah, className, fallbackLabel }: SurahNameSvgProps) {
  const markup = getSurahNameSvgMarkup(surah);
  const s = getSurah(surah);
  const label = fallbackLabel ?? (s ? `سورة ${s.nameAr}` : `Surah ${surah}`);

  if (!markup) {
    return (
      <span
        className={cn(
          "inline-block font-semibold text-[var(--mushaf-surah-title-color)]",
          className,
        )}
        style={{ fontFamily: "var(--font-mushaf-title)" }}
      >
        {s?.nameAr ?? String(surah)}
      </span>
    );
  }

  const aspect = viewBoxAspect(markup);

  return (
    <span
      role="img"
      aria-label={label}
      className={cn(
        "inline-block max-w-full text-[var(--mushaf-surah-title-color)] [&_svg]:block [&_svg]:h-full [&_svg]:w-full",
        className,
      )}
      style={aspect != null ? { aspectRatio: String(aspect) } : undefined}
      dangerouslySetInnerHTML={{ __html: markup }}
    />
  );
}
