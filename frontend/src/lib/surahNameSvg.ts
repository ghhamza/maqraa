// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

/**
 * Eager-load QUL surah-name SVGs as raw markup, then normalize for inline use
 * with `fill="currentColor"` (CSS mask on external SVG URLs paints a solid box
 * in Safari/WebKit and intermittently elsewhere).
 */
const modules = import.meta.glob<string>("../assets/surah-names/svg/*.svg", {
  eager: true,
  query: "?raw",
  import: "default",
});

const markupBySurah = new Map<number, string>();

function prepareSurahNameMarkup(raw: string): string {
  let svg = raw.replace(/<!--[\s\S]*?-->/g, "").trim();
  svg = svg.replace(/<title>[\s\S]*?<\/title>/gi, "");
  // Drop fixed pixel size so CSS height/width (em) control the glyph.
  svg = svg.replace(/\s(?:width|height)="[^"]*"/gi, "");
  svg = svg.replace(/<svg\b([^>]*)>/i, (_m, attrs: string) => {
    const cleaned = String(attrs)
      .replace(/\sfill="[^"]*"/gi, "")
      .replace(/\saria-hidden="[^"]*"/gi, "")
      .replace(/\sfocusable="[^"]*"/gi, "");
    return `<svg${cleaned} width="100%" height="100%" fill="currentColor" aria-hidden="true" focusable="false">`;
  });
  // Paths have no fill in the QUL assets — inherit currentColor from <svg>.
  svg = svg.replace(/<path\b([^>]*)>/gi, (_m, attrs: string) => {
    if (/\bfill=/i.test(attrs)) return `<path${attrs}>`;
    return `<path${attrs} fill="currentColor">`;
  });
  return svg;
}

for (const [path, raw] of Object.entries(modules)) {
  const file = path.split("/").pop() ?? "";
  const m = /^(\d+)\.svg$/.exec(file);
  if (m && typeof raw === "string") {
    markupBySurah.set(Number(m[1]), prepareSurahNameMarkup(raw));
  }
}

export function getSurahNameSvgMarkup(surahNumber: number): string | undefined {
  if (surahNumber < 1 || surahNumber > 114) return undefined;
  return markupBySurah.get(surahNumber);
}
