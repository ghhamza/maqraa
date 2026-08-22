// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useTranslation } from "react-i18next";
import { ChartTooltip } from "./ChartTooltip";
import {
  axisTick,
  chartFont,
  colorForKey,
  palette,
  seriesColors,
  truncateLabel,
} from "./chartTheme";

export interface BarSeries {
  dataKey: string;
  name: string;
  color?: string;
}

export interface BarsProps {
  data: Record<string, string | number>[];
  /** Category axis field */
  categoryKey: string;
  series: BarSeries[];
  layout?: "vertical" | "horizontal";
  height?: number;
  /** Per-row fill when single series (e.g. grade colors). */
  cellColors?: string[];
  /** Full labels for truncated category ticks (keyed by truncated or raw category). */
  fullLabels?: Record<string, string>;
  isRtl?: boolean;
}

export function Bars({
  data,
  categoryKey,
  series,
  layout = "vertical",
  height = 260,
  cellColors,
  fullLabels,
  isRtl = false,
}: BarsProps) {
  const { t } = useTranslation();
  const empty = data.length === 0 || series.every((s) => data.every((row) => !Number(row[s.dataKey])));

  if (empty) {
    return (
      <div
        className="flex items-center justify-center text-sm text-[var(--color-text-muted)]"
        style={{ height, fontFamily: chartFont }}
      >
        {t("admin.dashboard.empty")}
      </div>
    );
  }

  const displayData = data.map((row) => {
    const raw = String(row[categoryKey] ?? "");
    const truncated = truncateLabel(raw, 18);
    return { ...row, [categoryKey]: truncated, __full: fullLabels?.[raw] ?? raw };
  });

  const horizontal = layout === "horizontal";

  return (
    <div style={{ width: "100%", height, fontFamily: chartFont }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={displayData}
          layout={horizontal ? "vertical" : "horizontal"}
          barSize={28}
          barCategoryGap="30%"
          margin={{ top: 8, right: 8, left: 4, bottom: 8 }}
        >
          <CartesianGrid vertical={false} stroke={palette.grid} />
          {horizontal ? (
            <>
              <XAxis
                type="number"
                allowDecimals={false}
                axisLine={false}
                tickLine={false}
                tick={axisTick}
                reversed={isRtl}
              />
              <YAxis
                type="category"
                dataKey={categoryKey}
                width={120}
                axisLine={false}
                tickLine={false}
                tick={axisTick}
              />
            </>
          ) : (
            <>
              <XAxis
                dataKey={categoryKey}
                axisLine={false}
                tickLine={false}
                tickMargin={8}
                interval="preserveStartEnd"
                tick={axisTick}
              />
              <YAxis
                allowDecimals={false}
                axisLine={false}
                tickLine={false}
                width={28}
                tick={axisTick}
                orientation={isRtl ? "right" : "left"}
              />
            </>
          )}
          <Tooltip
            cursor={{ fill: palette.tooltipCursor }}
            content={({ active, payload, label }) => {
              const full =
                (payload?.[0]?.payload as { __full?: string } | undefined)?.__full ??
                (typeof label === "string" ? label : undefined);
              return (
                <ChartTooltip
                  active={active}
                  payload={payload as never}
                  label={typeof label === "string" ? label : undefined}
                  fullLabel={full}
                />
              );
            }}
          />
          {series.map((s, i) => (
            <Bar
              key={s.dataKey}
              dataKey={s.dataKey}
              name={s.name}
              fill={s.color ?? seriesColors[i % seriesColors.length]}
              radius={horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0]}
            >
              {cellColors
                ? displayData.map((_, idx) => (
                    <Cell key={idx} fill={cellColors[idx] ?? colorForKey("", idx)} />
                  ))
                : null}
            </Bar>
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
