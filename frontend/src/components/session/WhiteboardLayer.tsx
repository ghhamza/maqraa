// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

import { useCallback, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { pathFromNormalizedStroke, strokeFillOpacity } from "../../lib/strokePath";
import type { SessionStroke } from "../../hooks/useSessionWebSocket";

export type StrokePoint = [number, number, number];

interface WhiteboardLayerProps {
  strokes: SessionStroke[];
  drawingEnabled: boolean;
  color: string;
  width: number;
  onStrokeComplete: (points: StrokePoint[]) => void;
  className?: string;
}

function pathForPoints(points: number[][], size: number): string {
  return pathFromNormalizedStroke(points, size);
}

/**
 * SVG freehand overlay for the mushaf/board page card.
 * Points are normalized 0–1 relative to this element (`data-mushaf-card`).
 */
export function WhiteboardLayer({
  strokes,
  drawingEnabled,
  color,
  width,
  onStrokeComplete,
  className,
}: WhiteboardLayerProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [livePoints, setLivePoints] = useState<StrokePoint[] | null>(null);
  const drawingRef = useRef(false);

  const toNorm = useCallback((e: React.PointerEvent<SVGSVGElement>): StrokePoint | null => {
    const el = svgRef.current;
    if (!el) return null;
    const r = el.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) return null;
    const x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.height;
    const pressure = e.pressure > 0 ? e.pressure : 0.5;
    return [
      Math.min(1, Math.max(0, x)),
      Math.min(1, Math.max(0, y)),
      Math.min(1, Math.max(0, pressure)),
    ];
  }, []);

  const onPointerDown = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      if (!drawingEnabled || e.button !== 0) return;
      const pt = toNorm(e);
      if (!pt) return;
      e.preventDefault();
      e.stopPropagation();
      (e.currentTarget as SVGSVGElement).setPointerCapture(e.pointerId);
      drawingRef.current = true;
      setLivePoints([pt]);
    },
    [drawingEnabled, toNorm],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      if (!drawingRef.current) return;
      const pt = toNorm(e);
      if (!pt) return;
      e.preventDefault();
      setLivePoints((prev) => (prev ? [...prev, pt] : [pt]));
    },
    [toNorm],
  );

  const endStroke = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      if (!drawingRef.current) return;
      drawingRef.current = false;
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      setLivePoints((prev) => {
        if (prev && prev.length > 0) onStrokeComplete(prev);
        return null;
      });
    },
    [onStrokeComplete],
  );

  const livePath = useMemo(
    () => (livePoints ? pathForPoints(livePoints, width) : ""),
    [livePoints, width],
  );

  return (
    <svg
      ref={svgRef}
      className={cn(
        "absolute inset-0 z-[3] h-full w-full",
        drawingEnabled ? "touch-none" : "pointer-events-none",
        className,
      )}
      style={{ pointerEvents: drawingEnabled ? "auto" : "none" }}
      viewBox="0 0 1 1"
      preserveAspectRatio="none"
      aria-hidden={!drawingEnabled}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endStroke}
      onPointerCancel={endStroke}
    >
      {strokes.map((s) => {
        const pts = normalizePoints(s.points);
        const d = pathForPoints(pts, s.width);
        if (!d) return null;
        return (
          <path
            key={s.id}
            d={d}
            fill={s.color}
            fillOpacity={strokeFillOpacity(s.color)}
          />
        );
      })}
      {livePath ? (
        <path d={livePath} fill={color} fillOpacity={strokeFillOpacity(color)} />
      ) : null}
    </svg>
  );
}

function normalizePoints(raw: SessionStroke["points"]): number[][] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((pt) => {
      if (!Array.isArray(pt) || pt.length < 2) return null;
      const x = Number(pt[0]);
      const y = Number(pt[1]);
      const p = pt.length >= 3 ? Number(pt[2]) : 0.5;
      if (![x, y, p].every((n) => Number.isFinite(n))) return null;
      return [x, y, p];
    })
    .filter((p): p is number[] => p != null);
}
