// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { getSurahNameWithArabic } from "../../lib/quranService";

export interface StudentReviewCardProps {
  count: number;
  latestSurah: number | null;
  reviewTo: string;
}

/** Compact “to review” card for open error annotations. Hidden when count is 0. */
export function StudentReviewCard({ count, latestSurah, reviewTo }: StudentReviewCardProps) {
  const { t, i18n } = useTranslation();
  if (count <= 0) return null;

  const loc = i18n.language === "ar" ? "ar" : i18n.language === "fr" ? "fr" : "en";
  const isRtl = (i18n.language || "ar").split("-")[0] === "ar";
  const Chevron = isRtl ? ChevronLeft : ChevronRight;
  const surahLabel = latestSurah != null ? getSurahNameWithArabic(latestSurah, loc) : null;

  return (
    <Link
      to={reviewTo}
      className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white px-4 py-3 shadow-sm transition hover:bg-[var(--color-bg)]"
      style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}
    >
      <div className="min-w-0">
        <p className="text-sm font-semibold text-[var(--color-text)]">{t("studentHome.reviewTitle")}</p>
        <p className="mt-0.5 text-sm">
          <span className="font-semibold" style={{ color: "#F57F17" }}>
            {t("studentHome.openCorrections", { count })}
          </span>
          {surahLabel ? (
            <span className="text-[var(--color-text-muted)]">
              {" · "}
              {t("studentHome.latestIn", { surah: surahLabel })}
            </span>
          ) : null}
        </p>
      </div>
      <Chevron className="size-5 shrink-0 text-[var(--color-text-muted)]" aria-hidden />
    </Link>
  );
}
