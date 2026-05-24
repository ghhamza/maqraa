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
      className="w-full bg-[#1B5E20] text-white text-[13px] sm:text-sm py-2 px-4 flex items-center justify-center gap-2 text-center leading-snug"
    >
      <Sparkles className="w-4 h-4 text-[#D4A843] shrink-0" aria-hidden />
      <span>{t("common.preLaunchBanner")}</span>
    </div>
  );
}
