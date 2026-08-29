// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

/** Pinned zones shown first in timezone selects. */
export const PINNED_TIMEZONES = [
  "Asia/Riyadh",
  "Africa/Cairo",
  "Africa/Algiers",
  "Africa/Casablanca",
  "Europe/Paris",
] as const;

const CITY_LABELS: Record<string, { ar: string; en: string; fr: string }> = {
  "Asia/Riyadh": { ar: "الرياض", en: "Riyadh", fr: "Riyadh" },
  "Africa/Cairo": { ar: "القاهرة", en: "Cairo", fr: "Le Caire" },
  "Africa/Algiers": { ar: "الجزائر", en: "Algiers", fr: "Alger" },
  "Africa/Casablanca": { ar: "الدار البيضاء", en: "Casablanca", fr: "Casablanca" },
  "Europe/Paris": { ar: "باريس", en: "Paris", fr: "Paris" },
};

export function detectBrowserTimezone(): string {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz && typeof tz === "string" && tz.includes("/")) return tz;
  } catch {
    /* ignore */
  }
  return "Asia/Riyadh";
}

export function resolveUserTimezone(userTz: string | null | undefined): string {
  const trimmed = userTz?.trim();
  if (trimmed) return trimmed;
  return detectBrowserTimezone();
}

function localeTag(locale: string): string {
  if (locale.startsWith("ar")) return "ar";
  if (locale.startsWith("fr")) return "fr";
  return "en";
}

/** City label for common IANA zones; otherwise the IANA city segment. */
export function tzCityLabel(tz: string, locale: string): string {
  const loc = localeTag(locale);
  const known = CITY_LABELS[tz.trim()];
  if (known) return known[loc as keyof typeof known] ?? known.en;
  const segment = tz.trim().split("/").pop() ?? tz;
  return segment.replace(/_/g, " ");
}

export function listTimezoneOptions(): string[] {
  const supported =
    typeof Intl !== "undefined" && "supportedValuesOf" in Intl
      ? (Intl as typeof Intl & { supportedValuesOf: (key: string) => string[] }).supportedValuesOf(
          "timeZone",
        )
      : [...PINNED_TIMEZONES];
  const pinned = PINNED_TIMEZONES.filter((z) => supported.includes(z));
  const rest = supported.filter((z) => !(PINNED_TIMEZONES as readonly string[]).includes(z));
  return [...pinned, ...rest];
}

function formatInTz(
  iso: string | Date,
  timeZone: string,
  locale: string,
  options: Intl.DateTimeFormatOptions,
): string {
  const loc = localeTag(locale);
  return new Intl.DateTimeFormat(loc, { ...options, timeZone }).format(new Date(iso));
}

export interface FormattedSessionTime {
  /** Full datetime in the halaqah timezone. */
  primary: string;
  /** Time-only in the viewer's timezone when different from room tz; otherwise null. */
  secondaryTime: string | null;
  city: string;
  sameZone: boolean;
  roomTz: string;
  userTz: string;
}

/**
 * Dual session-time display: primary in room tz; secondary "your time" when zones differ.
 */
export function formatSessionTime(
  scheduledAtUtc: string,
  roomTz: string,
  userTz: string | null | undefined,
  locale: string,
): FormattedSessionTime {
  const room = roomTz.trim() || "Asia/Riyadh";
  const user = resolveUserTimezone(userTz);
  const sameZone = room === user;
  const primary = formatInTz(scheduledAtUtc, room, locale, {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  const secondaryTime = sameZone
    ? null
    : formatInTz(scheduledAtUtc, user, locale, {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });
  return {
    primary,
    secondaryTime,
    city: tzCityLabel(room, locale),
    sameZone,
    roomTz: room,
    userTz: user,
  };
}

/** Compact weekday in room timezone (activation empty-state titles). */
export function formatWeekdayInTz(iso: string, roomTz: string, locale: string): string {
  return formatInTz(iso, roomTz.trim() || "Asia/Riyadh", locale, { weekday: "long" });
}

type Translate = (key: string, options?: Record<string, unknown>) => string;

/** Single-line string for WhatsApp / share copy (includes room label + optional your time). */
export function formatSessionTimeInviteLine(
  scheduledAtUtc: string,
  roomTz: string,
  userTz: string | null | undefined,
  locale: string,
  t: Translate,
): string {
  const f = formatSessionTime(scheduledAtUtc, roomTz, userTz, locale);
  const roomPart = t("tz.roomTime", { city: f.city });
  if (!f.secondaryTime) {
    return `${f.primary} · ${roomPart}`;
  }
  return `${f.primary} · ${roomPart} · ${t("tz.yourTime", { time: f.secondaryTime })}`;
}

function getTzOffsetMs(date: Date, timeZone: string): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const parts = Object.fromEntries(
    dtf
      .formatToParts(date)
      .filter((p) => p.type !== "literal")
      .map((p) => [p.type, p.value]),
  ) as Record<string, string>;
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );
  return asUtc - date.getTime();
}

/** Convert a wall-clock civil time in `timeZone` to a UTC Date. */
export function zonedWallTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone: string,
): Date {
  let utcMs = Date.UTC(year, month - 1, day, hour, minute, 0);
  for (let i = 0; i < 3; i++) {
    const offset = getTzOffsetMs(new Date(utcMs), timeZone);
    utcMs = Date.UTC(year, month - 1, day, hour, minute, 0) - offset;
  }
  return new Date(utcMs);
}

/** Next calendar day at `hour`:00 in the given IANA timezone (wall-clock). */
export function nextDayAtHourInTz(timeZone: string, hour = 20): Date {
  const tz = timeZone.trim() || "Asia/Riyadh";
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  const y = get("year");
  const m = get("month");
  const d = get("day");
  // Add one calendar day via UTC noon to avoid DST edge issues when bumping the date.
  const tomorrow = new Date(Date.UTC(y, m - 1, d + 1, 12, 0, 0));
  const tParts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(tomorrow);
  const getT = (type: string) => Number(tParts.find((p) => p.type === type)?.value ?? 0);
  return zonedWallTimeToUtc(getT("year"), getT("month"), getT("day"), hour, 0, tz);
}

export function formatRelativeTo(iso: string, locale: string): string {
  const target = new Date(iso).getTime();
  const now = Date.now();
  const diffSec = Math.round((target - now) / 1000);
  const rtf = new Intl.RelativeTimeFormat(localeTag(locale), { numeric: "auto" });
  const abs = Math.abs(diffSec);
  if (abs < 60) return rtf.format(Math.round(diffSec), "second");
  if (abs < 3600) return rtf.format(Math.round(diffSec / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(diffSec / 3600), "hour");
  return rtf.format(Math.round(diffSec / 86400), "day");
}

export function startsWithinMinutes(iso: string, minutes: number): boolean {
  return new Date(iso).getTime() - Date.now() <= minutes * 60_000;
}
