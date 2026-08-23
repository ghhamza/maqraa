// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

import { useTranslation } from "react-i18next";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "./Button";
import { cn } from "@/lib/utils";

export interface ListPaginationProps {
  total: number;
  limit: number;
  offset: number;
  onOffsetChange: (offset: number) => void;
  className?: string;
  /** Disable while a fetch is in flight. */
  disabled?: boolean;
}

/** Compact server-side pager: "Showing X–Y of Z" + prev/next. */
export function ListPagination({
  total,
  limit,
  offset,
  onOffsetChange,
  className,
  disabled = false,
}: ListPaginationProps) {
  const { t } = useTranslation();

  if (total <= 0 || limit <= 0) return null;

  const from = offset + 1;
  const to = Math.min(offset + limit, total);
  const canPrev = offset > 0 && !disabled;
  const canNext = offset + limit < total && !disabled;

  return (
    <div
      className={cn(
        "flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
    >
      <p className="text-sm text-[var(--color-text-muted)]">
        {t("common.pagination.showing", { from, to, total })}
      </p>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!canPrev}
          aria-label={t("common.pagination.previous")}
          onClick={() => onOffsetChange(Math.max(0, offset - limit))}
        >
          <ChevronLeft className="size-4 rtl:rotate-180" aria-hidden />
          <span className="hidden sm:inline">{t("common.pagination.previous")}</span>
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!canNext}
          aria-label={t("common.pagination.next")}
          onClick={() => onOffsetChange(offset + limit)}
        >
          <span className="hidden sm:inline">{t("common.pagination.next")}</span>
          <ChevronRight className="size-4 rtl:rotate-180" aria-hidden />
        </Button>
      </div>
    </div>
  );
}
