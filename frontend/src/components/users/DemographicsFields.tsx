// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { getGroupedCountries } from "../../data/countries";
import { intlLocaleForAppLanguage } from "../../lib/intlLocale";
import { birthYearOptions } from "../../lib/profileDetails";
import { cn } from "@/lib/utils";

export type DemographicsGender = "male" | "female";

export interface DemographicsValue {
  gender: DemographicsGender | null;
  birth_year: number | null;
  country_code: string | null;
}

export interface DemographicsFieldsProps {
  value: DemographicsValue;
  onChange: (next: DemographicsValue) => void;
  /** When true, mark controls as required (UI only; parent still validates). */
  required?: boolean;
  className?: string;
}

export function emptyDemographics(): DemographicsValue {
  return { gender: null, birth_year: null, country_code: null };
}

export function demographicsFromUser(user: {
  gender?: string | null;
  birth_year?: number | null;
  country_code?: string | null;
  country?: string | null;
} | null): DemographicsValue {
  const gender =
    user?.gender === "male" || user?.gender === "female" ? user.gender : null;
  const country =
    user?.country_code?.trim().toUpperCase() ||
    user?.country?.trim().toUpperCase() ||
    null;
  return {
    gender,
    birth_year: typeof user?.birth_year === "number" ? user.birth_year : null,
    country_code: country && /^[A-Z]{2}$/.test(country) ? country : null,
  };
}

/** Payload fields suitable for API bodies (omits nulls when `omitEmpty`). */
export function demographicsPayload(
  value: DemographicsValue,
  opts?: { omitEmpty?: boolean },
): {
  gender?: DemographicsGender | null;
  birth_year?: number | null;
  country_code?: string | null;
} {
  if (opts?.omitEmpty) {
    return {
      ...(value.gender ? { gender: value.gender } : {}),
      ...(value.birth_year != null ? { birth_year: value.birth_year } : {}),
      ...(value.country_code ? { country_code: value.country_code } : {}),
    };
  }
  return {
    gender: value.gender,
    birth_year: value.birth_year,
    country_code: value.country_code,
  };
}

export function DemographicsFields({
  value,
  onChange,
  required = false,
  className,
}: DemographicsFieldsProps) {
  const { t, i18n } = useTranslation();
  const locale = intlLocaleForAppLanguage(i18n.language);
  const years = useMemo(() => birthYearOptions(), []);
  const { priority, rest } = useMemo(() => getGroupedCountries(locale), [locale]);

  function patch(partial: Partial<DemographicsValue>) {
    onChange({ ...value, ...partial });
  }

  const selectClass =
    "w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-[var(--color-text)]";

  return (
    <div className={cn("space-y-4", className)}>
      <fieldset>
        <legend className="mb-2 block text-sm font-medium text-[var(--color-text)]">
          {t("profile.demographics.gender")}
          {!required ? (
            <span className="ms-2 text-xs font-normal text-[var(--color-text-muted)]">
              ({t("profile.demographics.optional")})
            </span>
          ) : null}
        </legend>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-required={required}>
          {(["male", "female"] as const).map((g) => (
            <button
              key={g}
              type="button"
              role="radio"
              aria-checked={value.gender === g}
              onClick={() => patch({ gender: value.gender === g && !required ? null : g })}
              className={cn(
                "rounded-full border px-4 py-2 text-sm font-medium transition",
                value.gender === g
                  ? "border-[var(--color-primary)] bg-[var(--color-primary)] text-white"
                  : "border-gray-200 bg-white text-[var(--color-text)] hover:border-[var(--color-primary)]/40",
              )}
            >
              {t(
                g === "male"
                  ? "profile.demographics.gender_male"
                  : "profile.demographics.gender_female",
              )}
            </button>
          ))}
        </div>
      </fieldset>

      <div>
        <label htmlFor="demo-birth-year" className="mb-1 block text-sm font-medium text-[var(--color-text)]">
          {t("profile.demographics.birth_year")}
          {!required ? (
            <span className="ms-2 text-xs font-normal text-[var(--color-text-muted)]">
              ({t("profile.demographics.optional")})
            </span>
          ) : null}
        </label>
        <select
          id="demo-birth-year"
          className={selectClass}
          value={value.birth_year ?? ""}
          required={required}
          onChange={(e) => {
            const raw = e.target.value;
            patch({ birth_year: raw ? Number(raw) : null });
          }}
        >
          <option value="">{t("profile.demographics.select_placeholder")}</option>
          {years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="demo-country" className="mb-1 block text-sm font-medium text-[var(--color-text)]">
          {t("profile.demographics.country")}
          {!required ? (
            <span className="ms-2 text-xs font-normal text-[var(--color-text-muted)]">
              ({t("profile.demographics.optional")})
            </span>
          ) : null}
        </label>
        <select
          id="demo-country"
          className={selectClass}
          value={value.country_code ?? ""}
          required={required}
          onChange={(e) => {
            const raw = e.target.value;
            patch({ country_code: raw || null });
          }}
        >
          <option value="">{t("profile.demographics.select_placeholder")}</option>
          <optgroup label={t("profile.demographics.country_group_priority")}>
            {priority.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name} ({c.code})
              </option>
            ))}
          </optgroup>
          <optgroup label={t("profile.demographics.country_group_other")}>
            {rest.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name} ({c.code})
              </option>
            ))}
          </optgroup>
        </select>
      </div>
    </div>
  );
}
