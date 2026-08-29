// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

import { useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Sparkles, X } from "lucide-react";
import { Button } from "../ui/Button";
import {
  dismissDemoStrip,
  isDemoCompletedLocally,
  isDemoStripDismissed,
} from "../../lib/demoPrefs";

export interface DemoEntryProps {
  variant: "card" | "strip";
  /** Hide permanently when the teacher has ≥1 completed session. */
  hasCompletedSession: boolean;
}

/**
 * Demo tour entry — prominent card for fresh teachers, compact strip after
 * the first session. Hidden when dismissed, demo completed, or a session completed.
 */
export function DemoEntry({ variant, hasCompletedSession }: DemoEntryProps) {
  const { t } = useTranslation();
  const [dismissed, setDismissed] = useState(() => isDemoStripDismissed());

  if (dismissed || hasCompletedSession || isDemoCompletedLocally()) return null;

  function handleDismiss() {
    dismissDemoStrip();
    setDismissed(true);
  }

  const dismissBtn = (
    <button
      type="button"
      onClick={handleDismiss}
      className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-[#6B7280] transition hover:bg-gray-100 hover:text-[var(--color-text)]"
      aria-label={t("demo.stripDismiss")}
    >
      <X className="size-4" />
    </button>
  );

  if (variant === "card") {
    return (
      <section
        className="relative rounded-xl border border-gray-100 bg-[var(--color-surface)] px-4 py-3.5 shadow-sm sm:px-5 sm:py-4"
        style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 4px 16px rgba(27,94,32,0.06)" }}
      >
        {/* Physical reading-end corner: top-left in RTL, top-right in LTR */}
        <div className="absolute end-2 top-2 z-[1] sm:end-3 sm:top-3">{dismissBtn}</div>

        <div className="flex flex-col gap-3 pe-9 min-[380px]:flex-row min-[380px]:items-center min-[380px]:justify-between min-[380px]:gap-4 min-[380px]:pe-10">
          <div className="flex min-w-0 items-start gap-3">
            <Sparkles className="mt-0.5 size-5 shrink-0 text-[var(--color-gold)] sm:size-6" aria-hidden />
            <div className="min-w-0">
              <h2 className="font-[family-name:var(--font-heading)] text-base font-semibold leading-snug text-[var(--color-text)] sm:text-lg">
                {t("demo.entryTitle")}
              </h2>
              <p className="mt-0.5 text-sm leading-snug text-[var(--color-text-muted)]">
                {t("demo.entrySubtitle")}
              </p>
            </div>
          </div>
          <Button
            type="button"
            variant="secondary"
            size="default"
            className="w-full shrink-0 min-[380px]:w-auto"
            asChild
          >
            <Link to="/demo">{t("demo.stripCta")}</Link>
          </Button>
        </div>
      </section>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-gray-100 bg-[var(--color-surface)] px-4 py-3 shadow-sm">
      <Sparkles className="size-4 shrink-0 text-[var(--color-gold)]" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-[var(--color-text)]">{t("demo.stripTitle")}</p>
        <p className="text-xs text-[var(--color-text-muted)]">{t("demo.stripText")}</p>
      </div>
      <Button type="button" variant="secondary" size="sm" asChild>
        <Link to="/demo">{t("demo.stripCta")}</Link>
      </Button>
      {dismissBtn}
    </div>
  );
}
