// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { FormSelect } from "../ui/select";
import { listTimezoneOptions, tzCityLabel } from "../../lib/sessionTime";

export interface TimezoneSelectProps {
  value: string;
  onChange: (tz: string) => void;
  id?: string;
  required?: boolean;
  showDetectedHint?: boolean;
}

export function TimezoneSelect({
  value,
  onChange,
  id = "timezone",
  required,
  showDetectedHint = false,
}: TimezoneSelectProps) {
  const { t, i18n } = useTranslation();
  const options = useMemo(() => {
    return listTimezoneOptions().map((tz) => ({
      value: tz,
      label: `${tzCityLabel(tz, i18n.language)} (${tz})`,
    }));
  }, [i18n.language]);

  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-[var(--color-text)]">
        {t("tz.timezoneLabel")}
      </label>
      <FormSelect
        id={id}
        triggerClassName="w-full rounded-xl border border-gray-200 bg-[var(--color-surface)] py-2.5 text-start focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
        triggerStyle={{ color: "var(--color-text)" }}
        value={value}
        onValueChange={onChange}
        required={required}
        options={options}
      />
      {showDetectedHint ? (
        <p className="mt-1.5 text-xs text-[var(--color-text-muted)]">{t("tz.detected")}</p>
      ) : null}
    </div>
  );
}
