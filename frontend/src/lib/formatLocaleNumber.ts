// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

/** Locale-aware digits (Arabic-Indic in `ar*`, Western otherwise). */
export function formatLocaleNumber(n: number, locale: string): string {
  const tag = locale.toLowerCase().startsWith("ar") ? "ar-SA" : locale || "en";
  try {
    return new Intl.NumberFormat(tag, { useGrouping: false }).format(n);
  } catch {
    return String(n);
  }
}
