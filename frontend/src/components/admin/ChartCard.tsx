// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { PageCard } from "../layout/PageCard";
import { Skeleton } from "../ui/Skeleton";
import { cn } from "@/lib/utils";

interface ChartCardProps {
  title: string;
  children: ReactNode;
  empty?: boolean;
  loading?: boolean;
  className?: string;
  /** Tabs or other controls beside the title. */
  actions?: ReactNode;
  emptyHeight?: number;
}

export function ChartCard({
  title,
  children,
  empty,
  loading,
  className,
  actions,
  emptyHeight = 260,
}: ChartCardProps) {
  const { t } = useTranslation();

  return (
    <PageCard className={className}>
      <div className={cn("mb-3 flex flex-wrap items-center justify-between gap-3")}>
        <h3 className="text-lg font-semibold text-[var(--color-text)]">{title}</h3>
        {actions ? <div className="min-w-0 max-w-full">{actions}</div> : null}
      </div>
      {loading ? (
        <Skeleton className="w-full" style={{ height: emptyHeight }} />
      ) : empty ? (
        <div
          className="flex items-center justify-center text-sm text-[var(--color-text-muted)]"
          style={{ height: emptyHeight }}
        >
          {t("admin.dashboard.empty")}
        </div>
      ) : (
        children
      )}
    </PageCard>
  );
}
