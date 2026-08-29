// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "../ui/Button";
import { cn } from "@/lib/utils";

export type SessionTourStepId = "welcome" | "tools" | "dock" | "correct";

export interface SessionTourStep {
  id: SessionTourStepId;
  /** `data-tour` value; omit for a centered card. */
  target?: string;
  /** Prefer this target on narrow viewports when present. */
  mobileTarget?: string;
}

const DEFAULT_STEPS: SessionTourStep[] = [
  { id: "welcome" },
  { id: "tools", target: "tools", mobileTarget: "dock" },
  { id: "dock", target: "dock", mobileTarget: "dock" },
  { id: "correct", target: "mushaf" },
];

const PAD = 10;

function findVisibleTourTarget(key: string): Element | null {
  const nodes = document.querySelectorAll(`[data-tour="${key}"]`);
  for (const el of nodes) {
    if (isVisible(el)) return el;
  }
  return null;
}

function resolveTarget(step: SessionTourStep, isMobile: boolean): string | null {
  if (isMobile && step.mobileTarget) {
    if (findVisibleTourTarget(step.mobileTarget)) return step.mobileTarget;
  }
  if (step.target) {
    if (findVisibleTourTarget(step.target)) return step.target;
  }
  if (step.mobileTarget) {
    if (findVisibleTourTarget(step.mobileTarget)) return step.mobileTarget;
  }
  return null;
}

function isVisible(el: Element): boolean {
  const style = window.getComputedStyle(el);
  if (style.display === "none" || style.visibility === "hidden") return false;
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0;
}

export interface SessionGuidedTourProps {
  open: boolean;
  onComplete: () => void;
  onSkip: () => void;
  /**
   * i18n namespace for copy, e.g. `demo.tour` or `liveSession.tour`.
   * Expects `.progress`, `.next`, `.finish`, `.skip`, `.steps.{id}.title|body`.
   */
  i18nPrefix?: string;
  steps?: SessionTourStep[];
}

/**
 * Spotlight tour for demo + live teacher sessions (no third-party dependency).
 * Targets elements marked with `data-tour`.
 */
export function SessionGuidedTour({
  open,
  onComplete,
  onSkip,
  i18nPrefix = "demo.tour",
  steps = DEFAULT_STEPS,
}: SessionGuidedTourProps) {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.dir() === "rtl";
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches,
  );

  const step = steps[index] ?? steps[0]!;
  const total = steps.length;

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const onChange = () => setIsMobile(mq.matches);
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (open) setIndex(0);
  }, [open]);

  const measure = useCallback(() => {
    if (!open) return;
    const key = resolveTarget(step, isMobile);
    if (!key) {
      setRect(null);
      return;
    }
    const el = findVisibleTourTarget(key);
    setRect(el ? el.getBoundingClientRect() : null);
  }, [open, step, isMobile]);

  useLayoutEffect(() => {
    measure();
  }, [measure]);

  useEffect(() => {
    if (!open) return;
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [open, measure]);

  const hole = useMemo(() => {
    if (!rect) return null;
    return {
      top: Math.max(8, rect.top - PAD),
      left: Math.max(8, rect.left - PAD),
      width: Math.min(window.innerWidth - 16, rect.width + PAD * 2),
      height: Math.min(window.innerHeight - 16, rect.height + PAD * 2),
    };
  }, [rect]);

  const cardStyle = useMemo(() => {
    if (!hole) {
      return {
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
      } as const;
    }
    const spaceBelow = window.innerHeight - (hole.top + hole.height);
    const preferBelow = spaceBelow > 180;
    const top = preferBelow
      ? hole.top + hole.height + 12
      : Math.max(12, hole.top - 12);
    const transform = preferBelow ? "translateY(0)" : "translateY(-100%)";
    const left = isRtl
      ? Math.min(window.innerWidth - 24, hole.left + hole.width)
      : Math.max(24, hole.left);
    return {
      top,
      left,
      transform: isRtl ? `${transform} translateX(-100%)` : transform,
      maxWidth: "min(22rem, calc(100vw - 2rem))",
    } as const;
  }, [hole, isRtl]);

  if (!open) return null;

  const goNext = () => {
    if (index >= total - 1) {
      onComplete();
      return;
    }
    setIndex((i) => i + 1);
  };

  return (
    <div className="fixed inset-0 z-[80]" role="dialog" aria-modal="true" aria-labelledby="session-tour-title">
      {hole ? (
        <div
          className="pointer-events-none absolute rounded-2xl ring-2 ring-[var(--color-gold)] ring-offset-2 ring-offset-transparent transition-[top,left,width,height] duration-300"
          style={{
            top: hole.top,
            left: hole.left,
            width: hole.width,
            height: hole.height,
            boxShadow: "0 0 0 9999px rgba(15, 23, 42, 0.55)",
          }}
          aria-hidden
        />
      ) : (
        <div className="absolute inset-0 bg-[rgba(15,23,42,0.55)]" aria-hidden />
      )}

      <div className="absolute inset-0" aria-hidden />

      <div
        className={cn(
          "pointer-events-auto absolute z-[81] w-[min(22rem,calc(100vw-2rem))] rounded-2xl border border-black/5 bg-[var(--color-surface)] p-4 shadow-[0_16px_48px_rgba(0,0,0,0.22)]",
        )}
        style={cardStyle}
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-xs font-medium text-[var(--color-text-muted)]">
          {t(`${i18nPrefix}.progress`, { current: index + 1, total })}
        </p>
        <h2
          id="session-tour-title"
          className="mt-1 font-[family-name:var(--font-heading)] text-lg text-[var(--color-text)]"
        >
          {t(`${i18nPrefix}.steps.${step.id}.title`)}
        </h2>
        <p className="mt-1.5 text-sm leading-relaxed text-[var(--color-text-muted)]">
          {t(`${i18nPrefix}.steps.${step.id}.body`)}
        </p>
        <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={onSkip}>
            {t(`${i18nPrefix}.skip`)}
          </Button>
          <Button type="button" variant="primary" size="sm" onClick={goNext}>
            {index >= total - 1 ? t(`${i18nPrefix}.finish`) : t(`${i18nPrefix}.next`)}
          </Button>
        </div>
      </div>
    </div>
  );
}

/** @deprecated Prefer {@link SessionGuidedTour}. */
export const DemoGuidedTour = SessionGuidedTour;

const LIVE_TOUR_USER_PREFIX = "miqraa.liveTour.user.v1.";
const LIVE_TOUR_SESSION_PREFIX = "miqraa.liveTour.session.v1.";

/** Teacher opted out of live tours entirely. */
export function hasOptedOutOfLiveSessionTour(userId: string): boolean {
  try {
    return localStorage.getItem(`${LIVE_TOUR_USER_PREFIX}${userId}`) === "optout";
  } catch {
    return false;
  }
}

export function optOutOfLiveSessionTour(userId: string): void {
  try {
    localStorage.setItem(`${LIVE_TOUR_USER_PREFIX}${userId}`, "optout");
  } catch {
    /* ignore */
  }
}

/** Tour already shown for this live session. */
export function hasSeenLiveTourForSession(sessionId: string): boolean {
  try {
    return localStorage.getItem(`${LIVE_TOUR_SESSION_PREFIX}${sessionId}`) === "1";
  } catch {
    return false;
  }
}

export function markLiveTourSeenForSession(sessionId: string): void {
  try {
    localStorage.setItem(`${LIVE_TOUR_SESSION_PREFIX}${sessionId}`, "1");
  } catch {
    /* ignore */
  }
}

/** @deprecated use hasOptedOutOfLiveSessionTour / hasSeenLiveTourForSession */
export function hasCompletedLiveSessionTour(userId: string): boolean {
  return hasOptedOutOfLiveSessionTour(userId);
}

/** @deprecated use optOutOfLiveSessionTour */
export function markLiveSessionTourCompleted(userId: string): void {
  optOutOfLiveSessionTour(userId);
}
