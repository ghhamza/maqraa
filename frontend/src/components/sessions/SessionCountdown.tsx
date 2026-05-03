// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

import { useEffect, useState } from "react";
import { Timer } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import type { SessionPublic } from "../../types";
import { cn } from "@/lib/utils";

export interface SessionCountdownProps {
  scheduledAt: string;
  durationMinutes: number;
  status: SessionPublic["status"];
}

function formatCoarseRemaining(ms: number, t: TFunction): string {
  let r = Math.max(0, Math.floor(ms));
  const days = Math.floor(r / 86400000);
  r %= 86400000;
  const hours = Math.floor(r / 3600000);
  r %= 3600000;
  const minutes = Math.floor(r / 60000);
  const segments: { v: number; key: "unitDay" | "unitHour" | "unitMinute" }[] = [];
  if (days > 0) segments.push({ v: days, key: "unitDay" });
  if (hours > 0) segments.push({ v: hours, key: "unitHour" });
  if (minutes > 0) segments.push({ v: minutes, key: "unitMinute" });
  const picked = segments.slice(0, 2);
  if (picked.length === 0) return t("sessions.unitMinute", { n: 0 });
  return picked.map((s) => t(`sessions.${s.key}`, { n: s.v })).join(" ");
}

/** Remaining until start; granular = minute+second breakdown (under 1h). */
function formatRemaining(ms: number, granular: boolean, t: TFunction): string {
  if (!granular) {
    return formatCoarseRemaining(ms, t);
  }
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  if (m > 0) {
    return s > 0
      ? `${t("sessions.unitMinute", { n: m })} ${t("sessions.unitSecond", { n: s })}`
      : t("sessions.unitMinute", { n: m });
  }
  return t("sessions.unitSecond", { n: s });
}

/** Tier colors for time-until-start (`msFromStart = now - scheduled`), before session starts. */
function scheduledBeforeStartClass(msFromStart: number): string {
  if (msFromStart < -3600000) return "text-sm text-[var(--color-text-muted)]";
  if (msFromStart < -900000) return "text-sm text-[var(--color-text)]";
  if (msFromStart < -300000) return "text-sm text-[var(--color-primary)]";
  return "text-sm font-semibold text-[var(--color-primary)]";
}

function formatRunning(ms: number, t: TFunction): string {
  if (ms >= 3600000) {
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    const value = `${t("sessions.unitHour", { n: h })} ${t("sessions.unitMinute", { n: m })}`;
    return t("sessions.countdownRunning", { value });
  }
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const value =
    m > 0
      ? s > 0
        ? `${t("sessions.unitMinute", { n: m })} ${t("sessions.unitSecond", { n: s })}`
        : t("sessions.unitMinute", { n: m })
      : t("sessions.unitSecond", { n: s });
  return t("sessions.countdownRunning", { value });
}

export function SessionCountdown(props: SessionCountdownProps) {
  const { scheduledAt, status } = props;
  const { t } = useTranslation();
  const [now, setNow] = useState(() => Date.now());

  const start = new Date(scheduledAt).getTime();

  useEffect(() => {
    if (status === "completed" || status === "cancelled") return;

    const tick = () => setNow(Date.now());

    const msFromStart = Date.now() - start;
    let intervalMs = 30000;
    if (status === "in_progress") {
      intervalMs = 1000;
    } else if (status === "scheduled") {
      if (msFromStart > 0) {
        intervalMs = 30000;
      } else {
        const untilStart = start - Date.now();
        if (untilStart > 3600000) {
          intervalMs = 30000;
        } else {
          intervalMs = 1000;
        }
      }
    }

    const id = setInterval(tick, intervalMs);
    tick();
    return () => clearInterval(id);
  }, [now, start, status]);

  if (status === "completed" || status === "cancelled") {
    return null;
  }

  const msFromStart = now - start;
  const untilStart = start - now;

  let text: string;
  let className = "text-sm text-[var(--color-text-muted)]";

  if (status === "in_progress") {
    const runningMs = Math.max(0, now - start);
    text = formatRunning(runningMs, t);
    className = "text-sm text-[var(--color-primary)]";
  } else if (status === "scheduled") {
    if (msFromStart > 0) {
      text = t("sessions.countdownLate", { value: formatCoarseRemaining(msFromStart, t) });
      className = "text-sm text-[var(--color-warning)]";
    } else {
      if (untilStart > 3600000) {
        text = t("sessions.countdownIn", { value: formatRemaining(untilStart, false, t) });
      } else if (untilStart > 300000) {
        text = t("sessions.countdownIn", { value: formatRemaining(untilStart, true, t) });
      } else {
        text = t("sessions.countdownIn", { value: formatRemaining(Math.max(0, untilStart), true, t) });
      }
      className = scheduledBeforeStartClass(msFromStart);
    }
  } else {
    return null;
  }

  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <Timer className="h-3.5 w-3.5 shrink-0 text-current opacity-90" aria-hidden />
      <span>{text}</span>
    </span>
  );
}
