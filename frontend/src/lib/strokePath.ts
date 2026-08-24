// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

import { getStroke } from "perfect-freehand";

/**
 * perfect-freehand assumes pixel-scale coordinates. Strokes are stored in
 * normalized 0–1 space; scale up for outline generation then scale back.
 */
const FREEHAND_SCALE = 1000;

/** Convert perfect-freehand outline points to an SVG path `d` string. */
export function getSvgPathFromStroke(points: number[][], closed = true): string {
  const len = points.length;
  if (len < 4) return "";

  const average = (a: number, b: number) => (a + b) / 2;

  let a = points[0]!;
  let b = points[1]!;
  const c = points[2]!;

  let result = `M${a[0]!.toFixed(4)},${a[1]!.toFixed(4)} Q${b[0]!.toFixed(4)},${b[1]!.toFixed(
    4,
  )} ${average(b[0]!, c[0]!).toFixed(4)},${average(b[1]!, c[1]!).toFixed(4)} T`;

  for (let i = 2, max = len - 1; i < max; i++) {
    a = points[i]!;
    b = points[i + 1]!;
    result += `${average(a[0]!, b[0]!).toFixed(4)},${average(a[1]!, b[1]!).toFixed(4)} `;
  }

  if (closed) result += "Z";
  return result;
}

/** Build an SVG path for a freehand stroke in normalized 0–1 coordinates. */
export function pathFromNormalizedStroke(points: number[][], size: number): string {
  if (points.length === 0) return "";
  const scaled = points.map((pt) => {
    const x = Number(pt[0]) * FREEHAND_SCALE;
    const y = Number(pt[1]) * FREEHAND_SCALE;
    const rawP = pt.length >= 3 ? Number(pt[2]) : 0.5;
    const p = Number.isFinite(rawP) ? rawP : 0.5;
    return [x, y, p];
  });
  const outline = getStroke(scaled, {
    size: size * FREEHAND_SCALE,
    thinning: 0.45,
    smoothing: 0.55,
    streamline: 0.55,
    simulatePressure: true,
    last: true,
  });
  const normalized = outline.map((pt) => [
    (pt[0] ?? 0) / FREEHAND_SCALE,
    (pt[1] ?? 0) / FREEHAND_SCALE,
  ]);
  return getSvgPathFromStroke(normalized);
}

export const STROKE_COLORS = {
  pen: "#EF5350",
  penAlt: "#185fa5",
  highlighter: "#D4A843",
} as const;

/** Normalized stroke size (viewBox 0–1). */
export const STROKE_WIDTH = {
  pen: 0.012,
  highlighter: 0.028,
} as const;

export function strokeFillOpacity(color: string): number {
  return color.toLowerCase() === STROKE_COLORS.highlighter.toLowerCase() ? 0.35 : 1;
}
