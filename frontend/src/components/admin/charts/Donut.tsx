// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { useTranslation } from "react-i18next";
import { ChartTooltip } from "./ChartTooltip";
import { chartFont, colorForKey, formatLatinNumber } from "./chartTheme";

export interface DonutSlice {
  key: string;
  name: string;
  value: number;
}

interface DonutProps {
  data: DonutSlice[];
  height?: number;
  /** Override colors by key (e.g. gender male/female). */
  colorMap?: Record<string, string>;
}

export function Donut({ data, height = 140, colorMap }: DonutProps) {
  const { t } = useTranslation();
  const total = data.reduce((s, d) => s + d.value, 0);
  const colored = data.map((d, i) => ({
    ...d,
    color: colorMap?.[d.key] ?? colorForKey(d.key, i),
  }));

  if (total === 0) {
    return (
      <div
        className="flex items-center justify-center text-sm text-[var(--color-text-muted)]"
        style={{ height, fontFamily: chartFont }}
      >
        {t("admin.dashboard.empty")}
      </div>
    );
  }

  return (
    <div
      className="flex min-w-0 items-center justify-center gap-4"
      style={{ fontFamily: chartFont, height }}
    >
      <div className="relative shrink-0" style={{ width: height, height }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={colored}
              dataKey="value"
              nameKey="name"
              innerRadius="62%"
              outerRadius="85%"
              paddingAngle={2}
              stroke="none"
            >
              {colored.map((d) => (
                <Cell key={d.key} fill={d.color} />
              ))}
            </Pie>
            <Tooltip content={<ChartTooltip />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-lg font-semibold tabular-nums text-[var(--color-text)]">
            {formatLatinNumber(total, 0)}
          </span>
          <span className="text-[10px] text-[var(--color-text-muted)]">{t("admin.dashboard.total")}</span>
        </div>
      </div>
      <ul className="min-w-0 max-w-[12rem] space-y-1.5 text-xs">
        {colored.map((d) => {
          const pct = total > 0 ? Math.round((d.value / total) * 100) : 0;
          return (
            <li key={d.key} className="flex min-w-0 items-center gap-2">
              <span
                className="size-2.5 shrink-0 rounded-sm"
                style={{ background: d.color }}
                aria-hidden
              />
              <span className="min-w-0 flex-1 truncate text-[var(--color-text)]">{d.name}</span>
              <span className="shrink-0 tabular-nums text-[var(--color-text-muted)]">
                {formatLatinNumber(d.value, 0)} · {pct}%
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
