// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

import { useTranslation } from "react-i18next";

/** Centered brand mark for auth cards (locale-aware SVG). */
export function AuthBrandHeader({
  subtitle,
  subtitleClassName = "mt-3",
}: {
  subtitle: string;
  /** Gap between logo and subtitle. */
  subtitleClassName?: string;
}) {
  const { t, i18n } = useTranslation();
  const localeBase = (i18n.language || "ar").split("-")[0] ?? "ar";
  const logoSrc = localeBase === "ar" ? "/logo-ar.svg" : "/logo.svg";

  return (
    <div className="text-center">
      <img
        src={logoSrc}
        alt={t("common.appName")}
        decoding="async"
        className="mx-auto h-10 w-auto max-w-[min(100%,14rem)] object-contain sm:h-12"
      />
      <p className={`text-lg text-[var(--color-text-muted)] ${subtitleClassName}`}>{subtitle}</p>
    </div>
  );
}
