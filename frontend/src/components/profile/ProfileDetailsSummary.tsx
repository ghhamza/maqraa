// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

import type { ReactNode } from "react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Badge } from "../ui/Badge";
import { getCountryName, normalizeCountryCode } from "../../data/countries";
import { QIRAAT_OPTIONS } from "../../data/qiraat";
import type { SpokenLanguageCode } from "../../data/languages";
import { intlLocaleForAppLanguage } from "../../lib/intlLocale";
import { useLocaleDate } from "../../hooks/useLocaleDate";
import type { UserPublic } from "../../types";

interface ProfileDetailsSummaryProps {
  user: UserPublic;
}

function DetailRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="grid gap-1 sm:grid-cols-[minmax(0,11rem)_1fr] sm:gap-4 sm:py-2">
      <dt className="text-sm font-medium text-[var(--color-text-muted)]">{label}</dt>
      <dd className="text-sm text-[var(--color-text)]">{value}</dd>
    </div>
  );
}

export function ProfileDetailsSummary({ user }: ProfileDetailsSummaryProps) {
  const { t, i18n } = useTranslation();
  const { medium } = useLocaleDate();
  const locale = intlLocaleForAppLanguage(i18n.language);
  const notProvided = t("users.notProvided");

  const countryLabel = useMemo(() => {
    if (!user.country) return notProvided;
    const code = normalizeCountryCode(user.country);
    return `${getCountryName(code, locale)} (${code})`;
  }, [user.country, locale, notProvided]);

  const genderLabel =
    user.gender === "male"
      ? t("profile.male")
      : user.gender === "female"
        ? t("profile.female")
        : notProvided;

  const dobLabel = user.date_of_birth
    ? medium(`${user.date_of_birth.slice(0, 10)}T12:00:00`)
    : notProvided;

  const qiraatLabels = useMemo(() => {
    const bySlug = new Map<string, string>(QIRAAT_OPTIONS.map((q) => [q.slug, q.ar]));
    return user.qiraat_taught.map((slug) => bySlug.get(slug) ?? slug);
  }, [user.qiraat_taught]);

  return (
    <dl className="divide-y divide-gray-100">
      <DetailRow label={t("profile.gender")} value={genderLabel} />
      <DetailRow label={t("profile.dateOfBirth")} value={dobLabel} />
      <DetailRow label={t("profile.country")} value={countryLabel} />
      <DetailRow label={t("profile.phone")} value={user.phone?.trim() || notProvided} />
      <DetailRow
        label={t("profile.languages")}
        value={
          user.spoken_languages.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {user.spoken_languages.map((code) => (
                <Badge key={code} variant="green">
                  {t(`profile.lang.${code as SpokenLanguageCode}`, { defaultValue: code })}
                </Badge>
              ))}
            </div>
          ) : (
            notProvided
          )
        }
      />
      {user.role === "teacher" ? (
        <DetailRow
          label={t("profile.qiraat")}
          value={
            qiraatLabels.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {qiraatLabels.map((label) => (
                  <Badge key={label} variant="blue">
                    {label}
                  </Badge>
                ))}
              </div>
            ) : (
              notProvided
            )
          }
        />
      ) : null}
      <DetailRow
        label={t("users.profileStatus")}
        value={
          user.profile_completion_pending ? (
            <Badge variant="gold">{t("users.profileIncomplete")}</Badge>
          ) : (
            <Badge variant="green">{t("users.profileComplete")}</Badge>
          )
        }
      />
    </dl>
  );
}
