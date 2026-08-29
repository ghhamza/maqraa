// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

import type { Room, SessionPublic } from "../types";

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

export type TeacherCockpitKind =
  | "live"
  | "starting_soon"
  | "log_recitations"
  | "no_halaqah"
  | "invite"
  | "schedule_next"
  | "next_session";

export type TeacherCockpitState =
  | { kind: "live"; session: SessionPublic }
  | { kind: "starting_soon"; session: SessionPublic }
  | { kind: "log_recitations"; session: SessionPublic }
  | { kind: "no_halaqah" }
  | { kind: "invite"; room: Room }
  | { kind: "schedule_next"; room: Room }
  | { kind: "next_session"; session: SessionPublic };

export interface TeacherCockpitInput {
  teacherId: string;
  rooms: Room[];
  liveSessions: SessionPublic[];
  upcomingScheduled: SessionPublic[];
  /** Most recent completed session within 48h, if any. */
  recentCompleted: SessionPublic | null;
  /** True when `recentCompleted` has zero recitations (query resolved). */
  recentCompletedHasZeroRecitations: boolean;
  now?: Date;
}

function isSameLocalDay(iso: string, ref: Date): boolean {
  const d = new Date(iso);
  return (
    d.getFullYear() === ref.getFullYear() &&
    d.getMonth() === ref.getMonth() &&
    d.getDate() === ref.getDate()
  );
}

/** True when a scheduled session is today or starts within the next hour (cockpit “بدء الحصة”). */
export function isSessionTodayOrSoon(scheduledAtIso: string, now = new Date()): boolean {
  const at = new Date(scheduledAtIso).getTime();
  const untilStart = at - now.getTime();
  if (untilStart >= 0 && untilStart <= HOUR_MS) return true;
  if (isSameLocalDay(scheduledAtIso, now)) return true;
  return false;
}

function isLaterThanToday(iso: string, ref: Date): boolean {
  const d = new Date(iso);
  const startOfTomorrow = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate() + 1);
  return d.getTime() >= startOfTomorrow.getTime();
}

/** True when the teacher has finished the activation funnel. */
export function isTeacherActivated(opts: {
  roomTotal: number;
  hasEnrolledStudent: boolean;
  completedSessions: number;
  hasAnyRecitation: boolean;
}): boolean {
  return (
    opts.roomTotal > 0 &&
    opts.hasEnrolledStudent &&
    opts.completedSessions > 0 &&
    opts.hasAnyRecitation
  );
}

/**
 * Pick the single primary cockpit state (first match wins).
 * Priority: live → starting soon / overdue today → log recitations →
 * no halaqah → invite → schedule → next session.
 */
export function selectTeacherCockpitState(input: TeacherCockpitInput): TeacherCockpitState {
  const now = input.now ?? new Date();
  const myLive = input.liveSessions.find(
    (s) => s.teacher_id === input.teacherId && s.status === "in_progress",
  );
  if (myLive) return { kind: "live", session: myLive };

  const scheduled = input.upcomingScheduled
    .filter((s) => s.status === "scheduled" && s.teacher_id === input.teacherId)
    .slice()
    .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime());

  const startingSoon = scheduled.find((s) => {
    const at = new Date(s.scheduled_at).getTime();
    const untilStart = at - now.getTime();
    // Within the next hour, or scheduled earlier today and still not started.
    if (untilStart >= 0 && untilStart <= HOUR_MS) return true;
    if (untilStart < 0 && isSameLocalDay(s.scheduled_at, now)) return true;
    // Later today (even if >60 min) — still the actionable "today" session.
    if (untilStart > HOUR_MS && isSameLocalDay(s.scheduled_at, now)) return true;
    return false;
  });
  if (startingSoon) return { kind: "starting_soon", session: startingSoon };

  if (
    input.recentCompleted &&
    input.recentCompletedHasZeroRecitations &&
    now.getTime() - new Date(input.recentCompleted.scheduled_at).getTime() <= 2 * DAY_MS
  ) {
    return { kind: "log_recitations", session: input.recentCompleted };
  }

  if (input.rooms.length === 0) return { kind: "no_halaqah" };

  const firstRoom = input.rooms[0]!;
  const hasStudent = input.rooms.some((r) => r.enrolled_count > 0);
  if (!hasStudent) return { kind: "invite", room: firstRoom };

  if (scheduled.length === 0) return { kind: "schedule_next", room: firstRoom };

  const nextLater = scheduled.find((s) => isLaterThanToday(s.scheduled_at, now));
  if (nextLater) return { kind: "next_session", session: nextLater };

  // Fallback: next scheduled session (should be rare after filters above).
  return { kind: "next_session", session: scheduled[0]! };
}

/** Start button unlocks 15 minutes before scheduled start (and stays unlocked after). */
export function canStartScheduledSession(scheduledAtIso: string, now = new Date()): boolean {
  return new Date(scheduledAtIso).getTime() - now.getTime() <= 15 * 60 * 1000;
}

/** Bare duration for `cockpit.startsIn` (no preposition): "30 minutes" / "٣٠ دقيقة". */
export function formatCountdownCompact(
  scheduledAtIso: string,
  locale: string,
  now = new Date(),
): string {
  const ms = Math.abs(new Date(scheduledAtIso).getTime() - now.getTime());
  const mins = Math.max(1, Math.ceil(ms / 60_000));
  if (mins < 60) {
    return new Intl.NumberFormat(locale, {
      style: "unit",
      unit: "minute",
      unitDisplay: "long",
    }).format(mins);
  }
  const hours = Math.max(1, Math.ceil(ms / 3_600_000));
  if (hours < 48) {
    return new Intl.NumberFormat(locale, {
      style: "unit",
      unit: "hour",
      unitDisplay: "long",
    }).format(hours);
  }
  const days = Math.max(1, Math.ceil(ms / 86_400_000));
  return new Intl.NumberFormat(locale, {
    style: "unit",
    unit: "day",
    unitDisplay: "long",
  }).format(days);
}
