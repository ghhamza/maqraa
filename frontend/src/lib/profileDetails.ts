// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

import type { User, UserPublic } from "../types";
import type { QiraatSlug } from "../data/qiraat";
import type { SpokenLanguageCode } from "../data/languages";
import { normalizeCountryCode } from "../data/countries";
import { composePhoneNumber, getDialCode, splitPhoneLocalPart } from "../data/dialCodes";

export type ProfileGender = "male" | "female";

export interface ProfileDetailsValues {
  gender: ProfileGender | "";
  birthYear: number | null;
  country: string;
  phone: string;
  spokenLanguages: SpokenLanguageCode[];
  qiraatTaught: QiraatSlug[];
}

/** Shared year list for profile completion + optional demographics. */
export function birthYearOptions(): number[] {
  const current = new Date().getFullYear();
  const max = current - 5;
  const min = 1930;
  const years: number[] = [];
  for (let y = max; y >= min; y -= 1) years.push(y);
  return years;
}

export function toggleProfileListItem<T extends string>(list: T[], item: T): T[] {
  return list.includes(item) ? list.filter((x) => x !== item) : [...list, item];
}

export function validateProfilePhone(value: string): boolean {
  if (!value.startsWith("+")) return false;
  const digits = value.replace(/\D/g, "");
  return digits.length >= 8 && digits.length <= 16;
}

function birthYearFromUser(user: User | null): number | null {
  if (typeof user?.birth_year === "number") return user.birth_year;
  const fromDob = user?.date_of_birth?.slice(0, 4);
  if (fromDob && /^\d{4}$/.test(fromDob)) {
    const y = Number(fromDob);
    return Number.isFinite(y) ? y : null;
  }
  return null;
}

export function profileDetailsFromUser(user: User | null): ProfileDetailsValues {
  const country = normalizeCountryCode(user?.country ?? "SA");
  let phone = getDialCode(country);
  if (user?.phone != null) {
    if (user.country?.toUpperCase() === "IL") {
      const local = user.phone.replace(/\D/g, "").replace(/^972/, "");
      phone = composePhoneNumber("PS", local);
    } else {
      phone = composePhoneNumber(country, splitPhoneLocalPart(user.phone, country));
    }
  }
  return {
    gender: user?.gender === "male" || user?.gender === "female" ? user.gender : "",
    birthYear: birthYearFromUser(user),
    country,
    phone,
    spokenLanguages: (user?.spoken_languages ?? []).filter((c): c is SpokenLanguageCode =>
      ["ar", "en", "fr", "id", "ru"].includes(c),
    ),
    qiraatTaught: (user?.qiraat_taught ?? []) as QiraatSlug[],
  };
}

export function normalizeUserFromApi(data: User): User {
  const countryCode =
    (typeof data.country_code === "string" && data.country_code.trim()) ||
    (typeof data.country === "string" && data.country.trim()) ||
    null;
  return {
    ...data,
    profile_completion_pending: Boolean(data.profile_completion_pending),
    gender: data.gender === "male" || data.gender === "female" ? data.gender : null,
    date_of_birth: data.date_of_birth ?? null,
    country: data.country ?? null,
    birth_year: typeof data.birth_year === "number" ? data.birth_year : null,
    country_code: countryCode ? countryCode.toUpperCase() : null,
    phone: data.phone ?? null,
    spoken_languages: data.spoken_languages ?? [],
    qiraat_taught: data.qiraat_taught ?? [],
    email_verified: Boolean(data.email_verified),
    preferred_language: data.preferred_language ?? "ar",
    has_password: data.has_password !== false,
    timezone: typeof data.timezone === "string" && data.timezone.trim() ? data.timezone.trim() : null,
  };
}

export function normalizeUserPublic(data: UserPublic): UserPublic {
  return {
    ...normalizeUserFromApi(data),
    created_at: data.created_at,
  };
}

export function validateProfileDetails(
  values: ProfileDetailsValues,
  isTeacher: boolean,
  t: (key: string) => string,
): Record<string, string> {
  const next: Record<string, string> = {};
  const allowedYears = new Set(birthYearOptions());

  if (!values.gender) next.gender = t("profile.errRequired");
  if (values.birthYear == null) {
    next.birthYear = t("profile.errRequired");
  } else if (!allowedYears.has(values.birthYear)) {
    next.birthYear = t("profile.errDob");
  }
  if (!values.country) next.country = t("profile.errRequired");
  if (!values.phone.trim() || !validateProfilePhone(values.phone.trim())) {
    next.phone = t("profile.errRequired");
  }
  if (values.spokenLanguages.length === 0) next.languages = t("profile.errLanguages");
  if (isTeacher && values.qiraatTaught.length === 0) next.qiraat = t("profile.errQiraat");

  return next;
}

export function profileDetailsPayload(values: ProfileDetailsValues, isTeacher: boolean) {
  const year = values.birthYear;
  return {
    gender: values.gender,
    birth_year: year,
    // Back-compat: older servers still require date_of_birth (year-only as Jan 1).
    ...(year != null ? { date_of_birth: `${year}-01-01` } : {}),
    country: values.country,
    phone: values.phone.trim(),
    spoken_languages: values.spokenLanguages,
    qiraat_taught: isTeacher ? values.qiraatTaught : [],
  };
}
