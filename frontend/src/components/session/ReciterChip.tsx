// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

import { useCallback, useEffect, useRef, useState } from "react";
import { GripVertical, Users } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { getSurahName } from "../../lib/quranService";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return ((parts[0]?.[0] ?? "") + (parts[parts.length - 1]?.[0] ?? "")).toUpperCase();
  }
  return (parts[0] ?? "?").slice(0, 2).toUpperCase();
}

export interface ReciterChipProps {
  /** Active reciter display name, or null when empty. */
  reciterName: string | null;
  currentAyah: { surah: number; ayah: number } | null;
  isTeacher: boolean;
  locale: string;
  storageKey: string;
  onGiveTurn: () => void;
  onEndRecitation: () => void;
  /** When false, hide end button (e.g. mic-only without a plan to grade). */
  canEndRecitation?: boolean;
  className?: string;
}

type Pos = { x: number; y: number };

function loadPos(key: string): Pos | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Pos;
    if (typeof parsed.x === "number" && typeof parsed.y === "number") return parsed;
  } catch {
    /* ignore */
  }
  return null;
}

function clampToStage(pos: Pos, el: HTMLElement, stage: HTMLElement): Pos {
  const sr = stage.getBoundingClientRect();
  const er = el.getBoundingClientRect();
  const maxX = Math.max(0, sr.width - er.width);
  const maxY = Math.max(0, sr.height - er.height);
  return {
    x: Math.min(maxX, Math.max(0, pos.x)),
    y: Math.min(maxY, Math.max(0, pos.y)),
  };
}

/**
 * Draggable live-session reciter chip (active / empty). Position persists in localStorage.
 */
export function ReciterChip({
  reciterName,
  currentAyah,
  isTeacher,
  locale,
  storageKey,
  onGiveTurn,
  onEndRecitation,
  canEndRecitation = true,
  className,
}: ReciterChipProps) {
  const { t, i18n } = useTranslation();
  const rootRef = useRef<HTMLDivElement>(null);
  const dragOffset = useRef({ x: 0, y: 0 });
  const [pos, setPos] = useState<Pos | null>(() => loadPos(storageKey));
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    const el = rootRef.current;
    const stage = el?.offsetParent as HTMLElement | null;
    if (!el || !stage || !pos) return;
    const next = clampToStage(pos, el, stage);
    if (next.x !== pos.x || next.y !== pos.y) {
      setPos(next);
      localStorage.setItem(storageKey, JSON.stringify(next));
    }
  }, [pos, storageKey]);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== 0) return;
      const el = rootRef.current;
      const stage = el?.offsetParent as HTMLElement | null;
      if (!el || !stage) return;
      e.preventDefault();
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      const sr = stage.getBoundingClientRect();
      const er = el.getBoundingClientRect();
      const current = pos ?? { x: er.left - sr.left, y: er.top - sr.top };
      if (!pos) setPos(current);
      dragOffset.current = { x: e.clientX - sr.left - current.x, y: e.clientY - sr.top - current.y };
      setDragging(true);
    },
    [pos],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragging) return;
      const el = rootRef.current;
      const stage = el?.offsetParent as HTMLElement | null;
      if (!el || !stage) return;
      const sr = stage.getBoundingClientRect();
      const next = clampToStage(
        {
          x: e.clientX - sr.left - dragOffset.current.x,
          y: e.clientY - sr.top - dragOffset.current.y,
        },
        el,
        stage,
      );
      setPos(next);
    },
    [dragging],
  );

  const onPointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (!dragging) return;
      setDragging(false);
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      if (pos) localStorage.setItem(storageKey, JSON.stringify(pos));
    },
    [dragging, pos, storageKey],
  );

  const ayahLabel =
    currentAyah != null
      ? `${getSurahName(currentAyah.surah, locale)} ${currentAyah.ayah}`
      : null;

  const style: React.CSSProperties =
    pos != null
      ? { left: pos.x, top: pos.y, right: "auto", insetInlineEnd: "auto" }
      : { top: 28, insetInlineEnd: 26 };

  return (
    <div
      ref={rootRef}
      className={cn(
        "pointer-events-auto absolute z-20 flex max-w-[min(22rem,calc(100%-3rem))] items-center gap-2 rounded-xl border border-[rgba(15,23,42,0.10)] bg-white py-1.5 pe-3 ps-1.5 shadow-[0_4px_18px_rgba(0,0,0,0.06)]",
        className,
      )}
      style={style}
      dir={i18n.language?.startsWith("ar") ? "rtl" : "ltr"}
    >
      <button
        type="button"
        className="flex size-8 shrink-0 cursor-grab touch-none items-center justify-center rounded-lg text-[#9CA3AF] active:cursor-grabbing"
        title={t("liveSession.dragToMove")}
        aria-label={t("liveSession.dragToMove")}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <GripVertical className="size-4" aria-hidden />
      </button>

      {reciterName ? (
        <>
          <span
            className="grid size-[30px] shrink-0 place-items-center rounded-full bg-[#1B5E20] text-xs font-bold text-white"
            aria-hidden
          >
            {initials(reciterName)}
          </span>
          <span className="min-w-0 flex-1 leading-tight">
            <span className="block truncate text-[13px] font-semibold text-[#1A1A1A]">{reciterName}</span>
            <span className="block truncate text-[11px] text-[#6B7280]">
              {t("liveSession.turn.recitingNow")}
              {ayahLabel ? ` · ${ayahLabel}` : ""}
            </span>
          </span>
          <span className="flex h-3.5 items-end gap-0.5" aria-hidden>
            <i className="reciter-eq-bar h-1.5 w-0.5 rounded-sm bg-[#4CAF50]" />
            <i className="reciter-eq-bar h-3 w-0.5 rounded-sm bg-[#4CAF50] [animation-delay:150ms]" />
            <i className="reciter-eq-bar h-2 w-0.5 rounded-sm bg-[#4CAF50] [animation-delay:300ms]" />
          </span>
          {isTeacher && canEndRecitation ? (
            <button
              type="button"
              onClick={onEndRecitation}
              className="shrink-0 rounded-lg border border-[rgba(27,94,32,0.30)] bg-transparent px-2.5 py-1.5 text-[11px] font-semibold text-[#1B5E20] hover:bg-[rgba(27,94,32,0.08)]"
            >
              {t("liveSession.turn.endRecitation")}
            </button>
          ) : null}
        </>
      ) : (
        <>
          <span
            className="grid size-[30px] shrink-0 place-items-center rounded-full bg-[#F4F5F1] text-[#6B7280]"
            aria-hidden
          >
            <Users className="size-3.5" />
          </span>
          <span className="min-w-0 flex-1 text-[13px] font-medium text-[#6B7280]">
            {t("liveSession.turn.noReciter")}
          </span>
          {isTeacher ? (
            <button
              type="button"
              onClick={onGiveTurn}
              className="shrink-0 rounded-lg bg-[rgba(212,168,67,0.16)] px-2.5 py-1.5 text-[11px] font-semibold text-[#9a7616] hover:bg-[rgba(212,168,67,0.28)]"
            >
              {t("liveSession.turn.giveTurn")}
            </button>
          ) : null}
        </>
      )}
    </div>
  );
}
