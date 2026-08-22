// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

/** Excluded from selectable countries (ISO alpha-2). */
const EXCLUDED_COUNTRY_CODES = new Set(["IL"]);

/** ISO-3166 alpha-2 codes (UN member states and common territories). */
const FALLBACK_COUNTRY_CODES = [
  "AD", "AE", "AF", "AG", "AI", "AL", "AM", "AO", "AQ", "AR", "AS", "AT", "AU", "AW", "AX", "AZ",
  "BA", "BB", "BD", "BE", "BF", "BG", "BH", "BI", "BJ", "BL", "BM", "BN", "BO", "BQ", "BR", "BS",
  "BT", "BV", "BW", "BY", "BZ", "CA", "CC", "CD", "CF", "CG", "CH", "CI", "CK", "CL", "CM", "CN",
  "CO", "CR", "CU", "CV", "CW", "CX", "CY", "CZ", "DE", "DJ", "DK", "DM", "DO", "DZ", "EC", "EE",
  "EG", "EH", "ER", "ES", "ET", "FI", "FJ", "FK", "FM", "FO", "FR", "GA", "GB", "GD", "GE", "GF",
  "GG", "GH", "GI", "GL", "GM", "GN", "GP", "GQ", "GR", "GS", "GT", "GU", "GW", "GY", "HK", "HM",
  "HN", "HR", "HT", "HU", "ID", "IE", "IM", "IN", "IO", "IQ", "IR", "IS", "IT", "JE", "JM",
  "JO", "JP", "KE", "KG", "KH", "KI", "KM", "KN", "KP", "KR", "KW", "KY", "KZ", "LA", "LB", "LC",
  "LI", "LK", "LR", "LS", "LT", "LU", "LV", "LY", "MA", "MC", "MD", "ME", "MF", "MG", "MH", "MK",
  "ML", "MM", "MN", "MO", "MP", "MQ", "MR", "MS", "MT", "MU", "MV", "MW", "MX", "MY", "MZ", "NA",
  "NC", "NE", "NF", "NG", "NI", "NL", "NO", "NP", "NR", "NU", "NZ", "OM", "PA", "PE", "PF", "PG",
  "PH", "PK", "PL", "PM", "PN", "PR", "PS", "PT", "PW", "PY", "QA", "RE", "RO", "RS", "RU", "RW",
  "SA", "SB", "SC", "SD", "SE", "SG", "SH", "SI", "SJ", "SK", "SL", "SM", "SN", "SO", "SR", "SS",
  "ST", "SV", "SX", "SY", "SZ", "TC", "TD", "TF", "TG", "TH", "TJ", "TK", "TL", "TM", "TN", "TO",
  "TR", "TT", "TV", "TW", "TZ", "UA", "UG", "UM", "US", "UY", "UZ", "VA", "VC", "VE", "VG", "VI",
  "VN", "VU", "WF", "WS", "YE", "YT", "ZA", "ZM", "ZW",
] as const;

function detectCountryCodes(): readonly string[] {
  try {
    const intl = Intl as typeof Intl & { supportedValuesOf?: (key: string) => string[] };
    if (typeof intl.supportedValuesOf === "function") {
      const values = intl.supportedValuesOf("region").filter(
        (code) =>
          code.length === 2 &&
          /^[A-Z]{2}$/.test(code) &&
          !EXCLUDED_COUNTRY_CODES.has(code),
      );
      if (values.length > 0) return values.includes("PS") ? values : [...values, "PS"];
    }
  } catch {
    // fall through
  }
  return FALLBACK_COUNTRY_CODES;
}

/** Map legacy/disallowed codes to the supported equivalent. */
export function normalizeCountryCode(code: string): string {
  const upper = code.trim().toUpperCase();
  if (upper === "IL") return "PS";
  return upper;
}

export const ISO_COUNTRY_CODES = detectCountryCodes();

export function getCountryName(code: string, locale: string): string {
  try {
    const display = new Intl.DisplayNames([locale], { type: "region" });
    return display.of(code) ?? code;
  } catch {
    return code;
  }
}

export function getSortedCountries(locale: string): { code: string; name: string }[] {
  return ISO_COUNTRY_CODES.map((code) => ({
    code,
    name: getCountryName(code, locale),
  })).sort((a, b) => a.name.localeCompare(b.name, locale));
}

/** Priority regions: Arab world + Maghreb + ID/PK/TR (+ common diaspora hubs). */
const PRIORITY_COUNTRY_CODES = [
  "SA", "AE", "BH", "KW", "OM", "QA", "YE",
  "EG", "SD", "LY", "TN", "DZ", "MA", "MR",
  "IQ", "JO", "LB", "SY", "PS",
  "DJ", "SO", "KM",
  "ID", "PK", "TR", "BD", "MY",
] as const;

/**
 * Countries split into a priority optgroup (Arab/Maghreb/ID/PK/TR) then the rest,
 * each sorted by localized display name.
 */
export function getGroupedCountries(locale: string): {
  priority: { code: string; name: string }[];
  rest: { code: string; name: string }[];
} {
  const prioritySet = new Set<string>(PRIORITY_COUNTRY_CODES);
  const all = getSortedCountries(locale);
  const priorityOrder = new Map(
    PRIORITY_COUNTRY_CODES.map((code, i) => [code, i] as const),
  );
  const priority = all
    .filter((c) => prioritySet.has(c.code))
    .sort(
      (a, b) =>
        (priorityOrder.get(a.code) ?? 999) - (priorityOrder.get(b.code) ?? 999),
    );
  const rest = all.filter((c) => !prioritySet.has(c.code));
  return { priority, rest };
}
