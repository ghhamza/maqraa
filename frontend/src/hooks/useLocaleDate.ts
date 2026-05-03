// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { intlLocaleForAppLanguage } from "../lib/intlLocale";

export function useLocaleDate() {
  const { i18n } = useTranslation();
  const locale = intlLocaleForAppLanguage(i18n.language);

  return useMemo(
    () => ({
      medium: (d: string | Date) =>
        new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(new Date(d)),
      mediumTime: (d: string | Date) =>
        new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(
          new Date(d),
        ),
      /** Time only (locale-aware), for ranges paired with date pods. */
      timeShort: (d: string | Date) =>
        new Intl.DateTimeFormat(locale, { timeStyle: "short" }).format(new Date(d)),
      /** e.g. "Fri, May 8" / Arabic weekday + day + month — no year. */
      shortWeekdayDate: (d: string | Date) =>
        new Intl.DateTimeFormat(locale, {
          weekday: "short",
          day: "numeric",
          month: "short",
        }).format(new Date(d)),
      /** Weekday + calendar date, e.g. "Friday, May 8, 2026" in `en-US`. */
      weekdayDate: (d: string | Date) =>
        new Intl.DateTimeFormat(locale, {
          weekday: "long",
          month: "long",
          day: "numeric",
          year: "numeric",
        }).format(new Date(d)),
      full: (d: string | Date) =>
        new Intl.DateTimeFormat(locale, { dateStyle: "full", timeStyle: "short" }).format(
          new Date(d),
        ),
    }),
    [locale],
  );
}
