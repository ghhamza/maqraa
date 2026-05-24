// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

import { useTranslation } from "react-i18next";
import { Sparkles } from "lucide-react";

export function PreLaunchBanner() {
  const { t } = useTranslation();
  return (
    <div
      role="status"
      aria-live="polite"
      className="sticky top-0 z-[45] w-full min-h-[var(--pre-launch-banner-height)] shrink-0 bg-[#1B5E20] text-white text-[19px] sm:text-[21px] py-3 px-6 flex items-center justify-center gap-3 text-center leading-snug"
    >
      <Sparkles className="w-6 h-6 text-[#D4A843] shrink-0" aria-hidden />
      <span>{t("common.preLaunchBanner")}</span>
    </div>
  );
}
