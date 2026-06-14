// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

import type { User } from "../types";
import type { QiraatSlug } from "../data/qiraat";
import type { SpokenLanguageCode } from "../data/languages";
import { normalizeCountryCode } from "../data/countries";
import { composePhoneNumber, getDialCode, splitPhoneLocalPart } from "../data/dialCodes";

export type ProfileGender = "male" | "female";

export interface ProfileDetailsValues {
  gender: ProfileGender | "";
  dateOfBirth: string;
  country: string;
  phone: string;
  spokenLanguages: SpokenLanguageCode[];
  qiraatTaught: QiraatSlug[];
}

export function todayIsoDate(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function toggleProfileListItem<T extends string>(list: T[], item: T): T[] {
  return list.includes(item) ? list.filter((x) => x !== item) : [...list, item];
}

export function validateProfilePhone(value: string): boolean {
  if (!value.startsWith("+")) return false;
  const digits = value.replace(/\D/g, "");
  return digits.length >= 8 && digits.length <= 16;
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
    dateOfBirth: user?.date_of_birth?.slice(0, 10) ?? "",
    country,
    phone,
    spokenLanguages: (user?.spoken_languages ?? []).filter((c): c is SpokenLanguageCode =>
      ["ar", "en", "fr", "id", "ru"].includes(c),
    ),
    qiraatTaught: (user?.qiraat_taught ?? []) as QiraatSlug[],
  };
}

export function normalizeUserFromApi(data: User): User {
  return {
    ...data,
    qf_linked: Boolean(data.qf_linked),
    qf_email: data.qf_email ?? null,
    role_selection_pending: Boolean(data.role_selection_pending),
    profile_completion_pending: Boolean(data.profile_completion_pending),
    gender: data.gender === "male" || data.gender === "female" ? data.gender : null,
    date_of_birth: data.date_of_birth ?? null,
    country: data.country ?? null,
    phone: data.phone ?? null,
    spoken_languages: data.spoken_languages ?? [],
    qiraat_taught: data.qiraat_taught ?? [],
  };
}

export function validateProfileDetails(
  values: ProfileDetailsValues,
  isTeacher: boolean,
  t: (key: string) => string,
): Record<string, string> {
  const next: Record<string, string> = {};
  const maxDob = todayIsoDate();

  if (!values.gender) next.gender = t("profile.errRequired");
  if (!values.dateOfBirth) {
    next.dateOfBirth = t("profile.errRequired");
  } else {
    const dob = new Date(`${values.dateOfBirth}T12:00:00`);
    const min = new Date("1900-01-01T12:00:00");
    const max = new Date(`${maxDob}T23:59:59`);
    if (Number.isNaN(dob.getTime()) || dob < min || dob > max) {
      next.dateOfBirth = t("profile.errDob");
    }
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
  return {
    gender: values.gender,
    date_of_birth: values.dateOfBirth,
    country: values.country,
    phone: values.phone.trim(),
    spoken_languages: values.spokenLanguages,
    qiraat_taught: isTeacher ? values.qiraatTaught : [],
  };
}
