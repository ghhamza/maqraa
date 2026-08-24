// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

import { useEffect, useState, type RefObject } from "react";

export interface StageFitSize {
  width: number;
  height: number;
}

/**
 * Live-session page card size from the stage box:
 * height fills available stage; width = min(available − gutters, height × 5/7).
 * Font fit is handled separately by two-constraint math in QCFPageRenderer.
 */
export function useStageFitSize(
  containerRef: RefObject<HTMLElement | null>,
  options?: { gutterX?: number; marginY?: number },
): StageFitSize | null {
  const gutterX = options?.gutterX ?? 24;
  const marginY = options?.marginY ?? 8;
  const [size, setSize] = useState<StageFitSize | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const measure = () => {
      const r = el.getBoundingClientRect();
      const availW = Math.max(0, r.width);
      const availH = Math.max(0, r.height);
      if (availW < 48 || availH < 48) return;
      const targetH = Math.max(180, availH - marginY);
      const maxW = Math.max(120, availW - gutterX);
      // Prefer filling height; Madina-ish width, never wider than the stage.
      const width = Math.min(maxW, targetH * (5 / 7));
      setSize((prev) => {
        if (
          prev &&
          Math.abs(prev.width - width) < 0.5 &&
          Math.abs(prev.height - targetH) < 0.5
        ) {
          return prev;
        }
        return { width, height: targetH };
      });
    };

    const ro = new ResizeObserver(() => {
      requestAnimationFrame(() => requestAnimationFrame(measure));
    });
    ro.observe(el);
    requestAnimationFrame(() => requestAnimationFrame(measure));
    return () => ro.disconnect();
  }, [containerRef, gutterX, marginY]);

  return size;
}
