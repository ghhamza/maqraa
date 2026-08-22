// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

import { cn } from "@/lib/utils";
import { palette } from "./charts/chartTheme";

export interface KpiCardProps {
  label: string;
  value: string | number;
  delta?: string | null;
  /** When true, delta uses primary green; when false, muted. Omit for muted default. */
  deltaPositive?: boolean;
  className?: string;
}

/** Standalone KPI card — own surface, border, radius (matches PageCard). */
export function KpiCard({
  label,
  value,
  delta,
  deltaPositive,
  className,
}: KpiCardProps) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-gray-100 bg-[var(--color-surface)] p-4 shadow-sm sm:p-5",
        className,
      )}
    >
      <p className="text-sm text-[var(--color-text-muted)]">{label}</p>
      <p
        className={cn(
          "mt-1 text-3xl font-semibold tabular-nums",
          value === "—" ? "text-[var(--color-text-muted)]" : "text-[var(--color-text)]",
        )}
      >
        {value}
      </p>
      {delta != null && delta !== "" ? (
        <p
          className="mt-1 text-xs font-medium"
          style={{
            color: deltaPositive === true ? palette.primary : palette.muted,
          }}
        >
          {delta}
        </p>
      ) : null}
    </div>
  );
}
