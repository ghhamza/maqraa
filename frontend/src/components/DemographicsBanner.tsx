// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

import { useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { UserRound, X } from "lucide-react";
import { useAuthStore } from "../stores/authStore";
import { Button } from "./ui/Button";

const DISMISS_KEY = "maqraa_demo_banner_dismissed";

function isDismissed(): boolean {
  try {
    return sessionStorage.getItem(DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

function setDismissed() {
  try {
    sessionStorage.setItem(DISMISS_KEY, "1");
  } catch {
    // ignore
  }
}

export function DemographicsBanner() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const [dismissed, setDismissedState] = useState(isDismissed);

  if (!user || dismissed) return null;

  const incomplete =
    user.gender == null || user.birth_year == null || user.country_code == null;
  if (!incomplete) return null;

  return (
    <div
      className="border-b border-[var(--color-primary)]/25 bg-[var(--color-primary)]/8 px-3 py-2.5 sm:px-4 md:px-6 lg:px-8"
      role="status"
    >
      <div className="mx-auto flex w-full max-w-7xl min-w-0 items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2 text-sm text-[var(--color-text)]">
          <UserRound className="h-4 w-4 shrink-0 text-[var(--color-primary)]" aria-hidden />
          <span className="truncate">{t("profile.demographics.banner")}</span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button type="button" variant="secondary" size="sm" asChild>
            <Link to="/profile">{t("profile.demographics.banner_cta")}</Link>
          </Button>
          <button
            type="button"
            onClick={() => {
              setDismissed();
              setDismissedState(true);
            }}
            className="rounded-md p-1 text-[var(--color-text-muted)] hover:bg-black/5 hover:text-[var(--color-text)]"
            aria-label={t("common.dismiss")}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
