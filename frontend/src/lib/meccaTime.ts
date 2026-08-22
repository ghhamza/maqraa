// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

/** Format session times in Asia/Riyadh for share/activation UI. */

export function formatSessionMecca(iso: string, locale: string): string {
  const date = new Date(iso);
  const loc = locale.startsWith("ar") ? "ar" : locale.startsWith("fr") ? "fr" : "en";
  return new Intl.DateTimeFormat(loc, {
    timeZone: "Asia/Riyadh",
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}

export function formatWeekdayMecca(iso: string, locale: string): string {
  const loc = locale.startsWith("ar") ? "ar" : locale.startsWith("fr") ? "fr" : "en";
  return new Intl.DateTimeFormat(loc, {
    timeZone: "Asia/Riyadh",
    weekday: "long",
  }).format(new Date(iso));
}

export function formatRelativeTo(iso: string, locale: string): string {
  const target = new Date(iso).getTime();
  const now = Date.now();
  const diffSec = Math.round((target - now) / 1000);
  const rtf = new Intl.RelativeTimeFormat(locale.startsWith("ar") ? "ar" : locale.startsWith("fr") ? "fr" : "en", {
    numeric: "auto",
  });
  const abs = Math.abs(diffSec);
  if (abs < 60) return rtf.format(Math.round(diffSec), "second");
  if (abs < 3600) return rtf.format(Math.round(diffSec / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(diffSec / 3600), "hour");
  return rtf.format(Math.round(diffSec / 86400), "day");
}

export function startsWithinMinutes(iso: string, minutes: number): boolean {
  return new Date(iso).getTime() - Date.now() <= minutes * 60_000;
}
