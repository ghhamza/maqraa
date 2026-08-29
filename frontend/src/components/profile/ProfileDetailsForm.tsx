// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { FormSelect } from "../ui/select";
import { getSortedCountries } from "../../data/countries";
import {
  composePhoneNumber,
  getDialCode,
  splitPhoneLocalPart,
} from "../../data/dialCodes";
import { SPOKEN_LANGUAGE_CODES } from "../../data/languages";
import { QIRAAT_OPTIONS, QIRAAT_VISIBLE_COUNT } from "../../data/qiraat";
import { cn } from "@/lib/utils";
import { intlLocaleForAppLanguage } from "../../lib/intlLocale";
import type { User } from "../../types";
import {
  birthYearOptions,
  profileDetailsFromUser,
  toggleProfileListItem,
  type ProfileDetailsValues,
  validateProfileDetails,
} from "../../lib/profileDetails";

interface ProfileDetailsFormProps {
  user: User;
  fieldErrors: Record<string, string>;
  values: ProfileDetailsValues;
  onChange: (values: ProfileDetailsValues) => void;
}

function hasCollapsedQiraatSelection(selected: readonly string[]): boolean {
  const collapsed = new Set<string>(
    QIRAAT_OPTIONS.slice(QIRAAT_VISIBLE_COUNT).map((q) => q.slug),
  );
  return selected.some((slug) => collapsed.has(slug));
}

export function ProfileDetailsForm({
  user,
  fieldErrors,
  values,
  onChange,
}: ProfileDetailsFormProps) {
  const { t, i18n } = useTranslation();
  const locale = intlLocaleForAppLanguage(i18n.language);
  const isTeacher = user.role === "teacher";
  const years = useMemo(() => birthYearOptions(), []);
  const [qiraatExpanded, setQiraatExpanded] = useState(() =>
    hasCollapsedQiraatSelection(values.qiraatTaught),
  );

  const countries = useMemo(() => getSortedCountries(locale), [locale]);
  const visibleQiraat = useMemo(
    () =>
      qiraatExpanded ? QIRAAT_OPTIONS : QIRAAT_OPTIONS.slice(0, QIRAAT_VISIBLE_COUNT),
    [qiraatExpanded],
  );
  const hiddenQiraatCount = QIRAAT_OPTIONS.length - QIRAAT_VISIBLE_COUNT;

  const dialCode = getDialCode(values.country);
  const localPhone = splitPhoneLocalPart(values.phone, values.country);

  function patch(partial: Partial<ProfileDetailsValues>) {
    onChange({ ...values, ...partial });
  }

  function handleCountryChange(country: string) {
    const local = splitPhoneLocalPart(values.phone, values.country);
    patch({ country, phone: composePhoneNumber(country, local) });
  }

  function handleLocalPhoneChange(local: string) {
    patch({ phone: composePhoneNumber(values.country, local) });
  }

  return (
    <div className="space-y-5">
      <fieldset>
        <legend className="mb-2 block text-sm font-medium text-[var(--color-text)]">
          {t("profile.gender")}
        </legend>
        <div className="flex flex-wrap gap-2">
          {(["male", "female"] as const).map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => patch({ gender: g })}
              className={cn(
                "rounded-full border px-4 py-2 text-sm font-medium transition",
                values.gender === g
                  ? "border-[var(--color-primary)] bg-[var(--color-primary)] text-white"
                  : "border-gray-200 bg-white text-[var(--color-text)] hover:border-[var(--color-primary)]/40",
              )}
            >
              {t(g === "male" ? "profile.male" : "profile.female")}
            </button>
          ))}
        </div>
        {fieldErrors.gender ? <p className="mt-1 text-sm text-red-600">{fieldErrors.gender}</p> : null}
      </fieldset>

      <div>
        <label htmlFor="profile-birth-year" className="mb-1 block text-sm font-medium text-[var(--color-text)]">
          {t("profile.dateOfBirth")}
        </label>
        <select
          id="profile-birth-year"
          value={values.birthYear ?? ""}
          onChange={(e) => {
            const raw = e.target.value;
            patch({ birthYear: raw ? Number(raw) : null });
          }}
          className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-[var(--color-text)]"
        >
          <option value="">{t("profile.demographics.select_placeholder")}</option>
          {years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
        {fieldErrors.birthYear ? (
          <p className="mt-1 text-sm text-red-600">{fieldErrors.birthYear}</p>
        ) : null}
      </div>

      <div>
        <label htmlFor="profile-country" className="mb-1 block text-sm font-medium text-[var(--color-text)]">
          {t("profile.country")}
        </label>
        <FormSelect
          id="profile-country"
          triggerClassName="w-full rounded-xl border border-gray-200 bg-white py-2.5 text-start"
          value={values.country}
          onValueChange={handleCountryChange}
          options={countries.map((c) => ({
            value: c.code,
            label: `${c.name} (${c.code})`,
          }))}
        />
        {fieldErrors.country ? <p className="mt-1 text-sm text-red-600">{fieldErrors.country}</p> : null}
      </div>

      <div>
        <label htmlFor="profile-phone" className="mb-1 block text-sm font-medium text-[var(--color-text)]">
          {t("profile.phone")}
        </label>
        <div className="flex gap-2" dir="ltr">
          <div
            className="flex shrink-0 items-center rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm font-medium text-[var(--color-text)]"
            aria-hidden
          >
            {dialCode}
          </div>
          <input
            id="profile-phone"
            name="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel-national"
            value={localPhone}
            onChange={(e) => handleLocalPhoneChange(e.target.value)}
            placeholder="500000000"
            className="min-w-0 flex-1 rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-start text-sm text-[var(--color-text)]"
          />
        </div>
        {fieldErrors.phone ? <p className="mt-1 text-sm text-red-600">{fieldErrors.phone}</p> : null}
      </div>

      <fieldset>
        <legend className="mb-2 block text-sm font-medium text-[var(--color-text)]">
          {t("profile.languages")}
        </legend>
        <div className="flex flex-wrap gap-2">
          {SPOKEN_LANGUAGE_CODES.map((code) => {
            const selected = values.spokenLanguages.includes(code);
            return (
              <button
                key={code}
                type="button"
                onClick={() =>
                  patch({
                    spokenLanguages: toggleProfileListItem(values.spokenLanguages, code),
                  })
                }
                className={cn(
                  "rounded-full border px-3 py-1.5 text-sm font-medium transition",
                  selected
                    ? "border-[var(--color-primary)] bg-[var(--color-primary)] text-white"
                    : "border-gray-200 bg-white text-[var(--color-text)]",
                )}
              >
                {t(`profile.lang.${code}`)}
              </button>
            );
          })}
        </div>
        {fieldErrors.languages ? (
          <p className="mt-1 text-sm text-red-600">{fieldErrors.languages}</p>
        ) : null}
      </fieldset>

      {isTeacher ? (
        <fieldset>
          <legend className="mb-2 block text-sm font-medium text-[var(--color-text)]">
            {t("profile.qiraat.title")}
          </legend>
          <div className="flex flex-wrap gap-2 rounded-xl border border-gray-100 p-3">
            {visibleQiraat.map(({ slug, ar }) => {
              const selected = values.qiraatTaught.includes(slug);
              return (
                <button
                  key={slug}
                  type="button"
                  onClick={() =>
                    patch({
                      qiraatTaught: toggleProfileListItem(values.qiraatTaught, slug),
                    })
                  }
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-sm font-medium transition",
                    selected
                      ? "border-[#1B5E20] bg-[#1B5E20] text-white"
                      : "border-gray-200 bg-white text-[#6B7280]",
                  )}
                >
                  {ar}
                </button>
              );
            })}
          </div>
          {hiddenQiraatCount > 0 ? (
            <button
              type="button"
              onClick={() => setQiraatExpanded((open) => !open)}
              className="mt-2 text-sm font-medium text-[#1B5E20] hover:underline"
            >
              {qiraatExpanded
                ? t("profile.qiraat.showLess")
                : t("profile.qiraat.showMore", { count: hiddenQiraatCount })}
            </button>
          ) : null}
          {fieldErrors.qiraat ? (
            <p className="mt-1 text-sm text-red-600">{fieldErrors.qiraat}</p>
          ) : null}
        </fieldset>
      ) : null}
    </div>
  );
}

/** Hook: profile details state synced from the auth user. */
export function useProfileDetailsState(user: User | null) {
  const [values, setValues] = useState<ProfileDetailsValues>(() => profileDetailsFromUser(user));
  const userId = user?.id ?? null;

  useEffect(() => {
    setValues(profileDetailsFromUser(user));
    // Re-hydrate when the signed-in user identity changes — not on every user object reference.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: only reset on user id change
  }, [userId]);

  return [values, setValues] as const;
}

export function useProfileDetailsValidation(user: User | null, values: ProfileDetailsValues) {
  const { t } = useTranslation();
  const isTeacher = user?.role === "teacher";

  function validate(): Record<string, string> {
    if (!user) return { form: t("profile.errRequired") };
    return validateProfileDetails(values, isTeacher ?? false, t);
  }

  return { validate, isTeacher: Boolean(isTeacher) };
}
